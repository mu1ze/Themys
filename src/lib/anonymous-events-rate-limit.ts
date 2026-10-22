import { getCloudflareContext } from "@opennextjs/cloudflare"

import {
  ANONYMOUS_EVENT_MAX_PER_HOUR,
  ANONYMOUS_EVENT_WINDOW_SECONDS,
} from "@/lib/anonymous-events"
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
    const candidate: unknown = Reflect.get(getCloudflareContext().env, "RATE_LIMIT_KV")
    return isCounterStore(candidate) ? candidate : null
  } catch {
    return null
  }
}

async function counterKey(identifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(identifier))
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
  return `anon-events:${hex.slice(0, 32)}`
}

export async function takeAnonymousEventSlot(identifier: string): Promise<boolean> {
  const key = await counterKey(identifier)
  const store = await getStore()
  if (store) {
    const current = Number.parseInt(await store.get(key) ?? "0", 10)
    const count = Number.isFinite(current) && current > 0 ? current : 0
    if (count >= ANONYMOUS_EVENT_MAX_PER_HOUR) return false
    await store.put(key, String(count + 1), { expirationTtl: ANONYMOUS_EVENT_WINDOW_SECONDS })
    return true
  }

  const count = memoryCounters.get(key) ?? 0
  if (count >= ANONYMOUS_EVENT_MAX_PER_HOUR) return false
  memoryCounters.set(key, count + 1, ANONYMOUS_EVENT_WINDOW_SECONDS * 1_000)
  return true
}
