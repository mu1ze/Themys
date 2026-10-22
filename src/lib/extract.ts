import { getCachedTextEntry, hashText, setCachedTextEntry, type TextCacheEntry } from "@/lib/cache"
import {
  fetchPublicUrl,
  normalizePublicHttpUrl,
  readResponseText,
  validatePublicHttpUrl,
} from "@/lib/url-security"
import { getRuntimeEnvironment } from "@/lib/runtime-env"

const JINA_BASE_URL = "https://r.jina.ai"
const JINA_MARKER = "Markdown Content:"
const MAX_EXTRACT_BYTES = 2 * 1024 * 1024
const EXTRACTOR_VERSION = 1
const UNVALIDATED_CACHE_FRESHNESS_MS = 6 * 60 * 60 * 1000

type ExtractOptions = {
  validators?: UrlValidators | null
}

type UrlValidators = {
  etag: string | null
  lastModified: string | null
  notModified: boolean
}

export type ExtractTextResult = {
  text: string
  source: "jina" | "fallback"
  wordCount: number
  lastModified: string | null
  etag: string | null
  fetchedAt: string
  contentHash: string
  extractorVersion: number
}

type ExtractedTextBase = Omit<ExtractTextResult, "source">

export type ResolvedUrlTextResult = ExtractedTextBase & {
  source: "cache" | "jina" | "fallback"
  cached: boolean
  revalidated: boolean
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
}

function stripHtml(html: string): string {
  let clean = html
    .replace(/<head\b[^>]*>([\s\S]*?)<\/head>/gi, "")
    .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, "")
    .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, "")
    .replace(/<noscript\b[^>]*>([\s\S]*?)<\/noscript>/gi, "")
    .replace(/<!--([\s\S]*?)-->/g, "")
    .replace(/<(nav|footer|header|uhf-header|uhf-footer)\b[^>]*>([\s\S]*?)<\/\1>/gi, "")

  clean = clean
    .replace(/<(h[1-6]|p|div|section|article|li|tr)[^>]*>/gi, "\n\n")
    .replace(/<\/(h[1-6]|p|div|section|article|li|tr)>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, " ")

  return decodeHtmlEntities(clean)
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}

function normalizeLastModified(value: string | null): string | null {
  if (!value) return null

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }

  return parsed.toUTCString()
}

async function getUrlValidators(
  url: string,
  cached?: Pick<TextCacheEntry, "etag" | "lastModified"> | null,
): Promise<UrlValidators | null> {
  try {
    const headers = new Headers()
    if (cached?.etag) headers.set("If-None-Match", cached.etag)
    if (cached?.lastModified) headers.set("If-Modified-Since", cached.lastModified)
    const res = await fetchPublicUrl(url, { method: "HEAD", headers })

    if (res.status === 304) {
      return {
        etag: res.headers.get("etag")?.trim() || cached?.etag || null,
        lastModified: normalizeLastModified(res.headers.get("last-modified")) || cached?.lastModified || null,
        notModified: true,
      }
    }

    if (!res.ok && res.status !== 405 && res.status !== 501) {
      return null
    }
    if (res.status === 405 || res.status === 501) return null

    return {
      etag: res.headers.get("etag")?.trim() || null,
      lastModified: normalizeLastModified(res.headers.get("last-modified")),
      notModified: false,
    }
  } catch {
    return null
  }
}

export async function getLastModified(url: string): Promise<string | null> {
  return (await getUrlValidators(url))?.lastModified ?? null
}

export function cleanText(raw: string): string {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => {
      const lower = l.toLowerCase()
      if (lower.startsWith("cookie") && lower.includes("preference")) return false
      if (lower.includes("accept all") || lower.includes("reject all")) return false
      if (l.length < 60 && lower.includes("privacy policy") && lower.includes("terms")) return false
      if (l.length < 60 && (lower.includes("©") || lower.includes("all rights reserved"))) return false
      if (lower.startsWith("javascript required") || lower.startsWith("please enable javascript")) return false
      if (lower.startsWith("this is the trace id")) return false
      return true
    })
    .join("\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+\n/g, "\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

async function fetchViaJina(url: string): Promise<string> {
  const key = getRuntimeEnvironment().JINA_READER_KEY
  if (!key) {
    throw new Error("JINA_READER_KEY environment variable is not set")
  }

  const safeUrl = await validatePublicHttpUrl(url)
  const targetUrl = `${JINA_BASE_URL}/${encodeURI(safeUrl.href)}`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  const res = await fetch(targetUrl, {
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: "text/plain",
    }, signal: controller.signal,
  }).finally(() => clearTimeout(timeout))

  if (!res.ok) {
    throw new Error(`Jina API responded with status ${res.status}`)
  }

  const raw = await readResponseText(res, MAX_EXTRACT_BYTES, ["text/plain", "text/markdown"])
  const markerIndex = raw.indexOf(JINA_MARKER)
  if (markerIndex !== -1) {
    return raw.slice(markerIndex + JINA_MARKER.length).trim()
  }

  return raw
}

