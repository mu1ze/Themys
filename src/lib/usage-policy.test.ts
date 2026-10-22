import assert from "node:assert/strict"
import test from "node:test"

import { chargingPolicy } from "./usage-policy.ts"

const rows = [
  ["invalid", 0, 0, true],
  ["failed", 0, 0, true],
  ["cached_success", 1, 0, false],
  ["uncached_success", 1, 1, false],
] as const

for (const [outcome, scans, ai, refund] of rows) {
  test(`charging matrix: ${outcome}`, () => {
    assert.deepEqual(chargingPolicy(outcome), {
      scanSlots: scans,
      aiSlots: ai,
      refundCredits: refund,
    })
  })
}
