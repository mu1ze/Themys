export const CACHED_SCAN_MATCH_WINDOW_MS = 20 * 60 * 1000

export type TimedRecord = {
  createdAt: string
}

export type CacheKeyForMatch = {
  name: string
  metadata?: {
    title?: string | null
    domain?: string | null
    createdAt?: string
    source?: string
  }
}

export type CacheSeedMatch = {
  key: CacheKeyForMatch
  eventCreatedAt: string
  url: string
}

export function isHttpUrl(value: string | null | undefined): value is string {
  if (!value) return false
  try {
    const url = new URL(value.trim())
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

/** Public scan cache stores the document URL in metadata.title. */
export function cacheEntryDocumentUrl(
  metadata: { title?: string | null; domain?: string | null } | undefined,
): string | null {
  const title = metadata?.title?.trim()
  return isHttpUrl(title) ? title : null
}

export function normalizeScanUrl(url: string): string {
  try {
    const parsed = new URL(url.trim())
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "")
    let path = parsed.pathname || "/"
    if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1)
    return `${host}${path}${parsed.search}`
  } catch {
    return url.trim().toLowerCase()
  }
}

export function pickOrphanUsageEvents<T extends TimedRecord, S extends TimedRecord>(
  events: T[],
  scans: S[],
  windowMs = CACHED_SCAN_MATCH_WINDOW_MS,
): T[] {
  return events.filter((event) => {
    const eventTime = Date.parse(event.createdAt)
    if (!Number.isFinite(eventTime)) return false
    return !scans.some((scan) => {
      const scanTime = Date.parse(scan.createdAt)
      return Number.isFinite(scanTime) && Math.abs(scanTime - eventTime) <= windowMs
    })
  })
}

/**
 * Pair orphan analyze events with public URL cache entries from the same
 * window. Never returns entries for URLs the account already has, and never
 * assigns the entire public cache to one user.
 */
export function matchCacheEntriesToUsageEvents(
  keys: CacheKeyForMatch[],
  events: TimedRecord[],
  existingUrls: Iterable<string>,
  windowMs = CACHED_SCAN_MATCH_WINDOW_MS,
): CacheSeedMatch[] {
  const usedKeyNames = new Set<string>()
  const usedUrls = new Set(
    Array.from(existingUrls, (url) => normalizeScanUrl(url)).filter(Boolean),
  )
  const matches: CacheSeedMatch[] = []

  for (const event of events) {
    const eventTime = Date.parse(event.createdAt)
    if (!Number.isFinite(eventTime)) continue

    let best: { key: CacheKeyForMatch; dist: number; url: string } | null = null
    for (const key of keys) {
      if (usedKeyNames.has(key.name)) continue
      const url = cacheEntryDocumentUrl(key.metadata)
      if (!url || !key.metadata?.createdAt) continue
      const normalizedUrl = normalizeScanUrl(url)
      if (usedUrls.has(normalizedUrl)) continue
      const cacheTime = Date.parse(key.metadata.createdAt)
      if (!Number.isFinite(cacheTime)) continue
      const dist = Math.abs(cacheTime - eventTime)
      if (dist > windowMs) continue
      if (!best || dist < best.dist) {
        best = { key, dist, url }
      }
    }

    if (!best) continue
    usedKeyNames.add(best.key.name)
    usedUrls.add(normalizeScanUrl(best.url))
    matches.push({
      key: best.key,
      eventCreatedAt: event.createdAt,
      url: best.url,
    })
  }

  return matches
}
