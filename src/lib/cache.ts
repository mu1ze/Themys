import { getCloudflareContext } from "@opennextjs/cloudflare"
import type { AnalysisResult, FullExtractionSection } from "@/lib/llm"
import { BoundedTtlCache } from "@/lib/bounded-ttl-cache"

declare global {
  interface KVNamespace {
    get(key: string, options?: Partial<{ type: "text" }>): Promise<string | null>
    put(key: string, value: string, options?: Partial<{ expirationTtl: number; metadata: any }>): Promise<void>
    delete(key: string): Promise<void>
    list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{ keys: { name: string; expiration?: number; metadata?: any }[]; list_complete: boolean; cursor?: string }>
  }
}

type MemoryCacheValue = { data: unknown; metadata?: any }
const textEncoder = new TextEncoder()
const memCache = new BoundedTtlCache<string, MemoryCacheValue>({
  maxEntries: 256,
  maxBytes: 8 * 1024 * 1024,
  maxEntryBytes: 2 * 1024 * 1024,
  estimateBytes: (key, value) => textEncoder.encode(key).byteLength
    + textEncoder.encode(JSON.stringify(value)).byteLength,
})
const SCAN_CACHE_PREFIX = "scan:v3:"

export interface UnifiedScanResult {
  result: AnalysisResult
  fullExtraction: FullExtractionSection[] | null
  enrichmentVersion?: number
}

let warned = false
let warnedOversized = false

function isKvNamespace(value: unknown): value is KVNamespace {
  return typeof value === "object"
    && value !== null
    && "get" in value
    && typeof value.get === "function"
    && "put" in value
    && typeof value.put === "function"
    && "delete" in value
    && typeof value.delete === "function"
}

async function getKv(): Promise<KVNamespace | null> {
  try {
    const { env } = getCloudflareContext()
    const candidate: unknown = Reflect.get(env, "CACHE_KV")
    if (isKvNamespace(candidate)) return candidate
    if (!warned) {
      console.warn("[cache] CACHE_KV is unavailable — using bounded in-memory fallback")
      warned = true
    }
    return null
  } catch {
    if (!warned) {
      console.warn("[cache] getCloudflareContext failed — using in-memory fallback")
      warned = true
    }
    return null
  }
}

export async function getCached<T>(key: string): Promise<T | null> {
  const kv = await getKv()
  if (!kv) {
    const entry = memCache.get(key)
    if (!entry) return null
    return entry.data as T
  }

  const raw = await kv.get(key)
  if (!raw) return null
  return JSON.parse(raw) as T
}

export async function setCached<T>(key: string, value: T, ttlSeconds: number, metadata?: any): Promise<void> {
  const kv = await getKv()
  if (!kv) {
    const cached = memCache.set(key, { data: value, metadata }, ttlSeconds * 1000)
    if (!cached && !warnedOversized) {
      console.warn("[cache] Value exceeded the bounded in-memory cache budget")
      warnedOversized = true
    }
    return
  }

  await kv.put(key, JSON.stringify(value), { expirationTtl: ttlSeconds, metadata })
}

export async function deleteCached(key: string): Promise<void> {
  const kv = await getKv()
  if (!kv) {
    memCache.delete(key)
    return
  }

  await kv.delete(key)
}

export type TextCacheEntry = {
  text: string
  lastModified: string | null
  etag: string | null
  fetchedAt: string | null
  contentHash: string | null
  extractorVersion: number
}

function normalizeTextCacheEntry(value: unknown): TextCacheEntry | null {
  if (typeof value === "string") {
    return {
      text: value,
      lastModified: null,
      etag: null,
      fetchedAt: null,
      contentHash: null,
      extractorVersion: 0,
    }
  }

  if (!value || typeof value !== "object") {
    return null
  }

  const entry = value as {
    text?: unknown
    lastModified?: unknown
    etag?: unknown
    fetchedAt?: unknown
    contentHash?: unknown
    extractorVersion?: unknown
  }
  if (typeof entry.text !== "string") {
    return null
  }

  return {
    text: entry.text,
    lastModified:
      typeof entry.lastModified === "string" && entry.lastModified.trim().length > 0
        ? entry.lastModified
        : null,
    etag: typeof entry.etag === "string" && entry.etag.trim() ? entry.etag : null,
    fetchedAt: typeof entry.fetchedAt === "string" && entry.fetchedAt.trim() ? entry.fetchedAt : null,
    contentHash: typeof entry.contentHash === "string" && entry.contentHash.trim() ? entry.contentHash : null,
    extractorVersion: typeof entry.extractorVersion === "number" ? entry.extractorVersion : 0,
  }
}

