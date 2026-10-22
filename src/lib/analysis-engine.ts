import { validateComplianceTagsSync, type ComplianceTagRef } from "@/lib/compliance-shared"
import { getCached, hashText, setCached } from "@/lib/cache"

export type RiskCategory =
  | "data_sharing"
  | "arbitration"
  | "auto_renewal"
  | "content_license"
  | "no_opt_out"
  | "class_waiver"
  | "termination"
  | "location_tracking"

export type RiskLevel = "green" | "yellow" | "red"
export type ExplanationSource = "prebuilt" | "llm" | "fallback" | "prebuilt-limit" | "llm-credit"

export type ClauseAnalysis = {
  id: string
  text: string
  fullClauseText: string
  category: string
  categoryLabel: string
  riskScore: number
  riskLevel: RiskLevel
  confidence: number
  keywords: string[]
  explanation: string
  whyItMatters: string
  recommendedAction: string
  source: ExplanationSource
  isStandardPractice?: boolean
  isTargetClause?: boolean
}

export type TosdrPoint = {
  id?: number
  title: string
  classification?: string
  topic?: string
  source?: string
}

export type TosdrLookup = {
  matched: boolean
  rating: string | null
  name: string | null
  slug: string | null
  points: TosdrPoint[]
}

export type EngineAnalysisResult = {
  riskScore: number
  riskLevel: RiskLevel
  summary: string
  flags: ClauseAnalysis[]
  clauses: Array<{
    id: string
    text: string
    position?: number
    keywords: string[]
    matchedCategory: string | null
    confidence: number
    riskScore: number
    riskLevel: RiskLevel
    isStandardPractice?: boolean
    isTargetClause?: boolean
  }>
  tosdr: TosdrLookup | null
  stats: {
    totalClauses: number
    flaggedClauses: number
    highConfidenceClauses: number
    llmRoutedClauses: number
  }
  model: string
  tier: number
}

const TOSDR_TIMEOUT_MS = 5_000
const MIN_CLAUSE_LENGTH = 45

