export type Article = {
  articleId: string
  title: string
  summary: string
  keywords: string[]
}

export type Regulation = {
  id: string
  code: string
  fullName: string
  jurisdiction: string
  category: string
  articles: Article[]
  effectiveDate: string | null
  url: string | null
  isActive: boolean
}

export type ComplianceTag = {
  clauseId: string
  regulationId: string
  regulationCode: string
  regulationFullName: string
  articleId: string
  articleTitle: string | null
  relevance: number
  confidence: number
  quote: string | null
}

export type ComplianceTagRef = {
  regulationCode: string  // e.g., 'GDPR', 'CCPA'
  articleId: string       // e.g., 'Art. 6(1)(a)', '1798.100'
  articleTitle: string    // e.g., 'Lawful basis for processing'
  relevance: number       // 0-1
  quote?: string          // The specific text that violates this regulation
}

export type ComplianceScore = {
  code: string
  fullName: string
  score: number
  violations: number
  potentials: number
  info: number
}

export type SeverityLevel = "warning" | "caution" | "info"

export type TagForScoring = ComplianceTag & {
  severity: SeverityLevel
}

export const KNOWN_CODES = new Map<string, string>([
  ["GDPR", "GDPR"],
  ["CCPA", "CCPA"],
  ["CPRA", "CPRA"],
  ["COPPA", "COPPA"],
  ["CAN_SPAM", "CAN_SPAM"],
  ["CAN-SPAM", "CAN_SPAM"],
  ["FTC_ACT", "FTC_ACT"],
  ["FTC ACT", "FTC_ACT"],
  ["ECPA", "ECPA"],
  ["PIPEDA", "PIPEDA"],
  ["UK_DPA", "UK_DPA"],
  ["UK DPA", "UK_DPA"],
  ["AU_PRIVACY", "AU_PRIVACY"],
  ["AU PRIVACY", "AU_PRIVACY"],
  ["DSA", "DSA"],
  ["DMA", "DMA"],
  ["EU_ECOMMERCE", "EU_ECOMMERCE"],
  ["EU ECOMMERCE", "EU_ECOMMERCE"],
  ["LGPD", "LGPD"],
])

export function normalizeRegulationCode(raw: string): string {
  const trimmed = raw.trim()
  const upper = trimmed.toUpperCase()

  for (const [alias, canonical] of KNOWN_CODES) {
    if (alias.toUpperCase() === upper) return canonical
  }

  return trimmed.toUpperCase()
}

export function validateComplianceTagsSync(
  tags: ComplianceTagRef[],
  minRelevance: number = 0.5
): ComplianceTagRef[] {
  if (!Array.isArray(tags)) return []

  const result: ComplianceTagRef[] = []

  for (const tag of tags) {
    const normalizedCode = normalizeRegulationCode(tag.regulationCode)
    if (!KNOWN_CODES.has(normalizedCode)) continue

    const relevance = Math.max(0, Math.min(1, tag.relevance ?? 0))
    if (relevance < minRelevance) continue

    result.push({
      regulationCode: normalizedCode,
      articleId: tag.articleId ?? "",
      articleTitle: tag.articleTitle ?? "",
      relevance,
      quote: tag.quote,
    })
  }

  return result
}
