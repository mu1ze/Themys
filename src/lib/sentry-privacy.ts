import type { Event, EventHint } from "@sentry/cloudflare"

const SENSITIVE_KEY = /authorization|cookie|token|secret|password|api.?key|clerk.?id|email|request.?body|payload|raw.?text|terms.?text|content/i
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
const CLERK_ID = /\b(?:user|sess|dvb|org|orgmem)_[A-Za-z0-9]+\b/g
const API_KEY = /\btmys_[A-Za-z0-9_-]+\b/g
const BEARER = /Bearer\s+[A-Za-z0-9._~-]+/gi
const EMBEDDED_URL_QUERY = /(https?:\/\/[^\s"'<>?#]+)[?#][^\s"'<>]*/gi

function scrubString(value: string): string {
  return value
    .replace(EMBEDDED_URL_QUERY, "$1?[REDACTED_QUERY]")
    .replace(BEARER, "[REDACTED_AUTH]")
    .replace(API_KEY, "[REDACTED_API_KEY]")
    .replace(EMAIL, "[REDACTED_EMAIL]")
    .replace(CLERK_ID, "[REDACTED_USER]")
}

function scrubValue(value: unknown, depth = 0): unknown {
  if (depth > 5) return "[REDACTED_DEPTH]"
  if (typeof value === "string") return scrubString(value)
  if (Array.isArray(value)) return value.map((item) => scrubValue(item, depth + 1))
  if (!value || typeof value !== "object") return value
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, child]) => [
      key,
      SENSITIVE_KEY.test(key) ? "[REDACTED]" : scrubValue(child, depth + 1),
    ]),
  )
}

function stripUrl(value: string | undefined): string | undefined {
  if (!value) return value
  try {
    const url = new URL(value)
    return `${url.origin}${url.pathname}`
  } catch {
    return scrubString(value.split(/[?#]/, 1)[0])
  }
}

export function scrubSentryEvent<T extends Event>(event: T, _hint?: EventHint): T {
  const scrubbed = scrubValue(event) as T
  if (scrubbed.request) {
    scrubbed.request.url = stripUrl(scrubbed.request.url)
    delete scrubbed.request.data
    delete scrubbed.request.cookies
    if (scrubbed.request.headers) {
      for (const key of Object.keys(scrubbed.request.headers)) {
        if (/authorization|cookie|x-api-key/i.test(key)) delete scrubbed.request.headers[key]
      }
    }
  }
  if (scrubbed.user) {
    scrubbed.user = undefined
  }
  return scrubbed
}
