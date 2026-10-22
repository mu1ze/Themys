import assert from "node:assert/strict"
import test from "node:test"

import {
  findGroundedQuote,
  scanStrictDocument,
  splitStrictScanDocument,
} from "./strict-scan-core.ts"

test("strict chunks cover a long document exactly with no gaps or truncation", () => {
  const source = Array.from({ length: 900 }, (_, index) =>
    `Section ${index}. This is ordinary legal text for coverage marker M${String(index).padStart(4, "0")}.`,
  ).join("\n\n")
  const chunks = splitStrictScanDocument(source, 1_000)

  assert.ok(chunks.length > 50)
  assert.equal(chunks.map((chunk) => chunk.text).join(""), source)
  assert.equal(chunks[0].start, 0)
  assert.equal(chunks.at(-1)?.end, source.length)
  for (let index = 1; index < chunks.length; index++) {
    assert.equal(chunks[index - 1].end, chunks[index].start)
  }
})

test("strict chunks cover the full 200,000-character paste limit exactly", () => {
  const source = `${"A".repeat(199_999)}Z`
  const chunks = splitStrictScanDocument(source)

  assert.equal(source.length, 200_000)
  assert.equal(chunks.map((chunk) => chunk.text).join(""), source)
  assert.equal(chunks[0].start, 0)
  assert.equal(chunks.at(-1)?.end, 200_000)
  assert.equal(chunks.reduce((covered, chunk) => covered + chunk.text.length, 0), 200_000)
})

test("strict scan retains only target-marked exact-source flags and records source locations", async () => {
  const risk = "Your subscription renews automatically each month unless you cancel."
  const benign = "You may cancel at any time and receive a prorated refund."
  const source = `Privacy Policy\n\n${benign}\n\n${"Routine processing details. ".repeat(40)}\n\n${risk}`

  const output = await scanStrictDocument(source, async (chunk) => {
    const flags = []
    if (chunk.text.includes(benign)) {
      flags.push({ category: "Benign cancellation", text: benign, isTargetClause: false })
      flags.push({ category: "Invented", text: "We sell all personal data.", isTargetClause: true })
    }
    if (chunk.text.includes(risk)) {
      flags.push({ category: "Automatic renewal", text: risk, isTargetClause: true })
    }
    return flags
  }, { maxChars: 300, concurrency: 2 })

  assert.deepEqual(output.flags.map((flag) => flag.text), [risk])
  assert.equal(output.flags[0].sourceStart, source.indexOf(risk))
  assert.equal(output.flags[0].sourceEnd, source.indexOf(risk) + risk.length)
  assert.equal(output.diagnostics.sourceChars, source.length)
  assert.equal(output.diagnostics.coveredChars, source.length)
  assert.equal(output.diagnostics.chunksAnalyzed, output.diagnostics.chunksTotal)
  assert.equal(output.diagnostics.rejectedNonTarget, 1)
  assert.equal(output.diagnostics.rejectedUngrounded, 1)
  assert.equal(output.diagnostics.groundingRepairs, 0)
})

test("strict scan repairs a provider paraphrase only from an exact target-bearing source clause", async () => {
  const source = "Accounts\n\nWe permit machine accounts, but the owner remains responsible for every action."
  const output = await scanStrictDocument(source, async () => [{
    category: "Machine account owner liability",
    text: "Machine account owners are liable for all activity.",
    isTargetClause: true,
  }], { targetClauses: ["machine account"] })

  assert.equal(output.flags.length, 1)
  assert.equal(output.flags[0].text, "We permit machine accounts, but the owner remains responsible for every action.")
  assert.equal(output.flags[0].sourceStart, source.indexOf("We permit"))
  assert.equal(output.diagnostics.groundingRepairs, 1)
  assert.equal(output.diagnostics.rejectedUngrounded, 0)
})

test("strict scan keeps the first source location when repeated navigation text is deduplicated", async () => {
  const repeated = "Subscriptions renew automatically until cancelled."
  const source = `${repeated}\n\n${"Neutral terms. ".repeat(60)}\n\n${repeated}`
  const output = await scanStrictDocument(source, async (chunk) =>
    chunk.text.includes(repeated)
      ? [{ category: "Automatic renewal", text: repeated, isTargetClause: true }]
      : [],
  { maxChars: 200 })

  assert.equal(output.flags.length, 1)
  assert.equal(output.flags[0].sourceStart, 0)
  assert.equal(output.diagnostics.duplicatesRemoved, 1)
})

test("strict scan fails instead of claiming coverage when any chunk fails", async () => {
  const source = "A".repeat(1_000)
  await assert.rejects(
    scanStrictDocument(source, async (chunk) => {
      if (chunk.index === 2) throw new Error("provider unavailable")
      return []
    }, { maxChars: 200, concurrency: 2 }),
    /provider unavailable/,
  )
})

test("grounding tolerates formatting whitespace but never fuzzy paraphrases", () => {
  const source = "We may share\n personal data with processors."
  assert.deepEqual(findGroundedQuote(source, "We may share personal data with processors."), {
    start: 0,
    end: source.length,
    text: source,
  })
  assert.equal(findGroundedQuote(source, "We sell personal data to advertisers."), null)
})
