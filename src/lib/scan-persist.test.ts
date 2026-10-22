import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import test from "node:test"

const root = process.cwd()

test("scan persistence saves the scan even if extraction storage fails", async () => {
  const persistence = await readFile(join(root, "src/lib/persistence.ts"), "utf8")
  const persistBlock = persistence.slice(persistence.indexOf("export async function persistAnalysis"))
  const rollbackBlock = persistBlock.slice(
    persistBlock.indexOf("try {\n    await insertClauses"),
    persistBlock.indexOf("await persistComplianceTags"),
  )

  assert.match(rollbackBlock, /await insertClauses\(scanId, normalizedResult\)/)
  assert.doesNotMatch(rollbackBlock, /persistFullExtraction/)
  assert.match(persistBlock, /await persistFullExtraction\(scanId, input\.fullExtraction\)/)
  assert.match(persistBlock, /Full extraction storage skipped/)
  assert.match(persistBlock, /live-stats revalidation skipped/)
  assert.match(persistBlock, /R2 document storage skipped; storing raw text in D1/)
  assert.match(persistBlock, /Failed to persist a scan and fully clean up its partial data/)
  assert.match(persistence, /function clampConfidence/)
  assert.match(persistence, /has no column named/)
  assert.match(persistBlock, /\.\.\.\(input\.createdAt \? \{ created_at: input\.createdAt \} : \{\}\)/)
})

test("analyze APIs fail the request when scan output cannot be saved", async () => {
  const [analyze, batch] = await Promise.all([
    readFile(join(root, "src/app/api/analyze/route.ts"), "utf8"),
    readFile(join(root, "src/app/api/analyze/batch/route.ts"), "utf8"),
  ])

  assert.match(analyze, /throw new ScanPersistError\(\)/)
  assert.match(analyze, /Scan results could not be saved/)
  assert.doesNotMatch(analyze, /Persistence skipped/)
  assert.doesNotMatch(batch, /Persistence skipped/)
  assert.match(batch, /await persistAnalysis\(/)
})

test("monitoring changes use the canonical analysis and persisted scan contract", async () => {
  const [monitoring, persistence, alerts] = await Promise.all([
    readFile(join(root, "src/lib/monitoring-job.ts"), "utf8"),
    readFile(join(root, "src/lib/persistence.ts"), "utf8"),
    readFile(join(root, "src/lib/monitoring.ts"), "utf8"),
  ])

  assert.match(monitoring, /import \{ analyzeItem \} from "@\/features\/scans\/server\/analyze"/)
  assert.doesNotMatch(monitoring, /import \{ analyzeTerms \} from "@\/lib\/llm"/)
  assert.match(monitoring, /fullExtraction: output\.fullExtraction/)
  assert.match(monitoring, /isMonitoringScan: true/)
  assert.match(monitoring, /previousScanId: latestSnapshot\.scan_id/)
  assert.match(persistence, /is_monitoring_scan: input\.isMonitoringScan \?\? false/)
  assert.match(persistence, /previous_scan_id: input\.previousScanId \?\? null/)
  assert.match(alerts, /snapshotRows\.map\(\(snapshot\) => \[String\(snapshot\.id\), snapshot\.scan_id/)
})
