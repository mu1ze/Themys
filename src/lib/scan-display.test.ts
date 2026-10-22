import assert from "node:assert/strict"
import test from "node:test"

import { dedupeClausesByTitle, isFlaggedClause } from "./scan-display.ts"

test("distinct source wording under the same risk category remains visible", () => {
  const clauses = [
    { category: "Termination", text: "We may close your account without notice.", riskLevel: "red" as const },
    { category: "Termination", text: "We may remove all stored content at any time.", riskLevel: "red" as const },
    { category: "Termination", text: "We may close your account without notice.", riskLevel: "yellow" as const },
  ]
  const visible = dedupeClausesByTitle(clauses)
  assert.equal(visible.length, 2)
  assert.equal(visible[0].riskLevel, "red")
})

test("strict target matches remain flagged even when the provider rates them low risk", () => {
  assert.equal(isFlaggedClause({ riskLevel: "green", isFlagged: true, isTargetClause: true }), true)
  assert.equal(isFlaggedClause({ riskLevel: "green", isFlagged: false, isTargetClause: false }), false)
  assert.equal(isFlaggedClause({ id: "aur-1", riskLevel: "green", isFlagged: true }), false)
})
