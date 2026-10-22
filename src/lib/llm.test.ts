import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import test from "node:test"

const llmPath = join(process.cwd(), "src/lib/llm.ts")

test("analysis cascade prefers fast flash models, not queued free giants", async () => {
  const llm = await readFile(llmPath, "utf8")

  const analyzeBlock = llm.slice(
    llm.indexOf("export async function analyzeTerms"),
    llm.indexOf("export async function fullExtraction"),
  )
  const extractionBlock = llm.slice(llm.indexOf("export async function fullExtraction"))

  assert.match(analyzeBlock, /scanTermsWithJev/)
  assert.match(analyzeBlock, /callOpenRouter\("deepseek\/deepseek-v4-flash"/)
  assert.match(analyzeBlock, /callOpenRouter\("z-ai\/glm-5.3-flash"/)
  assert.match(analyzeBlock, /callOpenRouter\("inception\/mercury-2.5"/)
  assert.doesNotMatch(analyzeBlock, /nemotron-3-ultra/)
  assert.doesNotMatch(analyzeBlock, /poolside\/laguna/)

  assert.match(extractionBlock, /\["inception\/mercury-2.5", "deepseek\/deepseek-v4-flash"\]/)
  assert.match(extractionBlock, /fullExtractionViaOpenRouter\(model, text\)/)
  assert.doesNotMatch(extractionBlock, /extractDocumentByChunks/)
  assert.doesNotMatch(extractionBlock, /nemotron-3-ultra/)
  assert.doesNotMatch(extractionBlock, /poolside\/laguna/)
})
