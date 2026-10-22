import assert from "node:assert/strict"
import test from "node:test"

import {
  collapsePdfWhitespace,
  evaluateExtractedPdfText,
  extractPdfText,
  MAX_PDF_BYTES,
  MIN_EXTRACTED_TEXT_CHARS,
  PdfTextError,
} from "./pdf-text.ts"

test("collapsePdfWhitespace collapses runs of whitespace", () => {
  assert.equal(collapsePdfWhitespace("  hello   world \n"), "hello world")
})

test("evaluateExtractedPdfText rejects empty extraction", () => {
  assert.throws(() => evaluateExtractedPdfText("   \n"), (error: unknown) => {
    assert.ok(error instanceof PdfTextError)
    assert.equal(error.code, "empty")
    return true
  })
})

test("evaluateExtractedPdfText rejects image-only extraction below 200 chars", () => {
  const short = "a".repeat(MIN_EXTRACTED_TEXT_CHARS - 1)
  assert.throws(() => evaluateExtractedPdfText(short), (error: unknown) => {
    assert.ok(error instanceof PdfTextError)
    assert.equal(error.code, "image_only")
    return true
  })
})

test("evaluateExtractedPdfText accepts sufficiently long text", () => {
  const text = "a".repeat(MIN_EXTRACTED_TEXT_CHARS)
  assert.equal(evaluateExtractedPdfText(text), text)
})

test("extractPdfText rejects files larger than 8MB before parsing", async () => {
  const oversized = new Uint8Array(MAX_PDF_BYTES + 1)
  await assert.rejects(
    () => extractPdfText(oversized),
    (error: unknown) => {
      assert.ok(error instanceof PdfTextError)
      assert.equal(error.code, "too_large")
      return true
    },
  )
})
