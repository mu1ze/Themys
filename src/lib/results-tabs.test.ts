import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import test from "node:test"

test("scan results navigation exposes all report views", async () => {
  const source = await readFile(join(process.cwd(), "src/components/scan-results/nav-items.ts"), "utf8")

  assert.match(source, /id: "summary",\s+label: "Summary"/)
  assert.match(source, /id: "flagged",\s+label: "Flagged"/)
  assert.match(source, /id: "suggestions",\s+label: "Actionable Insights"/)
  assert.match(source, /id: "compliance",\s+label: "Compliance"/)
  assert.match(source, /id: "extraction",\s+label: "Extraction"/)
  assert.match(source, /id: "document",\s+label: "Full Document"/)
})

test("scan results workspace renders a report with a dedicated document view", async () => {
  const source = await readFile(join(process.cwd(), "src/components/scan-results-view.tsx"), "utf8")

  assert.match(source, /ScanResultsTopbar/)
  assert.match(source, /ScanResultsRail/)
  assert.doesNotMatch(source, /ScanResultsInspector/)
  assert.doesNotMatch(source, /FocusModeOverlay|focusMode|setFocusMode/)
  assert.match(source, /ScanResultsMobileNav/)
  assert.match(source, /defaultValue: "summary"|useState<WorkspacePanel>\("summary"\)/)
})

test("scan results mobile chrome hides the rail and keeps all views in navigation", async () => {
  const rail = await readFile(join(process.cwd(), "src/components/scan-results/rail.tsx"), "utf8")
  const nav = await readFile(join(process.cwd(), "src/components/scan-results/mobile-nav.tsx"), "utf8")

  assert.match(rail, /hidden min-\[1200px\]:flex/)
  assert.doesNotMatch(nav, /inspector/i)
  assert.match(nav, /min-\[1200px\]:hidden/)
  assert.match(nav, /aria-label="Result views"/)
})

test("scan results mobile chrome uses safe areas and short untruncated tab labels", async () => {
  const layout = await readFile(join(process.cwd(), "src/app/scan/results/layout.tsx"), "utf8")
  const topbar = await readFile(join(process.cwd(), "src/components/scan-results/topbar.tsx"), "utf8")
  const navItems = await readFile(join(process.cwd(), "src/components/scan-results/nav-items.ts"), "utf8")
  const nav = await readFile(join(process.cwd(), "src/components/scan-results/mobile-nav.tsx"), "utf8")
  const decision = await readFile(join(process.cwd(), "src/components/decision-control.tsx"), "utf8")

  assert.match(layout, /viewportFit:\s*"cover"/)
  assert.match(layout, /h-dvh min-w-0 overflow-hidden/)
  assert.match(topbar, /safe-area-inset-top/)
  assert.match(nav, /safe-area-inset-bottom/)
  assert.match(navItems, /shortLabel: "Insights"/)
  assert.match(navItems, /shortLabel: "Comply"/)
  assert.match(navItems, /shortLabel: "Extract"/)
  assert.match(nav, /shortLabel/)
  assert.match(nav, /text-\[10px\]/)
  assert.doesNotMatch(nav, /truncate/)
  assert.match(decision, /variant === "strip"[\s\S]*grid-cols-2/)
})

test("a finished scan opens the saved result by id instead of the previous latest scan", async () => {
  const [workflow, resultsPage, analyzeRoute] = await Promise.all([
    readFile(join(process.cwd(), "src/components/scan-workflow.tsx"), "utf8"),
    readFile(join(process.cwd(), "src/app/scan/results/page.tsx"), "utf8"),
    readFile(join(process.cwd(), "src/app/api/analyze/route.ts"), "utf8"),
  ])

  assert.match(workflow, /scanId/)
  assert.match(workflow, /router\.push\(`\/scan\/results\?id=\$\{encodeURIComponent\(scanId\)\}`\)/)
  assert.doesNotMatch(workflow, /router\.push\("\/scan\/results"\)/)

  assert.match(resultsPage, /export const dynamic = "force-dynamic"/)
  assert.match(resultsPage, /getScanWithClauses\(clerkId, requestedScanId\)/)
  assert.doesNotMatch(resultsPage, /res \?\? getLatestScanByClerkId/)
  assert.doesNotMatch(resultsPage, /getScanWithClauses\([^)]+, false\)/)
  assert.doesNotMatch(resultsPage, /getLatestScanByClerkId\([^)]+, false\)/)

  assert.match(analyzeRoute, /class ScanPersistError/)
  assert.match(analyzeRoute, /throw new ScanPersistError\(\)/)
  assert.doesNotMatch(analyzeRoute, /Persistence skipped/)
})
