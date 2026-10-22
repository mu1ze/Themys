import { getCloudflareContext } from "@opennextjs/cloudflare"

import { DOCS_FEEDBACK_WINDOW_SECONDS } from "@/lib/docs-feedback"
import { BoundedTtlCache } from "@/lib/bounded-ttl-cache"

type CounterStore = {
  get(key: string): Promise<string | null>
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
}

const memoryCounters = new BoundedTtlCache<string, number>({
  maxEntries: 5_000,
  maxBytes: 512 * 1024,
  maxEntryBytes: 256,
  estimateBytes: (key) => key.length * 2 + 16,
})

function isCounterStore(value: unknown): value is CounterStore {
  return typeof value === "object"
    && value !== null
    && "get" in value
    && typeof value.get === "function"
    && "put" in value
    && typeof value.put === "function"
}

async function getStore(): Promise<CounterStore | null> {
  try {
    const { env } = getCloudflareContext()
    const candidate: unknown = Reflect.get(env, "RATE_LIMIT_KV")
    return isCounterStore(candidate) ? candidate : null
  } catch {
    return null
  }
}

async function hashIdentifier(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32)
}

// Bucket strictly by Cloudflare-verified client IP. Client-supplied values
// (e.g. deviceId) must never widen the key space, or an attacker can rotate
// them to sidestep the per-IP attempt limits and Turnstile challenge gate.
export function getFeedbackClientIdentifier(request: Request): string {
  return request.headers.get("cf-connecting-ip")?.trim() || "unknown"
}

export async function getFeedbackAttemptCount(identifier: string): Promise<number> {
  const key = `docs-feedback:${await hashIdentifier(identifier)}`
  const store = await getStore()
  if (store) {
    const raw = await store.get(key)
    const count = Number.parseInt(raw ?? "0", 10)
    return Number.isFinite(count) && count > 0 ? count : 0
  }

  return memoryCounters.get(key) ?? 0
}

export async function recordFeedbackAttempt(identifier: string, currentCount: number): Promise<void> {
  const key = `docs-feedback:${await hashIdentifier(identifier)}`
  const nextCount = currentCount + 1
  const store = await getStore()
  if (store) {
    await store.put(key, String(nextCount), { expirationTtl: DOCS_FEEDBACK_WINDOW_SECONDS })
    return
  }

  memoryCounters.set(key, nextCount, DOCS_FEEDBACK_WINDOW_SECONDS * 1_000)
}
