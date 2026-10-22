import assert from "node:assert/strict"
import test from "node:test"

import { getRateLimitWindow, RATE_LIMITS } from "./rate-limit.ts"

test("monthly scan windows reset at the next UTC month boundary", () => {
  const yearEnd = getRateLimitWindow("scans", new Date("2026-12-31T23:59:59.999Z"))
  assert.equal(yearEnd.key, "2026-12")
  assert.equal(new Date(yearEnd.resetsAt).toISOString(), "2027-01-01T00:00:00.000Z")

  const leapFebruary = getRateLimitWindow("scans", new Date("2028-02-29T12:00:00.000Z"))
  assert.equal(leapFebruary.key, "2028-02")
  assert.equal(new Date(leapFebruary.resetsAt).toISOString(), "2028-03-01T00:00:00.000Z")
})

test("monthly AI windows handle month, year, and leap-year boundaries", () => {
  const yearEnd = getRateLimitWindow("ai", new Date("2026-12-31T23:59:59.999Z"))
  assert.equal(yearEnd.key, "2026-12")
  assert.equal(new Date(yearEnd.resetsAt).toISOString(), "2027-01-01T00:00:00.000Z")

  const leapFebruary = getRateLimitWindow("ai", new Date("2028-02-29T12:00:00.000Z"))
  assert.equal(leapFebruary.key, "2028-02")
  assert.equal(new Date(leapFebruary.resetsAt).toISOString(), "2028-03-01T00:00:00.000Z")
})

test("daily extract windows share the UTC midnight reset", () => {
  const before = getRateLimitWindow("extract", new Date("2026-12-31T23:59:59.999Z"))
  assert.equal(before.key, "2026-12-31")
  assert.equal(new Date(before.resetsAt).toISOString(), "2027-01-01T00:00:00.000Z")
})

test("documented plan ceilings are centralized for every supported tier", () => {
  assert.deepEqual(RATE_LIMITS, {
    free: { scans: { max: 15, windowSeconds: 2_592_000 }, ai: { max: 15, windowSeconds: 2_592_000 }, extract: { max: 30, windowSeconds: 86_400 } },
    base: { scans: { max: 30, windowSeconds: 2_592_000 }, ai: { max: 30, windowSeconds: 2_592_000 }, extract: { max: 150, windowSeconds: 86_400 } },
    advanced: { scans: { max: 50, windowSeconds: 2_592_000 }, ai: { max: 50, windowSeconds: 2_592_000 }, extract: { max: 600, windowSeconds: 86_400 } },
    lifetime: { scans: { max: 50, windowSeconds: 2_592_000 }, ai: { max: 50, windowSeconds: 2_592_000 }, extract: { max: 600, windowSeconds: 86_400 } },
  })
})