export function getRiskLevel(score: number): RiskLevel {
  if (score <= 3) return "green"
  if (score <= 6) return "yellow"
  return "red"
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function normalizeScore(score: number): number {
  return Math.round(clamp(score, 1, 10) * 10) / 10
}

export function normalizeClauseSignature(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim()
    .replace(/^[\s"'“”‘’\(\[\{]+/, "")
    .replace(/^(?:(?:\d+|[a-zA-Z]|[IVXLC]+)[.)]|[-*•]+)\s+/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function dedupeByText<T>(items: T[], getText: (item: T) => string): T[] {
  const seen = new Set<string>()
  const deduped: T[] = []

  for (const item of items) {
    const signature = normalizeClauseSignature(getText(item))
    if (!signature || seen.has(signature)) continue
    seen.add(signature)
    deduped.push(item)
  }

  return deduped
}

export function mapCategoryToCanonical(category: string | null): RiskCategory | null {
  if (!category) return null
  const normalized = category.toLowerCase().trim()

  if (normalized === "data_sharing") return "data_sharing"
  if (normalized === "arbitration") return "arbitration"
  if (normalized === "auto_renewal") return "auto_renewal"
  if (normalized === "content_license") return "content_license"
  if (normalized === "no_opt_out") return "no_opt_out"
  if (normalized === "class_waiver") return "class_waiver"
  if (normalized === "termination") return "termination"
  if (normalized === "location_tracking") return "location_tracking"

  if (normalized.includes("arbitrat") || normalized.includes("dispute")) {
    return "arbitration"
  }
  if (
    normalized.includes("class action") ||
    normalized.includes("class waiver") ||
    normalized.includes("jury trial") ||
    normalized.includes("waiver")
  ) {
    return "class_waiver"
  }
  if (
    normalized.includes("share") ||
    normalized.includes("sharing") ||
    normalized.includes("third party") ||
    normalized.includes("third-party") ||
    normalized.includes("sell") ||
    normalized.includes("selling") ||
    normalized.includes("partners") ||
    normalized.includes("affiliates") ||
    normalized.includes("advertising") ||
    normalized.includes("privacy")
  ) {
    return "data_sharing"
  }
  if (
    normalized.includes("renew") ||
    normalized.includes("recurring") ||
    normalized.includes("subscription") ||
    normalized.includes("billing")
  ) {
    return "auto_renewal"
  }
  if (
    normalized.includes("license") ||
    normalized.includes("copyright") ||
    normalized.includes("intellectual property") ||
    normalized.includes("user content") ||
    normalized.includes("content")
  ) {
    return "content_license"
  }
  if (normalized.includes("opt-out") || normalized.includes("optout") || normalized.includes("opt out")) {
    return "no_opt_out"
  }
  if (
    normalized.includes("terminat") ||
    normalized.includes("cancel") ||
    normalized.includes("suspension") ||
    normalized.includes("deactivate")
  ) {
    return "termination"
  }
  if (
    normalized.includes("location") ||
    normalized.includes("tracking") ||
    normalized.includes("gps") ||
    normalized.includes("geo")
  ) {
    return "location_tracking"
  }

  return null
}

export function buildSummary(flags: ClauseAnalysis[], tosdr: TosdrLookup | null): string {
  if (flags.length === 0) {
    const tosdrPart = tosdr?.matched && tosdr.rating
      ? ` ToS;DR currently rates this service ${tosdr.rating}.`
      : ""
    return `No high-confidence risky clauses were detected.${tosdrPart} A manual review is still recommended for unusual or newly updated terms.`
  }

  const highest = [...flags].sort((a, b) => b.riskScore - a.riskScore)[0]
  const categories = Array.from(new Set(flags.slice(0, 3).map((flag) => flag.categoryLabel)))
  const tosdrPart = tosdr?.matched && tosdr.rating
    ? ` ToS;DR rates the matched service ${tosdr.rating}, which is included as external context.`
    : ""

  return `Detected ${flags.length} flagged clauses, led by ${highest.categoryLabel.toLowerCase()}. The main review areas are ${categories.join(", ")}.${tosdrPart}`
}

export function calculateDocumentScore(flags: ClauseAnalysis[], tosdr: TosdrLookup | null): number {
  if (flags.length === 0) {
    return tosdr?.rating ? tosdrRatingToScore(tosdr.rating) : 2
  }

  const totalWeight = flags.reduce((sum, flag) => sum + flag.confidence, 0)
  const weightedScore = flags.reduce(
    (sum, flag) => sum + flag.riskScore * flag.confidence,
    0
  ) / Math.max(totalWeight, 0.1)

  const tosdrScore = tosdr?.rating ? tosdrRatingToScore(tosdr.rating) : null
  const blended = tosdrScore ? weightedScore * 0.8 + tosdrScore * 0.2 : weightedScore

  return normalizeScore(blended)
}

function tosdrRatingToScore(rating: string): number {
  const normalized = rating.toUpperCase()
  const scores: Record<string, number> = {
    A: 2,
    B: 3.5,
    C: 5,
    D: 7,
    E: 9,
  }

  return scores[normalized] ?? 5
}

export function inferDomain(urlOrDomain?: string | null): string | null {
  if (!urlOrDomain) return null

  try {
    return new URL(urlOrDomain).hostname.replace(/^www\./, "")
  } catch {
    return urlOrDomain.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] || null
  }
}

function slugFromDomain(domain: string): string {
  return domain.split(".")[0].toLowerCase()
}

function normalizeTosdrRating(rating: unknown): string | null {
  if (typeof rating !== "string") return null
  const normalized = rating.trim().toUpperCase()
  if (!["A", "B", "C", "D", "E"].includes(normalized)) return null
  return normalized
}

function isExactTosdrMatch(service: Record<string, unknown>, slug: string): boolean {
  const serviceSlug = typeof service.slug === "string" ? service.slug.toLowerCase() : ""
  const serviceName = typeof service.name === "string" ? service.name.toLowerCase() : ""
  const urls = Array.isArray(service.urls)
    ? service.urls.filter((url): url is string => typeof url === "string")
    : []

  return (
    serviceSlug === slug ||
    serviceName === slug ||
    serviceName.replace(/\s+/g, "") === slug ||
    urls.some((url) => url.replace(/^www\./, "").split("/")[0].split(".")[0] === slug)
  )
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(timeoutId)
  }
}

function normalizeTosdrPoints(data: unknown): TosdrPoint[] {
  if (!data || typeof data !== "object") return []
  const points = "points" in data ? (data as { points?: unknown }).points : null
  if (!Array.isArray(points)) return []

  return points.slice(0, 12).map((point) => {
    const pointData = point && typeof point === "object" ? point as Record<string, unknown> : {}
    const caseData =
      pointData.case && typeof pointData.case === "object"
        ? pointData.case as Record<string, unknown>
        : {}

    return {
      id: typeof pointData.id === "number" ? pointData.id : undefined,
      title: typeof pointData.title === "string" ? pointData.title : "Untitled ToS;DR point",
      classification:
        typeof caseData.classification === "string" ? caseData.classification : undefined,
      topic: typeof caseData.topic === "string" ? caseData.topic : undefined,
      source: typeof pointData.source === "string" ? pointData.source : undefined,
    }
  })
}

function unwrapTosdrService(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== "object") return null

  const dataObject = data as Record<string, unknown>
  const parameters =
    dataObject.parameters && typeof dataObject.parameters === "object"
      ? dataObject.parameters as Record<string, unknown>
      : null

  return parameters ?? dataObject
}

async function fetchTosdrServiceById(id: unknown): Promise<Record<string, unknown> | null> {
  if (typeof id !== "number" && typeof id !== "string") return null

  try {
    const response = await fetchWithTimeout(
      `https://api.tosdr.org/service/v2/?id=${encodeURIComponent(String(id))}`,
      TOSDR_TIMEOUT_MS
    )
    if (!response.ok) return null

    return unwrapTosdrService(await response.json())
  } catch {
    return null
  }
}

export async function lookupTosdr(domain: string | null): Promise<TosdrLookup | null> {
  if (!domain) return null

  const slug = slugFromDomain(domain)
  const cacheKey = `tosdr:v1:${await hashText(slug)}`
  try {
    const cached = await getCached<TosdrLookup>(cacheKey)
    if (cached) return cached
  } catch {
    // Third-party enrichment must remain best-effort if the cache binding is
    // unavailable in a local or partially configured runtime.
  }

  const candidates = [
    `https://api.tosdr.org/search/v5/?query=${encodeURIComponent(slug)}`,
    `https://api.tosdr.org/service/v2/?query=${encodeURIComponent(domain)}`,
  ]

  for (const candidate of candidates) {
    try {
      const response = await fetchWithTimeout(candidate, TOSDR_TIMEOUT_MS)
      if (!response.ok) continue

      const data = await response.json()
      const dataObject = data && typeof data === "object" ? data as Record<string, unknown> : {}
      const parameters =
        dataObject.parameters && typeof dataObject.parameters === "object"
          ? dataObject.parameters as Record<string, unknown>
          : {}
      const services = Array.isArray(dataObject.services)
        ? dataObject.services
        : Array.isArray(parameters.services)
          ? parameters.services
          : null
      const service = services ? services[0] : data

      if (!service || typeof service !== "object") continue

      const serviceData = service as Record<string, unknown>
      if (services && !isExactTosdrMatch(serviceData, slug)) {
        continue
      }

      const detailedService = await fetchTosdrServiceById(serviceData.id)
      const resolvedService = detailedService ?? serviceData
      const rating = normalizeTosdrRating(resolvedService.rating ?? resolvedService.class)

      const result = {
        matched: Boolean(
          (resolvedService.id || resolvedService.slug || rating) && (rating || resolvedService.slug)
        ),
        rating,
        name: typeof resolvedService.name === "string" ? resolvedService.name : null,
        slug: typeof resolvedService.slug === "string" ? resolvedService.slug : slug,
        points: normalizeTosdrPoints(resolvedService),
      }
      await setCached(cacheKey, result, 86_400).catch(() => undefined)
      return result
    } catch {
      continue
    }
  }

  const result = {
    matched: false,
    rating: null,
    name: null,
    slug,
    points: [],
  }
  await setCached(cacheKey, result, 86_400).catch(() => undefined)
  return result
}

/**
 * Validates compliance tags on an array of flagged items.
 * Normalizes regulation codes and filters out tags with relevance < 0.5.
 * Generic to avoid circular dependency with llm.ts's ClauseFlag type.
 */
export function validateFlagCompliance<T extends { complianceTags?: ComplianceTagRef[] }>(
  flags: T[]
): T[] {
  return flags.map((flag) => {
    if (!flag.complianceTags || flag.complianceTags.length === 0) {
      return flag
    }
    return {
      ...flag,
      complianceTags: validateComplianceTagsSync(flag.complianceTags, 0.5),
    }
  })
}
