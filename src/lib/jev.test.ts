import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import test from "node:test"
import ts from "typescript"

import type { JevResponse } from "./jev.ts"

test("Jev transport retries a rate limit response and returns the typed answer", async () => {
  const source = await readFile(join(process.cwd(), "src/lib/jev.ts"), "utf8")
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const compiledModule = { exports: {} as Record<string, unknown> }
  let calls = 0
  const fetchMock = async () => {
    calls++
    return calls === 1
      ? Response.json({ error: "Rate limited" }, { status: 429, headers: { "retry-after": "0" } })
      : Response.json({
          model: "jev-1.13.0",
          answers: { risk: { type: "noul", noul: 0.91 } },
          usage: { input_tokens: 8, output_tokens: 2 },
        })
  }
  const requireDependency = (name: string) => {
    if (name === "@/lib/runtime-env") return { getRuntimeEnvironment: () => ({ JEV_API_KEY: "test-key" }) }
    throw new Error(`Unexpected transport import: ${name}`)
  }
  new Function("require", "module", "exports", "fetch", compiled)(requireDependency, compiledModule, compiledModule.exports, fetchMock)
  const evaluate = compiledModule.exports.evaluateSystemOne as (
    state: string,
    questions: Record<string, { type: "noul"; instructions: string }>,
  ) => Promise<JevResponse>

  const result = await evaluate("A clause", { risk: { type: "noul", instructions: "Is it risky?" } })
  assert.equal(calls, 2)
  assert.equal(result.model, "jev-1.13.0")
  assert.deepEqual(result.answers.risk, { type: "noul", noul: 0.91 })
})
