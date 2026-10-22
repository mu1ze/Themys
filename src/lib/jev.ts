import { getRuntimeEnvironment } from "@/lib/runtime-env"

export type JevPrimitiveType = "noul" | "choice" | "score"

export type JevNoulQuestion = {
  type: "noul"
  instructions: string | Record<string, unknown>
  criteria?: { true: string | Record<string, unknown>; false: string | Record<string, unknown> }
}

export type JevChoiceQuestion = {
  type: "choice"
  instructions: string
  criteria: Record<string, string | null>
}

export type JevScoreQuestion = {
  type: "score"
  instructions: string
  criteria?: string[]
}

export type JevQuestion = JevNoulQuestion | JevChoiceQuestion | JevScoreQuestion

export type JevNoulAnswer = {
  type: "noul"
  noul: number
}

export type JevChoiceAnswer = {
  type: "choice"
  choice: string
  confidence?: number
  probabilities?: Record<string, number>
}

export type JevScoreAnswer = {
  type: "score"
  score: number
  confidence?: number
}

export type JevAnswer = JevNoulAnswer | JevChoiceAnswer | JevScoreAnswer

export type JevResponse = {
  model: string
  answers: Record<string, JevAnswer>
  usage: {
    input_tokens: number
    output_tokens: number
  }
}

const JEV_ENDPOINT = "https://api.typesafe.ai/v1/systemone"
const JEV_DEFAULT_MODEL = "jev-latest"
const TIMEOUT_MS = 15_000
const MAX_RETRIES = 2

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after")
  if (retryAfter) {
    const seconds = Number(retryAfter)
    const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retryAfter) - Date.now()
    if (Number.isFinite(delay) && delay >= 0) return delay
  }
  return 300 * 2 ** attempt + Math.floor(Math.random() * 150)
}

/**
 * Returns true if JEV_API_KEY or TYPESAFE_API_KEY is present in the runtime environment.
 */
export function isJevConfigured(): boolean {
  const env = getRuntimeEnvironment()
  return Boolean((env.JEV_API_KEY || env.TYPESAFE_API_KEY)?.trim())
}

/**
 * Evaluates a set of System One questions in parallel over the provided state text.
 */
export async function evaluateSystemOne(
  state: string,
  questions: Record<string, JevQuestion>,
  options: { model?: string; timeoutMs?: number } = {},
): Promise<JevResponse> {
  const env = getRuntimeEnvironment()
  const apiKey = (env.JEV_API_KEY || env.TYPESAFE_API_KEY)?.trim()
  if (!apiKey) {
    throw new Error("JEV_API_KEY is not configured in the runtime environment")
  }

  const model = options.model || JEV_DEFAULT_MODEL
  const timeout = options.timeoutMs || TIMEOUT_MS

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)
    try {
      const res = await fetch(JEV_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          state,
          questions,
        }),
        signal: controller.signal,
      })

      if ((res.status === 429 || res.status === 529) && attempt < MAX_RETRIES) {
        const delay = retryDelay(res, attempt)
        if (delay <= 5_000) {
          await new Promise((resolve) => setTimeout(resolve, delay))
          continue
        }
      }
      if (!res.ok) {
        const errorText = await res.text().catch(() => "")
        throw new Error(`TypeSafe Jev API error (${res.status}): ${errorText.slice(0, 300) || res.statusText}`)
      }

      return (await res.json()) as JevResponse
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`TypeSafe Jev request timed out after ${timeout}ms`)
      }
      throw error
    } finally {
      clearTimeout(timer)
    }
  }
  throw new Error("TypeSafe Jev retry budget exhausted")
}
