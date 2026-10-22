import assert from "node:assert/strict"
import test from "node:test"

import {
  AnalysisInputTooLargeError,
  assertAnalysisTextSize,
  MAX_ANALYSIS_CHARS,
} from "./analysis-limits.ts"

test("analysis text accepts the exact character boundary", () => {
  assert.doesNotThrow(() => assertAnalysisTextSize("a".repeat(MAX_ANALYSIS_CHARS), "paste"))
})

test("analysis text rejects one character above the boundary with safe metadata", () => {
  assert.throws(
    () => assertAnalysisTextSize("a".repeat(MAX_ANALYSIS_CHARS + 1), "url"),
    (error) => {
      assert.ok(error instanceof AnalysisInputTooLargeError)
      assert.equal(error.status, 413)
      assert.equal(error.source, "url")
      assert.equal(error.actualCharacters, MAX_ANALYSIS_CHARS + 1)
      assert.equal(error.maximumCharacters, MAX_ANALYSIS_CHARS)
      return true
    },
  )
})
