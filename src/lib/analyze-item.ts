import "server-only"

import { getCachedScan, setCachedScan } from "@/lib/cache"
import { shouldUsePublicScanCache, type ScanSource } from "@/lib/contract-upload"
import { resolveTextFromUrl, storeResolvedText } from "@/lib/extract"
import { analyzeTerms, fullExtraction } from "@/lib/llm"
import type { AnalysisResult, FullExtractionSection } from "@/lib/llm"
import { identifyDocument, type DocumentIdentity } from "@/lib/document-identity"
import { assertAnalysisTextSize } from "@/lib/analysis-limits"

export type AnalyzeItemInput = {
  text?: string
  url?: string
  sourceUrl?: string
  domain?: string
}

export type AnalyzeItemOptions = {
  bypassCache?: boolean
  scanSource?: ScanSource
  targetClauses?: string[]
  strictMode?: boolean
  userContext?: { userId: string; tier: "free" | "base" | "advanced" | "lifetime" }
  beforeProvider?: () => Promise<void>
}

export type AnalyzeItemOutput = {
  result: AnalysisResult
  fullExtraction: FullExtractionSection[] | null
  document: DocumentIdentity
  text: string
  documentUrl: string | null
  source: ScanSource
  cached: boolean
}

export class AnalysisProviderError extends Error {
  constructor() {
    super("Analysis provider unavailable")
    this.name = "AnalysisProviderError"
  }
}

/**
 * Canonical server-only analysis pipeline used by both single and batch APIs.
 * Authentication, quota reservation, settlement, and persistence remain route
 * concerns; extraction, options, caching, and provider behavior live here.
 */
export async function analyzeItem(
  input: AnalyzeItemInput,
  options: AnalyzeItemOptions = {},
): Promise<AnalyzeItemOutput> {
  const pastedText = input.text?.trim() ?? ""
  const termsUrl = input.url?.trim() ?? ""
  const sourceUrl = input.sourceUrl?.trim() ?? ""
  const domain = input.domain?.trim() ?? ""
  const documentUrl = termsUrl || sourceUrl || null
  const targetClauses = options.targetClauses ?? []
  const strictMode = options.strictMode ?? false

  let text = pastedText
  let source: ScanSource = options.scanSource ?? "paste"

  if (termsUrl) {
    const resolved = await resolveTextFromUrl(termsUrl)
    text = resolved.text.trim()
    source = "web"
    if (!text) throw new Error("Empty extracted text")

    assertAnalysisTextSize(text, resolved.cached ? "cached-url" : "url")

    try {
      await storeResolvedText(termsUrl, resolved)
    } catch (error) {
      console.warn(
        "[analyze-item] URL cache write skipped",
        error instanceof Error ? error.name : "UnknownError",
      )
    }
  }

  if (!text) throw new Error("Analysis text is empty")
  if (!termsUrl) {
    assertAnalysisTextSize(text, source === "upload" ? "upload" : "paste")
  }

  const document = identifyDocument({ text, url: documentUrl })

  const usePublicCache = shouldUsePublicScanCache(source) && !options.bypassCache
  const cached = usePublicCache
    ? await getCachedScan(text, targetClauses, strictMode)
    : null
  const requiredEnrichmentVersion = strictMode ? 7 : 4
  if (cached?.enrichmentVersion === requiredEnrichmentVersion && cached.fullExtraction?.length) {
    return {
      result: { ...cached.result, jevDiagnostics: undefined },
      fullExtraction: cached.fullExtraction,
      document,
      text,
      documentUrl,
      source,
      cached: true,
    }
  }

  await options.beforeProvider?.()

  let result: AnalysisResult
  let extraction: FullExtractionSection[]
  try {
    ;[result, extraction] = await Promise.all([
      analyzeTerms(text, {
        url: documentUrl,
        domain: domain || null,
        userContext: options.userContext,
        targetClauses,
        strictMode,
      }),
      fullExtraction(text),
    ])
  } catch (error) {
    if (error instanceof Error && error.name === "StrictScanProviderError") {
      throw new AnalysisProviderError()
    }
    throw error
  }

  if (result.model === "fallback" || extraction.length === 0) throw new AnalysisProviderError()

  const fullExtractionSections = extraction.length > 0 ? extraction : null
  if (usePublicCache) {
    try {
      await setCachedScan(
        text,
        { result, fullExtraction: fullExtractionSections, enrichmentVersion: requiredEnrichmentVersion },
        {
          domain: domain || null,
          title: documentUrl || domain || null,
          riskScore: result.riskScore,
          clauseCount: result.clauses.length,
          flaggedCount: result.flags.length,
          source,
          createdAt: new Date().toISOString(),
        },
        targetClauses,
        strictMode,
      )
    } catch (error) {
      console.warn(
        "[analyze-item] Scan cache write skipped",
        error instanceof Error ? error.name : "UnknownError",
      )
    }
  }

  return {
    result,
    fullExtraction: fullExtractionSections,
    document,
    text,
    documentUrl,
    source,
    cached: false,
  }
}
