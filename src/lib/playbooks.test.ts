import assert from "node:assert/strict"
import test from "node:test"

import { getAllPresetTopics, mergePlaybookTopics } from "./playbooks.ts"

test("mergePlaybookTopics replaces presets and keeps custom topics", () => {
  const existing = [
    "Data sharing",
    "Auto-renewal",
    "Arbitration",
    "Account termination",
    "Refunds",
    "Data processing",
  ]

  const merged = mergePlaybookTopics("saas_vendor", existing)
  const presetSet = getAllPresetTopics()

  assert.ok(merged.includes("Refunds"))
  assert.ok(!merged.includes("Data sharing"))
  assert.ok(merged.includes("Data processing"))
  assert.ok(merged.includes("Liability cap"))
  assert.equal(merged.filter((topic) => !presetSet.has(topic)).length, 1)
})

test("mergePlaybookTopics uses contractor preset topics", () => {
  const merged = mergePlaybookTopics("contractor", ["Refunds", "Data sharing"])
  assert.deepEqual(merged, ["IP assignment", "Non-solicit", "Payment", "Termination", "Refunds"])
})
