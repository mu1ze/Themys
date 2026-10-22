import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import test from "node:test"

const root = process.cwd()
const source = (path: string) => readFile(join(root, path), "utf8")

test("all analysis sources cross the shared post-resolution size boundary", async () => {
  const [pipeline, singleRoute, batchRoute] = await Promise.all([
    source("src/lib/analyze-item.ts"),
    source("src/app/api/analyze/route.ts"),
    source("src/app/api/analyze/batch/route.ts"),
  ])

  assert.ok(
    pipeline.indexOf("assertAnalysisTextSize(text, resolved.cached")
      < pipeline.indexOf("const document = identifyDocument"),
  )
  assert.match(pipeline, /assertAnalysisTextSize\(text, source === "upload" \? "upload" : "paste"\)/)
  assert.match(singleRoute, /error instanceof AnalysisInputTooLargeError[\s\S]*\? 413/)
  assert.match(batchRoute, /error instanceof AnalysisInputTooLargeError[\s\S]*\? 413/)
})

test("results defer original document reads to an authenticated endpoint", async () => {
  const [page, persistence, view, endpoint] = await Promise.all([
    source("src/app/scan/results/page.tsx"),
    source("src/lib/persistence.ts"),
    source("src/components/scan-results-view.tsx"),
    source("src/app/api/scans/[id]/document/route.ts"),
  ])

  assert.doesNotMatch(page, /listScansByDomain/)
  assert.match(persistence, /includeRawText = false/)
  assert.match(persistence, /includeRawText \? ", raw_text, document_object_key" : ""/)
  assert.match(view, /\/api\/scans\/\$\{encodeURIComponent\(scanId\)\}\/document/)
  assert.match(endpoint, /resolveRequestAuth\(request, \{ allowApiKey: false \}\)/)
  assert.match(endpoint, /Cache-Control": "private, no-store"/)
})

test("web scans opt into compact responses without changing the default contract", async () => {
  const [workflow, route] = await Promise.all([
    source("src/components/scan-workflow.tsx"),
    source("src/app/api/analyze/route.ts"),
  ])

  assert.match(workflow, /"x-themys-response": "web-compact"/)
  assert.match(route, /request\.headers\.get\("x-themys-response"\) === "web-compact"/)
  assert.match(route, /if \(compactWebResponse\) \{\s+return json\(\{ scanId \}\)/)
  assert.ok(route.indexOf("if (compactWebResponse)") < route.indexOf('"usage-status"'))
})

test("optional animation and tracing stay out of shared client initialization", async () => {
  const [ui, monitoring, instrumentation] = await Promise.all([
    source("src/components/ui.tsx"),
    source("src/app/monitoring/monitoring-client.tsx"),
    source("src/instrumentation-client.ts"),
  ])

  assert.doesNotMatch(ui, /interior\/loading-button|MotionLoadingButton/)
  assert.match(monitoring, /@\/components\/motion-loading-button/)
  assert.doesNotMatch(instrumentation, /browserTracingIntegration|tracesSampleRate/)
  assert.match(instrumentation, /beforeSend: scrubSentryEvent/)
})

test("fallback caches are bounded and URL extraction has validator-aware reuse", async () => {
  const [cache, feedback, extract] = await Promise.all([
    source("src/lib/cache.ts"),
    source("src/lib/docs-feedback-rate-limit.ts"),
    source("src/lib/extract.ts"),
  ])

  assert.match(cache, /new BoundedTtlCache/)
  assert.doesNotMatch(cache, /setTimeout\(\(\) => memCache\.delete/)
  assert.match(feedback, /new BoundedTtlCache/)
  assert.match(extract, /If-None-Match/)
  assert.match(extract, /If-Modified-Since/)
  assert.match(extract, /res\.status === 304/)
  assert.match(extract, /UNVALIDATED_CACHE_FRESHNESS_MS/)
})
