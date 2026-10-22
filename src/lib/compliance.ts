import "server-only"

import { getDatabase } from "@/lib/database"

import {
  type Article,
  type Regulation,
  type ComplianceTag,
  type ComplianceTagRef,
  type ComplianceScore,
  type SeverityLevel,
  type TagForScoring,
  KNOWN_CODES,
  normalizeRegulationCode,
} from "./compliance-shared"
export * from "./compliance-shared"

function mapRegulation(row: Record<string, unknown>): Regulation {
  return {
    id: row.id as string,
    code: row.code as string,
    fullName: row.full_name as string,
    jurisdiction: row.jurisdiction as string,
    category: row.category as string,
    articles: (row.articles ?? []) as Article[],
    effectiveDate: (row.effective_date as string) ?? null,
    url: (row.url as string) ?? null,
    isActive: (row.is_active as boolean) ?? true,
  }
}

function mapComplianceTag(row: Record<string, unknown>): ComplianceTag {
  const regulation = row.regulation as Record<string, unknown> | undefined
  return {
    clauseId: row.clause_id as string,
    regulationId: row.regulation_id as string,
    regulationCode: (regulation?.code as string) ?? '',
    regulationFullName: (regulation?.full_name as string) ?? '',
    articleId: row.article_id as string,
    articleTitle: (row.article_title as string) ?? null,
    relevance: Number(row.relevance),
    confidence: Number(row.confidence),
    quote: (row.quote as string) ?? null,
  }
}

// ---------------------------------------------------------------------------
// Query functions
// ---------------------------------------------------------------------------

/** Fetch all active regulations. */
export async function getRegulations(): Promise<Regulation[]> {
  const db = getDatabase()
  const { data, error } = await db
    .from("regulations")
    .select("id, code, full_name, jurisdiction, category, effective_date, url, is_active")
    .eq("is_active", true)
    .order("code")

  if (error) throw new Error(`getRegulations: ${error.message}`)
  return (data ?? []).map(mapRegulation)
}

/** Fetch active regulations filtered by jurisdiction. */
export async function getRegulationsByJurisdiction(
  jurisdiction: string
): Promise<Regulation[]> {
  const db = getDatabase()
  const { data, error } = await db
    .from("regulations")
    .select("*")
    .eq("is_active", true)
    .eq("jurisdiction", jurisdiction)
    .order("code")

  if (error)
    throw new Error(`getRegulationsByJurisdiction: ${error.message}`)
  return (data ?? []).map(mapRegulation)
}

/** Get all compliance tags for a single clause. */
export async function getComplianceTagsForClause(
  clauseId: string
): Promise<ComplianceTag[]> {
  const db = getDatabase()
  const { data, error } = await db
    .from("clause_compliance_tags")
    .select("*")
    .eq("clause_id", clauseId)

  if (error)
    throw new Error(`getComplianceTagsForClause: ${error.message}`)
  return (data ?? []).map(mapComplianceTag)
}

/** Get all compliance tags for every clause in a scan. */
export async function getComplianceTagsForScan(
  scanId: string,
  knownClauseIds?: string[],
): Promise<ComplianceTag[]> {
  const db = getDatabase()

  let clauseIds = knownClauseIds
  if (!clauseIds) {
    const { data: clauses, error: clauseErr } = await db
      .from("clauses")
      .select("id")
      .eq("scan_id", scanId)

    if (clauseErr)
      throw new Error(`getComplianceTagsForScan (clauses): ${clauseErr.message}`)

    clauseIds = (clauses ?? []).map((c: Record<string, unknown>) => c.id as string)
  }
  if (clauseIds.length === 0) return []

  const { data, error } = await db
    .from("clause_compliance_tags")
    .select("*, regulation:regulations(code, full_name)")
    .in("clause_id", clauseIds)

  if (error)
    throw new Error(`getComplianceTagsForScan (tags): ${error.message}`)
  return (data ?? []).map(mapComplianceTag)
}

/** Insert a single compliance tag linking a clause to a regulation article. */
export async function createComplianceTag(
  clauseId: string,
  regulationId: string,
  articleId: string,
  articleTitle: string | null,
  relevance: number,
  confidence: number
): Promise<ComplianceTag> {
  const db = getDatabase()
  const { data, error } = await db
    .from("clause_compliance_tags")
    .insert({
      clause_id: clauseId,
      regulation_id: regulationId,
      article_id: articleId,
      article_title: articleTitle,
      relevance,
      confidence,
    })
    .select()
    .single()

  if (error) throw new Error(`createComplianceTag: ${error.message}`)
  return mapComplianceTag(data as unknown as Record<string, unknown>)
}

