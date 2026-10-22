import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import test from "node:test"
import ts from "typescript"

import * as core from "./jev-scan-core.ts"
import type { JevScanResult } from "./jev-scanner.ts"

test("Jev scan runs batches concurrently and verifies distinct source evidence", async () => {
  let activeBatches = 0
  let peakBatches = 0
  const evaluate = async (state: string, questions: Record<string, { type: string }>) => {
    const parsed = JSON.parse(state) as {
      clauses?: Record<string, string>
      candidates?: Array<{ text: string }>
    }
    if (parsed.candidates) {
      const answers = Object.fromEntries(parsed.candidates.map((candidate, index) => [
        `evidence_${index}`,
        { type: "noul", noul: candidate.text.includes("voluntarily") ? 0.05 : 0.96 },
      ]))
      return { model: "jev-1.13.0", answers, usage: { input_tokens: 100, output_tokens: 20 } }
    }

    activeBatches++
    peakBatches = Math.max(peakBatches, activeBatches)
    await new Promise((resolve) => setTimeout(resolve, 5))
    activeBatches--
    const clauseIds = Object.keys(parsed.clauses ?? {})
    const firstBatch = clauseIds.includes("C01")
    const answers: Record<string, {
      type: string
      noul?: number
      choice?: string
      confidence?: number
      probabilities?: Record<string, number>
    }> = Object.fromEntries(Object.entries(questions).map(([id, question]) => [
      id,
      question.type === "noul"
        ? { type: "noul", noul: id === "risk_mandatory_arbitration_detect" ? 0.95 : 0.01 }
        : { type: "choice", choice: "none", confidence: 1, probabilities: { none: 1 } },
    ]))
    answers.risk_mandatory_arbitration_clause = firstBatch
      ? { type: "choice", choice: "C01", confidence: 0.4, probabilities: { C01: 0.55, C02: 0.35, none: 0.1 } }
      : { type: "choice", choice: "C31", confidence: 0.9, probabilities: { C31: 0.9, none: 0.1 } }
    return { model: "jev-1.13.0", answers, usage: { input_tokens: 100, output_tokens: 20 } }
  }

  // Compile the actual scanner with only its provider replaced. This exercises
  // its orchestration without a network call or an API credential.
  const source = await readFile(join(process.cwd(), "src/lib/jev-scanner.ts"), "utf8")
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const compiledModule = { exports: {} as Record<string, unknown> }
  const requireDependency = (name: string) => {
    if (name === "@/lib/jev") return { evaluateSystemOne: evaluate }
    if (name === "@/lib/jev-scan-core") return core
    throw new Error(`Unexpected scanner import: ${name}`)
  }
  new Function("require", "module", "exports", compiled)(requireDependency, compiledModule, compiledModule.exports)
  const scan = compiledModule.exports.scanTermsWithJev as (text: string) => Promise<JevScanResult>

  const paragraphs = [
    "You must resolve all disputes through mandatory binding arbitration.",
    "Binding arbitration may be chosen voluntarily by both parties.",
    ...Array.from({ length: 28 }, (_, index) => `General service information number ${index + 1}.`),
    "You must use binding arbitration instead of court for every dispute.",
  ]
  const result = await scan(paragraphs.join("\n\n"))
  assert.equal(peakBatches, 2)
  assert.deepEqual(result.flags.map((flag) => flag.id), [
    "flag-mandatory_arbitration-C01",
    "flag-mandatory_arbitration-C31",
  ])
  assert.equal(result.diagnostics.modelVersion, "jev-1.13.0")
  assert.equal(result.diagnostics.batches.length, 2)
  assert.equal(result.diagnostics.evidence.find((item) => item.clauseId === "C02")?.accepted, false)
})
