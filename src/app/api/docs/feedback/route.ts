import { NextResponse } from "next/server"

import {
  DOCS_FEEDBACK_MAX_BODY_BYTES,
  DocsFeedbackValidationError,
  getFeedbackGate,
  parseDocsFeedback,
} from "@/lib/docs-feedback"
import {
  getFeedbackAttemptCount,
  getFeedbackClientIdentifier,
  recordFeedbackAttempt,
} from "@/lib/docs-feedback-rate-limit"
import { readRequestText, RequestBodyTooLargeError } from "@/lib/request-body"
import { getRuntimeEnvironment } from "@/lib/runtime-env"
import { getDatabase } from "@/lib/database"

const DOCS_ORIGIN = "https://docs.themys.ca"

function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("origin")
  if (origin !== DOCS_ORIGIN) return {}
  return {
    "Access-Control-Allow-Origin": DOCS_ORIGIN,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  }
}

function jsonResponse(request: Request, body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init)
  for (const [name, value] of Object.entries(corsHeaders(request))) {
    response.headers.set(name, value)
  }
  return response
}

async function verifyTurnstile(token: string, remoteIp: string | null): Promise<boolean> {
  const secret = getRuntimeEnvironment().TURNSTILE_SECRET_KEY
  if (!secret) return false

  const body = new URLSearchParams({ secret, response: token })
  if (remoteIp) body.set("remoteip", remoteIp)
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body,
    signal: AbortSignal.timeout(5_000),
  })
  if (!response.ok) return false
  const result = await response.json() as { success?: boolean }
  return result.success === true
}

export async function POST(request: Request) {
  let rawBody: string
  try {
    rawBody = await readRequestText(request, DOCS_FEEDBACK_MAX_BODY_BYTES)
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return jsonResponse(request, { error: "Request body is too large" }, { status: 413 })
    }
    return jsonResponse(request, { error: "Invalid request body" }, { status: 400 })
  }

  let input
  try {
    input = parseDocsFeedback(JSON.parse(rawBody))
  } catch (error) {
    const message = error instanceof DocsFeedbackValidationError ? error.message : "Invalid JSON"
    return jsonResponse(request, { error: message }, { status: 400 })
  }

  const identifier = getFeedbackClientIdentifier(request)
  const currentCount = await getFeedbackAttemptCount(identifier)
  const env = getRuntimeEnvironment()
  const siteKey = env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  const challengeConfigured = Boolean(siteKey && env.TURNSTILE_SECRET_KEY)
  const gate = getFeedbackGate(currentCount, challengeConfigured)

  if (gate === "rate_limited") {
    return jsonResponse(
      request,
      { error: "Too many feedback submissions. Try again later." },
      { status: 429, headers: { "Retry-After": "3600" } },
    )
  }

  if (gate === "challenge") {
    const remoteIp = request.headers.get("cf-connecting-ip")
    const verified = input.turnstileToken
      ? await verifyTurnstile(input.turnstileToken, remoteIp).catch(() => false)
      : false
    if (!verified) {
      return jsonResponse(
        request,
        { error: "Verification required", code: "challenge_required", siteKey },
        { status: 403 },
      )
    }
  }

  try {
    const { error } = await getDatabase().from("docs_feedback").insert({
      slug: input.slug,
      helpful: input.helpful,
      comment: input.comment,
    })
    if (error) {
      console.error("[docs feedback] insert failed", error.code)
      return jsonResponse(request, { error: "Feedback could not be saved" }, { status: 503 })
    }
    await recordFeedbackAttempt(identifier, currentCount)
    return jsonResponse(request, { ok: true }, { status: 201 })
  } catch {
    return jsonResponse(request, { error: "Feedback service is unavailable" }, { status: 503 })
  }
}

export function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(request) })
}
