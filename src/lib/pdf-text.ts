import { extractText, getDocumentProxy } from "unpdf"

export const MAX_PDF_BYTES = 8 * 1024 * 1024
export const MIN_EXTRACTED_TEXT_CHARS = 200

export type PdfTextErrorCode = "empty" | "image_only" | "too_large"

export class PdfTextError extends Error {
  readonly code: PdfTextErrorCode

  constructor(code: PdfTextErrorCode) {
    super(`PDF text extraction failed: ${code}`)
    this.name = "PdfTextError"
    this.code = code
  }
}

export function collapsePdfWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim()
}

export function evaluateExtractedPdfText(text: string): string {
  const collapsed = collapsePdfWhitespace(text)
  if (!collapsed) throw new PdfTextError("empty")
  if (collapsed.length < MIN_EXTRACTED_TEXT_CHARS) throw new PdfTextError("image_only")
  return collapsed
}

export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  if (bytes.byteLength > MAX_PDF_BYTES) throw new PdfTextError("too_large")

  const pdf = await getDocumentProxy(bytes)
  const { text } = await extractText(pdf, { mergePages: true })
  const merged = Array.isArray(text) ? text.join("\n") : text
  return evaluateExtractedPdfText(merged)
}
