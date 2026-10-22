import { safeHeader, isSafeEmail } from "./security.ts"

type SendEmailBinding = { send(message: unknown): Promise<void> }
type DeliveryPayload = { from: string; to: string; subject: string; text: string; html: string; idempotencyKey: string }
type DeliveryState = { status: "sending" | "sent"; updatedAt: number }
type DurableStorage = {
  get<T>(key: string): Promise<T | null | undefined>
  put<T>(key: string, value: T): Promise<void>
  delete(key: string): Promise<void>
  setAlarm(timestamp: number | Date): Promise<void>
}
type DurableObjectStateLike = {
  storage: DurableStorage
  blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T>
}
type DeliveryCoordinatorNamespace = {
  idFromName(name: string): unknown
  get(id: unknown): { fetch(request: Request): Promise<Response> }
}
export type EmailEnvironment = {
  SEND_EMAIL: SendEmailBinding
  DELIVERY_COORDINATOR: DeliveryCoordinatorNamespace
  MONITORING_EMAIL_FROM: string
  APP_URL: string
}

const MAX_BODY_BYTES = 128 * 1024
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000
const SENDING_STALE_AFTER_MS = 15 * 60 * 1000

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  })
}

function escapeMime(value: string): string {
  return value.replace(/[\r\n]/g, " ")
}

function makeMimeMessage(input: { from: string; to: string; subject: string; text: string; html: string }): string {
  const boundary = `themys-${crypto.randomUUID()}`
  return [
    `From: ${escapeMime(input.from)}`,
    `To: ${escapeMime(input.to)}`,
    `Subject: ${escapeMime(input.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    input.text,
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    input.html,
    `--${boundary}--`,
    "",
  ].join("\r\n")
}

async function sendEmail(env: Pick<EmailEnvironment, "SEND_EMAIL">, payload: DeliveryPayload): Promise<void> {
  // Cloudflare exposes the legacy raw-MIME constructor from the
  // `cloudflare:email` module. Keep the global fallback for the lightweight
  // Node tests, where the platform module is intentionally not available.
  const globalConstructor = (globalThis as unknown as {
    EmailMessage?: new (from: string, to: string, raw: string) => unknown
  }).EmailMessage
  const EmailMessageConstructor = globalConstructor ?? (await import("cloudflare:email")).EmailMessage
  await env.SEND_EMAIL.send(new EmailMessageConstructor(payload.from, payload.to, makeMimeMessage(payload)))
}

/**
 * Strongly serializes delivery attempts for one idempotency key. Workers KV is
 * intentionally not used here because its eventual consistency cannot close
 * the concurrent-send race.
 */
export class DeliveryCoordinator {
  private readonly state: DurableObjectStateLike
  private readonly env: Pick<EmailEnvironment, "SEND_EMAIL">

  constructor(state: DurableObjectStateLike, env: Pick<EmailEnvironment, "SEND_EMAIL">) {
    this.state = state
    this.env = env
  }

  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") return json({ error: "Not found" }, 404)

    let payload: DeliveryPayload
    try {
      payload = await request.json() as DeliveryPayload
    } catch {
      return json({ error: "Invalid delivery payload" }, 400)
    }

    let outcome: { body: unknown; status: number } = { body: { error: "Delivery did not run" }, status: 500 }
    await this.state.blockConcurrencyWhile(async () => {
      const existing = await this.state.storage.get<DeliveryState>("delivery")
      if (existing?.status === "sent" || (existing?.status === "sending" && Date.now() - existing.updatedAt < SENDING_STALE_AFTER_MS)) {
        outcome = { body: { ok: true, duplicate: true }, status: 200 }
        return
      }

      await this.state.storage.put("delivery", { status: "sending", updatedAt: Date.now() } satisfies DeliveryState)
      try {
        await sendEmail(this.env, payload)
        await this.state.storage.put("delivery", { status: "sent", updatedAt: Date.now() } satisfies DeliveryState)
        await this.state.storage.setAlarm(Date.now() + IDEMPOTENCY_TTL_MS)
        outcome = { body: { ok: true, duplicate: false }, status: 200 }
      } catch (error) {
        await this.state.storage.delete("delivery")
        console.error("monitor email send failed", error instanceof Error ? error.name : "UnknownError")
        outcome = { body: { error: "Email delivery failed" }, status: 502 }
      }
    })

    return json(outcome.body, outcome.status)
  }

  async alarm(): Promise<void> {
    await this.state.storage.delete("delivery")
  }
}

const monitoringEmailWorker = {
  async fetch(request: Request, env: EmailEnvironment): Promise<Response> {
    if (request.method !== "POST" || new URL(request.url).pathname !== "/deliver") {
      return json({ error: "Not found" }, 404)
    }

    const rawBody = await request.text()
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) return json({ error: "Request body too large" }, 413)
    if (!env.SEND_EMAIL || !env.DELIVERY_COORDINATOR) return json({ error: "Worker is not configured" }, 500)

    let parsed: Record<string, unknown>
    try {
      const value = JSON.parse(rawBody) as unknown
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid")
      parsed = value as Record<string, unknown>
    } catch {
      return json({ error: "Invalid JSON" }, 400)
    }

    const headerIdempotencyKey = request.headers.get("x-themys-idempotency-key")
    const bodyIdempotencyKey = typeof parsed.idempotencyKey === "string" ? parsed.idempotencyKey : ""
    if (headerIdempotencyKey && bodyIdempotencyKey && headerIdempotencyKey !== bodyIdempotencyKey) return json({ error: "Idempotency key mismatch" }, 400)
    const idempotencyKey = headerIdempotencyKey || bodyIdempotencyKey
    const to = parsed.to
    const from = safeHeader(parsed.from, 320) || safeHeader(env.MONITORING_EMAIL_FROM, 320)
    const subject = safeHeader(parsed.subject)
    const text = typeof parsed.text === "string" && parsed.text.length <= 50_000 ? parsed.text : null
    const html = typeof parsed.html === "string" && parsed.html.length <= 100_000 ? parsed.html : text
    if (!idempotencyKey || idempotencyKey.length > 160 || !isSafeEmail(to) || !isSafeEmail(from) || !subject || !text || !html) {
      return json({ error: "Invalid delivery payload" }, 400)
    }

    const id = env.DELIVERY_COORDINATOR.idFromName(idempotencyKey)
    return env.DELIVERY_COORDINATOR.get(id).fetch(new Request("https://delivery-coordinator/internal", {
      method: "POST",
      body: JSON.stringify({ from, to, subject, text, html, idempotencyKey }),
    }))
  },
}

export default monitoringEmailWorker
