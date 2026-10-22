import assert from "node:assert/strict"
import test from "node:test"

import { BoundedTtlCache } from "./bounded-ttl-cache.ts"

test("bounded cache enforces entry and byte limits with LRU eviction", () => {
  const cache = new BoundedTtlCache<string, string>({
    maxEntries: 3,
    maxBytes: 9,
    maxEntryBytes: 6,
    estimateBytes: (_key, value) => value.length,
  })

  cache.set("a", "aaa", 1_000)
  cache.set("b", "bbb", 1_000)
  cache.set("c", "ccc", 1_000)
  assert.equal(cache.get("a"), "aaa")
  cache.set("d", "ddd", 1_000)

  assert.equal(cache.get("b"), undefined)
  assert.deepEqual(cache.stats(), { entries: 3, bytes: 9 })
  assert.equal(cache.set("oversized", "1234567", 1_000), false)
  assert.deepEqual(cache.stats(), { entries: 3, bytes: 9 })
})

test("bounded cache removes expired entries without timers", () => {
  let now = 10
  const cache = new BoundedTtlCache<string, string>({
    maxEntries: 10,
    maxBytes: 100,
    maxEntryBytes: 100,
    estimateBytes: (_key, value) => value.length,
    now: () => now,
  })

  cache.set("short", "value", 5)
  now = 16
  assert.equal(cache.get("short"), undefined)
  assert.deepEqual(cache.stats(), { entries: 0, bytes: 0 })
})