export async function getCachedTextEntry(url: string): Promise<TextCacheEntry | null> {
  const hash = await hashText(url)
  const cached = await getCached<unknown>(`text:${hash}`)
  return normalizeTextCacheEntry(cached)
}

export async function getCachedText(url: string): Promise<string | null> {
  const entry = await getCachedTextEntry(url)
  return entry?.text ?? null
}

export async function setCachedTextEntry(
  url: string,
  entry: TextCacheEntry
): Promise<void> {
  const hash = await hashText(url)
  return setCached(`text:${hash}`, entry, 604800)
}

export async function setCachedText(
  url: string,
  text: string,
  lastModified: string | null = null
): Promise<void> {
  return setCachedTextEntry(url, {
    text,
    lastModified,
    etag: null,
    fetchedAt: new Date().toISOString(),
    contentHash: await hashText(text),
    extractorVersion: 0,
  })
}

export async function deleteCachedText(url: string): Promise<void> {
  const hash = await hashText(url)
  await deleteCached(`text:${hash}`)
}

export async function hashText(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16)
}

export function normalizeTextForHash(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

export async function getCachedScan(
  text: string,
  targetClauses: string[] = [],
  strictMode: boolean = false
): Promise<UnifiedScanResult | null> {
  const baseHash = await hashText(normalizeTextForHash(text))
  const modifierHash = targetClauses.length > 0 || strictMode
    ? await hashText(targetClauses.join(",") + "::" + strictMode)
    : ""
  const fullHash = modifierHash ? `${baseHash}-${modifierHash}` : baseHash
  return getCached<UnifiedScanResult>(`${SCAN_CACHE_PREFIX}${fullHash}`)
}

export type CachedScanMetadata = {
  domain: string | null
  title: string | null
  riskScore: number | null
  clauseCount: number
  flaggedCount: number
  source: string
  createdAt: string
}

export async function setCachedScan(
  text: string,
  scan: UnifiedScanResult,
  metadata?: CachedScanMetadata,
  targetClauses: string[] = [],
  strictMode: boolean = false
): Promise<void> {
  const baseHash = await hashText(normalizeTextForHash(text))
  const modifierHash = targetClauses.length > 0 || strictMode
    ? await hashText(targetClauses.join(",") + "::" + strictMode)
    : ""
  const fullHash = modifierHash ? `${baseHash}-${modifierHash}` : baseHash
  return setCached(`${SCAN_CACHE_PREFIX}${fullHash}`, scan, 2592000, metadata)
}

export async function deleteCachedScan(textHash: string): Promise<void> {
  const shortHash = textHash.slice(0, 16)
  await deleteCached(`${SCAN_CACHE_PREFIX}${shortHash}`)
}

export async function deleteCachedScansByTextHash(textHash: string): Promise<void> {
  const prefix = `${SCAN_CACHE_PREFIX}${textHash.slice(0, 16)}`
  let cursor: string | undefined

  do {
    const page = await listCacheKeysByPrefix(prefix, { limit: 1000, cursor })
    await Promise.all(page.keys.map((key) => deleteCached(key.name)))
    cursor = page.list_complete ? undefined : page.cursor
  } while (cursor)
}

export async function isKvAvailable(): Promise<boolean> {
  return (await getKv()) !== null
}

export async function listCacheKeysByPrefix(
  prefix: string,
  options?: { limit?: number; cursor?: string }
) {
  const kv = await getKv()
  if (!kv) {
    const results = []
    for (const [key, entry] of memCache.entries()) {
      if (key.startsWith(prefix)) {
        results.push({
          name: key,
          metadata: entry.metadata as CachedScanMetadata | undefined,
        })
      }
    }
    results.sort((a, b) => {
      const dateA = a.metadata?.createdAt ? new Date(a.metadata.createdAt).getTime() : 0
      const dateB = b.metadata?.createdAt ? new Date(b.metadata.createdAt).getTime() : 0
      return dateB - dateA
    })
    return {
      keys: results.slice(0, options?.limit ?? 1000),
      list_complete: true,
      cursor: undefined,
    }
  }

  return kv.list({ prefix, limit: options?.limit, cursor: options?.cursor })
}

export async function listCachedScans(options?: { limit?: number; cursor?: string }) {
  return listCacheKeysByPrefix(SCAN_CACHE_PREFIX, options)
}