/** Bulk-insert compliance tags for a clause. Returns inserted tags. */
export async function createComplianceTags(
  clauseId: string,
  tags: Array<{
    regulationId: string
    articleId: string
    articleTitle?: string | null
    relevance?: number
    confidence?: number
  }>
): Promise<ComplianceTag[]> {
  if (tags.length === 0) return []

  const db = getDatabase()
  const rows = tags.map((t) => ({
    clause_id: clauseId,
    regulation_id: t.regulationId,
    article_id: t.articleId,
    article_title: t.articleTitle ?? null,
    relevance: t.relevance ?? 0.8,
    confidence: t.confidence ?? 0.7,
  }))

  const { data, error } = await db
    .from("clause_compliance_tags")
    .insert(rows)
    .select()

  if (error) throw new Error(`createComplianceTags: ${error.message}`)
  return (data ?? []).map(mapComplianceTag)
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/**
 * Compute per-regulation compliance scores from tagged findings.
 *
 * Tags must include a `severity` field:
 *  - "warning" (violation):  −15 points per tag
 *  - "caution" (potential):   −8 points per tag
 *  - "info":                  −2 points per tag
 *
 * Score starts at 100 per regulation, floor at 0.
 */
export function calculateComplianceScore(
  tags: TagForScoring[],
  regulations: Regulation[]
): ComplianceScore[] {
  // Build a lookup from regulation code → Regulation
  const regMap = new Map<string, Regulation>()
  for (const reg of regulations) {
    regMap.set(reg.id, reg)
  }

  // Group tags by regulation
  const byRegulation = new Map<string, TagForScoring[]>()
  for (const tag of tags) {
    const list = byRegulation.get(tag.regulationId) ?? []
    list.push(tag)
    byRegulation.set(tag.regulationId, list)
  }

  // Build scores for each regulation that has tags
  const scores: ComplianceScore[] = []

  for (const [regulationId, regTags] of byRegulation) {
    const reg = regMap.get(regulationId)
    if (!reg) continue

    let violations = 0
    let potentials = 0
    let info = 0

    for (const tag of regTags) {
      switch (tag.severity) {
        case "warning":
          violations++
          break
        case "caution":
          potentials++
          break
        case "info":
          info++
          break
      }
    }

    const raw = 100 - violations * 15 - potentials * 8 - info * 2
    const score = Math.max(0, raw)

    scores.push({
      code: reg.code,
      fullName: reg.fullName,
      score,
      violations,
      potentials,
      info,
    })
  }

  return scores.sort((a, b) => a.score - b.score)
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate and clean compliance tags from LLM output against the regulations DB.
 *
 * 1. Normalizes regulation codes to match DB codes.
 * 2. Filters out tags whose regulation code does not exist in the DB.
 * 3. Returns only valid tags with resolved regulation IDs.
 */
export function validateComplianceTags(
  rawTags: Array<{
    regulationCode: string
    articleId: string
    articleTitle?: string | null
    relevance?: number
    confidence?: number
    severity?: SeverityLevel
  }>,
  regulations: Regulation[]
): Array<{
  regulationId: string
  regulationCode: string
  articleId: string
  articleTitle: string | null
  relevance: number
  confidence: number
  severity: SeverityLevel
}> {
  // Build code → regulation lookup
  const regByCode = new Map<string, Regulation>()
  for (const reg of regulations) {
    regByCode.set(reg.code, reg)
  }

  const valid: Array<{
    regulationId: string
    regulationCode: string
    articleId: string
    articleTitle: string | null
    relevance: number
    confidence: number
    severity: SeverityLevel
  }> = []

  for (const tag of rawTags) {
    const normalizedCode = normalizeRegulationCode(tag.regulationCode)
    const reg = regByCode.get(normalizedCode)

    // Skip tags for unknown regulations
    if (!reg) continue

    valid.push({
      regulationId: reg.id,
      regulationCode: reg.code,
      articleId: tag.articleId,
      articleTitle: tag.articleTitle ?? null,
      relevance: tag.relevance ?? 0.8,
      confidence: tag.confidence ?? 0.7,
      severity: tag.severity ?? "info",
    })
  }

  return valid
}
