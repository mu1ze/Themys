import "server-only"

import {
  getCached,
  getCachedTextEntry,
  isKvAvailable,
  listCacheKeysByPrefix,
  type UnifiedScanResult,
} from "@/lib/cache"
import { getDatabase } from "@/lib/database"
import { identifyDocument } from "@/lib/document-identity"
import { resolveTextFromUrl } from "@/lib/extract"
import {
  getUserProfileByClerkId,
  listRecentScansByClerkId,
  persistAnalysis,
} from "@/lib/persistence"
import {
  matchCacheEntriesToUsageEvents,
  normalizeScanUrl,
  pickOrphanUsageEvents,
  type CacheKeyForMatch,
} from "@/lib/seed-cached-scans"
import { hashUsageActor } from "@/lib/usage-accounting"

const DEFAULT_PAGE_LIMIT = 8
const ADMIN_LIMIT = 25
const EVENT_LOOKBACK = 200
const SCAN_LOOKBACK = 200
const CACHE_LIST_PAGE = 250
const CACHE_LIST_MAX = 250

export type CachedScanRestoreSummary = {
  restored: number
  skipped: number
  failed: number
  scanIds: string[]
  orphanEvents: number
  matched: number
  reason?: string
}

const inFlight = new Map<string, Promise<CachedScanRestoreSummary>>()

function emptySummary(
  reason: string,
  extras?: Partial<CachedScanRestoreSummary>,
): CachedScanRestoreSummary {
  return {
    restored: 0,
    skipped: 0,
    failed: 0,
    scanIds: [],
    orphanEvents: 0,
    matched: 0,
    reason,
    ...extras,
  }
}

function isUnifiedScanResult(value: unknown): value is UnifiedScanResult {
  if (!value || typeof value !== "object") return false
  const scan = value as UnifiedScanResult
  return Boolean(
    scan.result &&
      Array.isArray(scan.result.clauses) &&
      Array.isArray(scan.result.flags),
  )
}

function hostnameFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return null
  }
}

async function listScanCacheKeys(): Promise<CacheKeyForMatch[]> {
  const keys: CacheKeyForMatch[] = []
  let cursor: string | undefined
  do {
    const page = await listCacheKeysByPrefix("scan:v3:", {
      limit: CACHE_LIST_PAGE,
      cursor,
    })
    for (const key of page.keys) {
      keys.push({
        name: key.name,
        metadata: key.metadata as CacheKeyForMatch["metadata"],
      })
    }
    if (page.list_complete || keys.length >= CACHE_LIST_MAX) break
    cursor = page.cursor
  } while (cursor)
  return keys.slice(0, CACHE_LIST_MAX)
}

async function resolveSeedText(url: string): Promise<string | null> {
  try {
    const cached = await getCachedTextEntry(url)
    const text = cached?.text?.trim()
    if (text) return text
  } catch (error) {
    console.warn(
      "[cached-scan-seed] text cache read skipped",
      error instanceof Error ? error.name : "UnknownError",
    )
  }

  try {
    const resolved = await resolveTextFromUrl(url)
    const text = resolved.text.trim()
    return text || null
  } catch (error) {
    console.warn(
      "[cached-scan-seed] URL text fetch skipped",
      error instanceof Error ? error.name : "UnknownError",
    )
    return null
  }
}

async function restoreCachedScansForClerkId(
  clerkId: string,
  options?: { limit?: number },
): Promise<CachedScanRestoreSummary> {
  const limit = Math.max(1, Math.min(options?.limit ?? DEFAULT_PAGE_LIMIT, ADMIN_LIMIT))
  const profile = await getUserProfileByClerkId(clerkId)
  if (!profile) return emptySummary("no_profile")

  if (!(await isKvAvailable())) return emptySummary("kv_unavailable")

  const actorHash = await hashUsageActor(clerkId)
  const database = getDatabase()
  const [{ data: eventRows, error: eventError }, scans] = await Promise.all([
    database
      .from("usage_events")
      .select("operation, outcome, created_at")
      .eq("actor_hash", actorHash)
      .in("operation", ["analyze", "batch_item"])
      .in("outcome", ["success", "idempotent_replay"])
      .order("created_at", { ascending: false })
      .limit(EVENT_LOOKBACK),
    listRecentScansByClerkId(clerkId, SCAN_LOOKBACK),
  ])
  if (eventError) throw eventError

  const events = (eventRows ?? []).map((row) => ({
    createdAt: row.created_at as string,
  }))
  const orphans = pickOrphanUsageEvents(events, scans)
  if (orphans.length === 0) return emptySummary("no_orphan_events")

  const existingUrls = scans
    .map((scan) => scan.url)
    .filter((url): url is string => Boolean(url))
  const matches = matchCacheEntriesToUsageEvents(
    await listScanCacheKeys(),
    orphans,
    existingUrls,
  ).slice(0, limit)

  if (matches.length === 0) {
    return emptySummary("no_matching_cache", { orphanEvents: orphans.length })
  }

  const restoredIds: string[] = []
  let skipped = 0
  let failed = 0
  const claimedUrls = new Set(existingUrls.map(normalizeScanUrl))

  for (const match of matches) {
    const normalizedUrl = normalizeScanUrl(match.url)
    if (claimedUrls.has(normalizedUrl)) {
      skipped++
      continue
    }

    try {
      const cached = await getCached<unknown>(match.key.name)
      if (!isUnifiedScanResult(cached)) {
        skipped++
        continue
      }
      const text = await resolveSeedText(match.url)
      if (!text) {
        skipped++
        continue
      }

      const domain =
        match.key.metadata?.domain?.trim() || hostnameFromUrl(match.url) || undefined
      const scanId = await persistAnalysis({
        clerkId,
        email: profile.email,
        text,
        url: match.url,
        domain,
        source: "web",
        result: cached.result,
        fullExtraction: cached.fullExtraction,
        document: identifyDocument({ text, url: match.url }),
        createdAt: match.eventCreatedAt,
      })
      claimedUrls.add(normalizedUrl)
      restoredIds.push(scanId)
    } catch (error) {
      failed++
      console.warn(
        "[cached-scan-seed] persist skipped",
        error instanceof Error ? error.name : "UnknownError",
      )
    }
  }

  return {
    restored: restoredIds.length,
    skipped,
    failed,
    scanIds: restoredIds,
    orphanEvents: orphans.length,
    matched: matches.length,
  }
}

export async function maybeSeedCachedScansForUser(
  clerkId: string,
  options?: { limit?: number },
): Promise<CachedScanRestoreSummary> {
  const existing = inFlight.get(clerkId)
  if (existing) return existing

  const pending = restoreCachedScansForClerkId(clerkId, options)
    .catch((error) => {
      console.warn(
        "[cached-scan-seed] skipped",
        error instanceof Error ? error.name : "UnknownError",
      )
      return emptySummary("error")
    })
    .finally(() => {
      inFlight.delete(clerkId)
    })

  inFlight.set(clerkId, pending)
  return pending
}