async function fetchViaFallback(url: string): Promise<string> {
  const res = await fetchPublicUrl(url)
  if (!res.ok) {
    throw new Error(`Fallback fetch responded with status ${res.status}`)
  }
  const html = await readResponseText(res, MAX_EXTRACT_BYTES, ["text/html", "text/plain", "application/xhtml+xml"])
  return stripHtml(html)
}

export async function extractText(
  url: string,
  options: ExtractOptions = {}
): Promise<ExtractTextResult> {
  if (!url) {
    throw new Error("URL is required")
  }
  const normalizedUrl = (await validatePublicHttpUrl(url)).href

  let raw: string
  let source: "jina" | "fallback"

  try {
    raw = await fetchViaJina(normalizedUrl)
    if (
      raw.length < 500 ||
      raw.includes("A 1x1 image") ||
      raw.includes("tacker probe") ||
      raw.includes("tracker probe") ||
      raw.includes("Attention Required! | Cloudflare")
    ) {
      throw new Error(`Jina returned stub or suspicious content (${raw.length} chars)`)
    }
    source = "jina"
  } catch {
    try {
      raw = await fetchViaFallback(normalizedUrl)
      source = "fallback"
    } catch (err) {
      throw new Error(
        `Failed to extract text: ${err instanceof Error ? err.message : "Unknown error"}`
      )
    }
  }

  const text = cleanText(raw)
  const wordCount = countWords(text)
  const validators = options.validators === undefined
    ? await getUrlValidators(normalizedUrl)
    : options.validators

  return {
    text,
    source,
    wordCount,
    lastModified: validators?.lastModified ?? null,
    etag: validators?.etag ?? null,
    fetchedAt: new Date().toISOString(),
    contentHash: await hashText(text),
    extractorVersion: EXTRACTOR_VERSION,
  }
}

export async function resolveTextFromUrl(url: string): Promise<ResolvedUrlTextResult> {
  if (!url) {
    throw new Error("URL is required")
  }

  const normalizedUrl = (await validatePublicHttpUrl(url)).href
  const cached = await getCachedTextEntry(normalizedUrl)
  const cacheVersionMatches = cached?.extractorVersion === EXTRACTOR_VERSION
  const fetchedAt = cached?.fetchedAt ? Date.parse(cached.fetchedAt) : Number.NaN
  const isFresh = Number.isFinite(fetchedAt)
    && Date.now() - fetchedAt < UNVALIDATED_CACHE_FRESHNESS_MS

  if (cached && cacheVersionMatches && isFresh) {
    return {
      text: cached.text,
      source: "cache",
      wordCount: countWords(cached.text),
      lastModified: cached.lastModified,
      etag: cached.etag,
      fetchedAt: cached.fetchedAt ?? new Date().toISOString(),
      contentHash: cached.contentHash ?? await hashText(cached.text),
      extractorVersion: cached.extractorVersion,
      cached: true,
      revalidated: false,
    }
  }

  const validators = await getUrlValidators(normalizedUrl, cached)
  const validatorsMatch = Boolean(
    cached
    && cacheVersionMatches
    && (
      validators?.notModified
      || (cached.etag && validators?.etag
        ? cached.etag === validators.etag
        : cached.lastModified
          && validators?.lastModified
          && cached.lastModified === validators.lastModified)
    ),
  )
  if (cached && (validatorsMatch || (!validators && isFresh))) {
    const refreshedAt = new Date().toISOString()
    return {
      text: cached.text,
      source: "cache",
      wordCount: countWords(cached.text),
      lastModified: validators?.lastModified ?? cached.lastModified,
      etag: validators?.etag ?? cached.etag,
      fetchedAt: refreshedAt,
      contentHash: cached.contentHash ?? await hashText(cached.text),
      extractorVersion: cached.extractorVersion,
      cached: true,
      revalidated: true,
    }
  }

  const result = await extractText(normalizedUrl, { validators })
  return {
    ...result,
    cached: false,
    revalidated: false,
  }
}

export async function storeResolvedText(url: string, result: ResolvedUrlTextResult): Promise<void> {
  if (result.cached && !result.revalidated) return

  const normalizedUrl = normalizePublicHttpUrl(url).href
  await setCachedTextEntry(normalizedUrl, {
    text: result.text,
    lastModified: result.lastModified,
    etag: result.etag,
    fetchedAt: result.fetchedAt,
    contentHash: result.contentHash,
    extractorVersion: result.extractorVersion,
  })
}
