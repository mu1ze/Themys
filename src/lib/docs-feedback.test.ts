import assert from "node:assert/strict"
import test from "node:test"

import {
  DOCS_FEEDBACK_MAX_COMMENT_LENGTH,
  DocsFeedbackValidationError,
  getFeedbackGate,
  parseDocsFeedback,
} from "./docs-feedback.ts"

test("accepts valid anonymous documentation feedback", () => {
  assert.deepEqual(parseDocsFeedback({ slug: "quick-start", helpful: true }), {
    slug: "quick-start",
    helpful: true,
    comment: null,
    deviceId: null,
    turnstileToken: null,
  })
})

test("rejects unknown pages, malformed fields, unexpected fields, and oversized comments", () => {
  const invalid = [
    { slug: "made-up", helpful: true },
    { slug: "quick-start", helpful: "yes" },
    { slug: "quick-start", helpful: true, admin: true },
    { slug: "quick-start", helpful: false, comment: "x".repeat(DOCS_FEEDBACK_MAX_COMMENT_LENGTH + 1) },
  ]
  for (const value of invalid) {
    assert.throws(() => parseDocsFeedback(value), DocsFeedbackValidationError)
  }
})

test("repeated anonymous feedback escalates to challenge and then rate limit", () => {
  assert.equal(getFeedbackGate(0, true), "allow")
  assert.equal(getFeedbackGate(3, true), "challenge")
  assert.equal(getFeedbackGate(9, true), "challenge")
  assert.equal(getFeedbackGate(10, true), "rate_limited")
  assert.equal(getFeedbackGate(3, false), "allow")
})
