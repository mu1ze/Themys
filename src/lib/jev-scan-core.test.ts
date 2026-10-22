import assert from "node:assert/strict"
import test from "node:test"

import {
  choiceCandidateIds,
  mapWithConcurrency,
  segmentDocumentIntoClauseSpans,
} from "./jev-scan-core.ts"

test("segmentation keeps short clauses and exact source offsets", () => {
  const source = "NO REFUNDS.\r\n\r\nAccounts may be terminated without notice.\n\nYou may appeal."
  const clauses = segmentDocumentIntoClauseSpans(source)
  assert.equal(clauses.length, 3)
  assert.deepEqual(clauses.map(({ text }) => text), [
    "NO REFUNDS.",
    "Accounts may be terminated without notice.",
    "You may appeal.",
  ])
  for (const clause of clauses) assert.equal(source.slice(clause.start, clause.end), clause.text)
})

test("long paragraphs split without losing source words", () => {
  const source = "The service may change. ".repeat(160)
  const clauses = segmentDocumentIntoClauseSpans(source)
  assert.ok(clauses.length > 1)
  assert.equal(clauses.map(({ text }) => text).join(" ").trim(), source.trim())
  for (const clause of clauses) assert.equal(source.slice(clause.start, clause.end), clause.text)
})

test("numbered clauses separated by single newlines remain distinct", () => {
  const source = "1. Accounts may be closed without notice.\n2. You may appeal a closure."
  assert.deepEqual(segmentDocumentIntoClauseSpans(source).map(({ text }) => text), [
    "1. Accounts may be closed without notice.",
    "2. You may appeal a closure.",
  ])
})

test("bounded concurrency preserves batch order", async () => {
  let active = 0
  let peak = 0
  const results = await mapWithConcurrency([0, 1, 2, 3, 4, 5], 2, async (item) => {
    active++
    peak = Math.max(peak, active)
    await new Promise((resolve) => setTimeout(resolve, item % 2 ? 1 : 4))
    active--
    return item * 10
  })
  assert.equal(peak, 2)
  assert.deepEqual(results, [0, 10, 20, 30, 40, 50])
})

test("Choice may abstain and nominates distinct alternatives for verification", () => {
  const available = new Set(["C01", "C02", "C03"])
  assert.deepEqual(choiceCandidateIds({ choice: "none" }, available), [])
  assert.deepEqual(choiceCandidateIds({ choice: "none", probabilities: { C01: 0.2, C02: 0.1, none: 0.7 } }, available), ["C01"])
  assert.deepEqual(choiceCandidateIds({
    choice: "C01",
    probabilities: { C01: 0.5, C02: 0.3, C03: 0.1, none: 0.1 },
  }, available), ["C01", "C02"])
})
