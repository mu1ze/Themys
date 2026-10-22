import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import test from "node:test"

import {
  CACHED_SCAN_MATCH_WINDOW_MS,
  cacheEntryDocumentUrl,
  isHttpUrl,
  matchCacheEntriesToUsageEvents,
  normalizeScanUrl,
  pickOrphanUsageEvents,
} from "./seed-cached-scans.ts"

const root = process.cwd()

test("cacheEntryDocumentUrl only accepts http(s) titles, not bare domains", () => {
  assert.equal(
    cacheEntryDocumentUrl({ title: "https://policies.google.com/terms" }),
    "https://policies.google.com/terms",
  )
  assert.equal(cacheEntryDocumentUrl({ title: "google.com", domain: "google.com" }), null)
  assert.equal(cacheEntryDocumentUrl({ title: "Terms of Service" }), null)
  assert.equal(cacheEntryDocumentUrl(undefined), null)
  assert.equal(isHttpUrl("ftp://example.com/terms"), false)
})

test("normalizeScanUrl treats www, trailing slash, and hash as the same document", () => {
  assert.equal(
    normalizeScanUrl("https://www.Example.com/terms/#section"),
    normalizeScanUrl("https://example.com/terms"),
  )
  assert.equal(
    normalizeScanUrl("https://spotify.com/legal/tos?lang=en"),
    "spotify.com/legal/tos?lang=en",
  )
})

test("pickOrphanUsageEvents keeps analyze events that have no nearby scan row", () => {
  const events = [
    { createdAt: "2026-09-10T15:00:00.000Z", id: "kept" },
    { createdAt: "2026-09-10T12:00:00.000Z", id: "matched" },
  ]
  const scans = [{ createdAt: "2026-09-10T12:04:00.000Z" }]
  const orphans = pickOrphanUsageEvents(events, scans)
  assert.deepEqual(orphans.map((event) => event.id), ["kept"])
})

test("matchCacheEntriesToUsageEvents pairs the closest URL cache entry and skips owned URLs", () => {
  const eventTime = "2026-09-10T15:00:00.000Z"
  const keys = [
    {
      name: "scan:v3:other",
      metadata: {
        title: "https://www.google.com/policies/terms",
        createdAt: "2026-09-10T14:50:00.000Z",
      },
    },
    {
      name: "scan:v3:spotify",
      metadata: {
        title: "https://www.spotify.com/legal/end-user-agreement/",
        createdAt: "2026-09-10T15:01:00.000Z",
      },
    },
    {
      name: "scan:v3:owned",
      metadata: {
        title: "https://apple.com/legal/internet-services/terms/site.html",
        createdAt: "2026-09-10T15:00:30.000Z",
      },
    },
    {
      name: "scan:v3:stale",
      metadata: {
        title: "https://meta.com/terms",
        createdAt: "2026-09-01T15:00:00.000Z",
      },
    },
  ]

  const matches = matchCacheEntriesToUsageEvents(
    keys,
    [{ createdAt: eventTime }],
    ["https://www.apple.com/legal/internet-services/terms/site.html"],
  )

  assert.equal(matches.length, 1)
  assert.equal(matches[0].key.name, "scan:v3:spotify")
  assert.equal(matches[0].url, "https://www.spotify.com/legal/end-user-agreement/")
  assert.equal(matches[0].eventCreatedAt, eventTime)
})

test("matchCacheEntriesToUsageEvents never dumps unmatched public cache onto an account", () => {
  const keys = [
    {
      name: "scan:v3:random",
      metadata: {
        title: "https://example.com/terms",
        createdAt: "2026-09-10T18:00:00.000Z",
      },
    },
  ]
  assert.deepEqual(
    matchCacheEntriesToUsageEvents(keys, [{ createdAt: "2026-09-10T12:00:00.000Z" }], []),
    [],
  )
  assert.ok(CACHED_SCAN_MATCH_WINDOW_MS >= 15 * 60 * 1000)
})

test("cached scan restore only persists matches for orphan usage events", async () => {
  const restore = await readFile(join(root, "src/lib/restore-cached-scans.ts"), "utf8")
  assert.match(restore, /pickOrphanUsageEvents/)
  assert.match(restore, /matchCacheEntriesToUsageEvents/)
  assert.doesNotMatch(restore, /for \(const key of keys\) \{\s*await persistAnalysis/)
})

test("history seeds cached scans after render and scan start is not blocked", async () => {
  const [dashboard, history, scanNew] = await Promise.all([
    readFile(join(root, "src/app/dashboard/page.tsx"), "utf8"),
    readFile(join(root, "src/app/history/page.tsx"), "utf8"),
    readFile(join(root, "src/app/scan/new/page.tsx"), "utf8"),
  ])
  assert.doesNotMatch(dashboard, /maybeSeedCachedScansForUser/)
  assert.doesNotMatch(scanNew, /maybeSeedCachedScansForUser/)
  assert.match(history, /after\(\(\) => maybeSeedCachedScansForUser\(user\.id\)\)/)
  assert.doesNotMatch(history, /await maybeSeedCachedScansForUser/)
})
