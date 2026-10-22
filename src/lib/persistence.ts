import "server-only"

import { createHash, randomUUID } from "node:crypto"
import { revalidateTag } from "next/cache"
import { clerkClient } from "@clerk/nextjs/server"

import type { AnalysisResult, FullExtractionSection } from "@/lib/llm"
import { dedupeByText, type ClauseAnalysis } from "@/lib/analysis-engine"
import type { ScanDecision } from "@/lib/decisions"
import { getRateLimitStatus, type RateLimitTier, type RateLimitResult } from "@/lib/rate-limit"
import type { PlaybookId } from "@/lib/playbooks"
import type { DocumentIdentity } from "@/lib/document-identity"
import { DOCUMENT_TYPES, type DocumentType } from "@/lib/document-types"
import { getDatabase } from "@/lib/database"
import {
  deleteScanDocument,
  readScanDocument,
  storeScanDocument,
} from "@/lib/object-storage"

type PersistedAnalysisInput = {
  clerkId: string
  email: string
  text: string
  title?: string | null
  url?: string | null
  domain?: string | null
  country?: string | null
  state?: string | null
  source?: "web" | "extension" | "paste" | "upload"
  result: AnalysisResult
  fullExtraction?: FullExtractionSection[] | null
  document: DocumentIdentity
  isMonitoringScan?: boolean
  previousScanId?: string | null
  createdAt?: string
}

export type UserProfileRecord = {
  id: string
  clerkId: string
  email: string
  plan: "free" | "base" | "advanced" | "lifetime"
  stripeCustomerId: string | null
  subscriptionStatus: string | null
  subscriptionEndsAt: string | null
  country: string | null
  state: string | null
  targetClauses: string[]
  strictMode: boolean
  playbookId: PlaybookId
  createdAt: string
  updatedAt: string
}

export type InvoiceRecord = {
  id: string
  amount: number
  currency: string
  status: "paid" | "pending" | "failed" | "refunded"
  description: string | null
  paidAt: string | null
}

export type ScanRecord = {
  id: string
  title: string | null
  url: string | null
  domain: string | null
  jurisdictionCountry: string | null
  jurisdictionState: string | null
  riskScore: number | null
  clauseCount: number
  flaggedCount: number
  source: "web" | "extension" | "paste" | "upload"
  decision: ScanDecision
  rawText: string | null
  documentType: DocumentType
  documentTypeConfidence: number | null
  documentIdentityKey: string | null
  createdAt: string
}

export type ClauseRecord = {
  id: string
  text: string
  category: string | null
  riskScore: number | null
  riskLevel: "green" | "yellow" | "red" | null
  position: number | null
  isFlagged: boolean
  isAiExplained: boolean
  isStandardPractice: boolean
  isTargetClause: boolean
  explanation: string | null
  whyItMatters: string | null
  recommendedAction: string | null
  confidence: number | null
}

type CachedExplanation = {
  explanation: string
  whyItMatters: string | null
  recommendedAction: string | null
  model: string | null
}

type CacheEntry = {
  explanation: string
  why_it_matters: string | null
  recommended_action: string | null
  model: string | null
  expires_at: string
}

function normalizeValue(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex")
}

function scanDocumentFields(row: Record<string, unknown>): Pick<
  ScanRecord,
  "documentType" | "documentTypeConfidence" | "documentIdentityKey"
> {
  const type = typeof row.document_type === "string" && DOCUMENT_TYPES.includes(row.document_type as DocumentType)
    ? row.document_type as DocumentType
    : "unknown"
  return {
    documentType: type,
    documentTypeConfidence: row.document_type_confidence == null
      ? null
      : Number(row.document_type_confidence),
    documentIdentityKey: typeof row.document_identity_key === "string"
      ? row.document_identity_key
      : null,
  }
}

function scanDecisionField(row: Record<string, unknown>): ScanDecision {
  const decision = row.decision
  if (decision === "open" || decision === "sign" || decision === "negotiate" || decision === "walk_away") {
    return decision
  }
  return "open"
}

async function scanRawText(row: Record<string, unknown>): Promise<string | null> {
  const objectKey = typeof row.document_object_key === "string"
    ? row.document_object_key
    : null
  if (objectKey) {
    const storedText = await readScanDocument(objectKey)
    if (storedText !== null) return storedText
  }

  return typeof row.raw_text === "string" ? row.raw_text : null
}

function playbookIdField(row: Record<string, unknown>): PlaybookId {
  const playbookId = row.playbook_id
  if (playbookId === "consumer_app" || playbookId === "saas_vendor" || playbookId === "contractor") {
    return playbookId
  }
  return "consumer_app"
}

function clampString(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function isMissingColumnError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false

  const code = (error as { code?: string }).code
  if (code === "42703") return true

  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : ""

  return (
    /column .* does not exist/i.test(message) ||
    /no such column/i.test(message) ||
    /has no column named/i.test(message)
  )
}

async function getClerkUserLocation(
  clerkId: string
): Promise<{ country: string | null; state: string | null }> {
  try {
    const client = await clerkClient()
    const user = await client.users.getUser(clerkId)
    const metadata = user.publicMetadata as {
      country?: unknown
      state?: unknown
    } | undefined

    return {
      country: clampString(
        typeof metadata?.country === "string" ? metadata.country : null
      ),
      state: clampString(typeof metadata?.state === "string" ? metadata.state : null),
    }
  } catch {
    return { country: null, state: null }
  }
}

async function updateClerkUserLocation(
  clerkId: string,
  country?: string | null,
  state?: string | null
): Promise<void> {
  if (country === undefined && state === undefined) return

  try {
    const client = await clerkClient()
    const metadata: Record<string, string | null> = {}

    if (country !== undefined) metadata.country = clampString(country)
    if (state !== undefined) metadata.state = clampString(state)

    await client.users.updateUserMetadata(clerkId, {
      publicMetadata: metadata,
    })
  } catch {
    // Best effort. Profile persistence still succeeds through D1 when available.
  }
}

function inferTitle(input: PersistedAnalysisInput): string {
  if (input.title) return input.title
  if (input.domain) return input.domain
  if (input.url) {
    try {
      return new URL(input.url).hostname.replace(/^www\./, "")
    } catch {
      return input.url
    }
  }

  return "Untitled scan"
}

function buildClauseHash(text: string, category: string): string {
  return sha256(`${normalizeValue(text)}::${normalizeValue(category)}`)
}

function buildAnalysisKey(text: string, category: string): string {
  return `${normalizeValue(text)}::${normalizeValue(category)}`
}

type UserProfileUpsertInput = {
  email: string
  country?: string | null
  state?: string | null
  utmSource?: string | null
  utmMedium?: string | null
  utmCampaign?: string | null
  landingPage?: string | null
}

export async function upsertUserProfile(
  clerkId: string,
  input: UserProfileUpsertInput
): Promise<UserProfileRecord> {
  const database = getDatabase()
  const payload: Record<string, string | null> = {
    clerk_id: clerkId,
    email: input.email,
  }

  if (input.country !== undefined) {
    payload.country = clampString(input.country)
  }

  if (input.state !== undefined) {
    payload.state = clampString(input.state)
  }

  if (input.utmSource !== undefined) {
    payload.utm_source = clampString(input.utmSource)
  }
  if (input.utmMedium !== undefined) {
    payload.utm_medium = clampString(input.utmMedium)
  }
  if (input.utmCampaign !== undefined) {
    payload.utm_campaign = clampString(input.utmCampaign)
  }
  if (input.landingPage !== undefined) {
    payload.landing_page = clampString(input.landingPage)
  }

  type DataShape = {
    id: string
    clerk_id: string
    email: string
    plan: UserProfileRecord["plan"]
    stripe_customer_id: string | null
    subscription_status: string | null
    subscription_ends_at: string | null
    country?: string | null
    state?: string | null
    created_at: string
    updated_at: string
  }

  let data: DataShape | null = null

  // Note: the utm_*/landing_page attribution columns are write-only (included
  // in the upsert payload above when provided) and are intentionally NOT part
  // of these selects — selecting them would make the whole upsert fail if the
  // columns are absent, which silently broke scan persistence. The selects
  // must only request columns the returned profile actually uses.
  const withLocationSelect =
    "id, clerk_id, email, plan, stripe_customer_id, subscription_status, subscription_ends_at, country, state, target_clauses, strict_mode, playbook_id, created_at, updated_at"
  const withoutLocationSelect =
    "id, clerk_id, email, plan, stripe_customer_id, subscription_status, subscription_ends_at, target_clauses, strict_mode, playbook_id, created_at, updated_at"

  const firstAttempt = await database
    .from("users")
    .upsert(payload, { onConflict: "clerk_id" })
    .select(withLocationSelect)
    .single()

  if (firstAttempt.error && isMissingColumnError(firstAttempt.error)) {
    const fallbackAttempt = await database
      .from("users")
      .upsert({ clerk_id: clerkId, email: input.email }, { onConflict: "clerk_id" })
      .select(withoutLocationSelect)
      .single()

    if (fallbackAttempt.error) throw fallbackAttempt.error
    data = fallbackAttempt.data as unknown as DataShape
  } else {
    if (firstAttempt.error) throw firstAttempt.error
    data = firstAttempt.data as unknown as DataShape
  }

  await updateClerkUserLocation(clerkId, input.country, input.state)

  if (!data) {
    const profile = await getUserProfileByClerkId(clerkId)
    if (!profile) {
      throw new Error("Failed to persist user profile")
    }
    return profile
  }

  const location = await getClerkUserLocation(clerkId)

  return {
    id: data.id,
    clerkId: data.clerk_id,
    email: data.email,
    plan: data.plan,
    stripeCustomerId: data.stripe_customer_id ?? null,
    subscriptionStatus: data.subscription_status ?? null,
    subscriptionEndsAt: data.subscription_ends_at ?? null,
    country: (data.country as string | null | undefined) ?? location.country,
    state: (data.state as string | null | undefined) ?? location.state,
    targetClauses: (data as any).target_clauses ?? [],
    strictMode: (data as any).strict_mode ?? false,
    playbookId: playbookIdField(data as Record<string, unknown>),
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }
}

async function getUserIdByClerkId(clerkId: string): Promise<string | null> {
  const database = getDatabase()
  const { data, error } = await database
    .from("users")
    .select("id")
    .eq("clerk_id", clerkId)
    .maybeSingle()

  if (error) throw error
  return (data?.id as string | undefined) ?? null
}

export async function getUserProfileByClerkId(
  clerkId: string
): Promise<UserProfileRecord | null> {
  const database = getDatabase()
  const selectWithLocation =
    "id, clerk_id, email, plan, stripe_customer_id, subscription_status, subscription_ends_at, country, state, target_clauses, strict_mode, playbook_id, created_at, updated_at"
  const selectWithoutLocation =
    "id, clerk_id, email, plan, stripe_customer_id, subscription_status, subscription_ends_at, target_clauses, strict_mode, playbook_id, created_at, updated_at"

  const readWithLocation = async () =>
    database
      .from("users")
      .select(selectWithLocation)
      .eq("clerk_id", clerkId)
      .maybeSingle()

  const firstAttempt = await readWithLocation()
  if (firstAttempt.error && !isMissingColumnError(firstAttempt.error)) {
    throw firstAttempt.error
  }

  if (firstAttempt.data) {
    return {
      id: firstAttempt.data.id as string,
      clerkId: firstAttempt.data.clerk_id as string,
      email: firstAttempt.data.email as string,
      plan: firstAttempt.data.plan as UserProfileRecord["plan"],
      stripeCustomerId: (firstAttempt.data.stripe_customer_id as string | null) ?? null,
      subscriptionStatus: (firstAttempt.data.subscription_status as string | null) ?? null,
      subscriptionEndsAt: (firstAttempt.data.subscription_ends_at as string | null) ?? null,
      country: (firstAttempt.data.country as string | null) ?? null,
      state: (firstAttempt.data.state as string | null) ?? null,
      targetClauses: (firstAttempt.data as any).target_clauses ?? [],
      strictMode: (firstAttempt.data as any).strict_mode ?? false,
      playbookId: playbookIdField(firstAttempt.data as Record<string, unknown>),
      createdAt: firstAttempt.data.created_at as string,
      updatedAt: firstAttempt.data.updated_at as string,
    }
  }

  if (firstAttempt.error && isMissingColumnError(firstAttempt.error)) {
    const fallbackAttempt = await database
      .from("users")
      .select(selectWithoutLocation)
      .eq("clerk_id", clerkId)
      .maybeSingle()

    if (fallbackAttempt.error) throw fallbackAttempt.error
    if (!fallbackAttempt.data) return null

    const location = await getClerkUserLocation(clerkId)
    return {
      id: fallbackAttempt.data.id as string,
      clerkId: fallbackAttempt.data.clerk_id as string,
      email: fallbackAttempt.data.email as string,
      plan: fallbackAttempt.data.plan as UserProfileRecord["plan"],
      stripeCustomerId:
        (fallbackAttempt.data.stripe_customer_id as string | null) ?? null,
      subscriptionStatus: (fallbackAttempt.data.subscription_status as string | null) ?? null,
      subscriptionEndsAt: (fallbackAttempt.data.subscription_ends_at as string | null) ?? null,
      country: location.country,
      state: location.state,
      targetClauses: (fallbackAttempt.data as any).target_clauses ?? [],
      strictMode: (fallbackAttempt.data as any).strict_mode ?? false,
      playbookId: playbookIdField(fallbackAttempt.data as Record<string, unknown>),
      createdAt: fallbackAttempt.data.created_at as string,
      updatedAt: fallbackAttempt.data.updated_at as string,
    }
  }

  return null
}

export async function getOrCreateUserProfileByClerkId(
  clerkId: string,
  email: string,
  utm?: {
    utmSource?: string | null
    utmMedium?: string | null
    utmCampaign?: string | null
    landingPage?: string | null
  }
): Promise<UserProfileRecord> {
  const existing = await getUserProfileByClerkId(clerkId)
  if (existing) return existing
  return upsertUserProfile(clerkId, {
    email,
    ...(utm?.utmSource !== undefined ? { utmSource: utm.utmSource } : {}),
    ...(utm?.utmMedium !== undefined ? { utmMedium: utm.utmMedium } : {}),
    ...(utm?.utmCampaign !== undefined ? { utmCampaign: utm.utmCampaign } : {}),
    ...(utm?.landingPage !== undefined ? { landingPage: utm.landingPage } : {}),
  })
}

export async function updateUserTargetClauses(
  clerkId: string,
  targetClauses: string[],
  strictMode: boolean,
  playbookId: PlaybookId
): Promise<void> {
  const database = getDatabase()
  const { error } = await database
    .from("users")
    .update({
      target_clauses: targetClauses,
      strict_mode: strictMode,
      playbook_id: playbookId,
    })
    .eq("clerk_id", clerkId)

  if (error) throw error
}

export async function getUserIdForClerkId(clerkId: string): Promise<string | null> {
  return getUserIdByClerkId(clerkId)
}

export async function countContractUploads(clerkId: string): Promise<number> {
  const userId = await getUserIdByClerkId(clerkId)
  if (!userId) return 0

  const database = getDatabase()
  const { count, error } = await database
    .from("scans")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_deleted", false)
    .in("source", ["paste", "upload"])

  if (error) throw error
  return count ?? 0
}

export async function listRecentScansByClerkId(
  clerkId: string,
  limit = 5
): Promise<ScanRecord[]> {
  const userId = await getUserIdByClerkId(clerkId)
  if (!userId) return []

  const database = getDatabase()
  const selectWithLocation =
    "id, title, url, domain, jurisdiction_country, jurisdiction_state, risk_score, clause_count, flagged_count, source, decision, document_type, document_type_confidence, document_identity_key, created_at"
  const selectWithoutLocation =
    "id, title, url, domain, risk_score, clause_count, flagged_count, source, decision, document_type, document_type_confidence, document_identity_key, created_at"

  const firstAttempt = await database
    .from("scans")
    .select(selectWithLocation)
    .eq("user_id", userId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (firstAttempt.error && !isMissingColumnError(firstAttempt.error)) {
    throw firstAttempt.error
  }

  if (firstAttempt.data) {
    return firstAttempt.data.map((row) => ({
      id: row.id as string,
      title: (row.title as string | null) ?? null,
      url: (row.url as string | null) ?? null,
      domain: (row.domain as string | null) ?? null,
      jurisdictionCountry: (row.jurisdiction_country as string | null) ?? null,
      jurisdictionState: (row.jurisdiction_state as string | null) ?? null,
      riskScore: row.risk_score != null ? Number(row.risk_score) : null,
      clauseCount: Number(row.clause_count ?? 0),
      flaggedCount: Number(row.flagged_count ?? 0),
      source: row.source as ScanRecord["source"],
      decision: scanDecisionField(row as Record<string, unknown>),
      rawText: null,
      ...scanDocumentFields(row),
      createdAt: row.created_at as string,
    }))
  }

  if (firstAttempt.error && isMissingColumnError(firstAttempt.error)) {
    const fallbackAttempt = await database
      .from("scans")
      .select(selectWithoutLocation)
      .eq("user_id", userId)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (fallbackAttempt.error) throw fallbackAttempt.error

    return (fallbackAttempt.data ?? []).map((row) => ({
      id: row.id as string,
      title: (row.title as string | null) ?? null,
      url: (row.url as string | null) ?? null,
      domain: (row.domain as string | null) ?? null,
      jurisdictionCountry: null,
      jurisdictionState: null,
      riskScore: row.risk_score != null ? Number(row.risk_score) : null,
      clauseCount: Number(row.clause_count ?? 0),
      flaggedCount: Number(row.flagged_count ?? 0),
      source: row.source as ScanRecord["source"],
      decision: scanDecisionField(row as Record<string, unknown>),
      rawText: null,
      ...scanDocumentFields(row),
      createdAt: row.created_at as string,
    }))
  }

  return []
}

export async function getLatestScanByClerkId(
  clerkId: string,
  includeFullExtraction = true,
  includeRawText = false,
): Promise<{ scan: ScanRecord; clauses: ClauseRecord[]; fullExtraction: FullExtractionSection[] } | null> {
  const userId = await getUserIdByClerkId(clerkId)
  if (!userId) return null

  const database = getDatabase()
  const documentColumns = includeRawText ? ", raw_text, document_object_key" : ""
  const selectWithLocation =
    `id, title, url, domain, jurisdiction_country, jurisdiction_state, risk_score, clause_count, flagged_count, source, decision${documentColumns}, document_type, document_type_confidence, document_identity_key, created_at`
  const selectWithoutLocation =
    `id, title, url, domain, risk_score, clause_count, flagged_count, source, decision${documentColumns}, document_type, document_type_confidence, document_identity_key, created_at`

  const firstAttempt = await database
    .from("scans")
    .select(selectWithLocation)
    .eq("user_id", userId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  let scanData = firstAttempt.data
  if (firstAttempt.error && !isMissingColumnError(firstAttempt.error)) {
    throw firstAttempt.error
  }

  if (!scanData && firstAttempt.error && isMissingColumnError(firstAttempt.error)) {
    const fallbackAttempt = await database
      .from("scans")
      .select(selectWithoutLocation)
      .eq("user_id", userId)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (fallbackAttempt.error) throw fallbackAttempt.error
    scanData = fallbackAttempt.data as unknown as typeof scanData
  }

  if (!scanData) return null

  const [clauseResult, rawText, fullExtraction] = await Promise.all([
    database
      .from("clauses")
      .select(
        "id, text, category, risk_score, risk_level, position, is_flagged, is_ai_explained, is_standard_practice, is_target_clause, explanation, why_it_matters, recommended_action, confidence"
      )
      .eq("scan_id", scanData.id)
      .order("position", { ascending: true }),
    includeRawText
      ? scanRawText(scanData as Record<string, unknown>)
      : Promise.resolve(null),
    includeFullExtraction
      ? getFullExtractionByScanId(scanData.id as string).catch(() => [])
      : Promise.resolve([] as FullExtractionSection[]),
  ])
  const { data: clauseData, error: clauseError } = clauseResult

  if (clauseError) throw clauseError

  return {
    scan: {
      id: scanData.id as string,
      title: (scanData.title as string | null) ?? null,
      url: (scanData.url as string | null) ?? null,
      domain: (scanData.domain as string | null) ?? null,
      jurisdictionCountry: (scanData as { jurisdiction_country?: string | null })
        .jurisdiction_country ?? null,
      jurisdictionState: (scanData as { jurisdiction_state?: string | null })
        .jurisdiction_state ?? null,
      riskScore:
        scanData.risk_score != null ? Number(scanData.risk_score) : null,
      clauseCount: Number(scanData.clause_count ?? 0),
      flaggedCount: Number(scanData.flagged_count ?? 0),
      source: scanData.source as ScanRecord["source"],
      decision: scanDecisionField(scanData as Record<string, unknown>),
      rawText,
      ...scanDocumentFields(scanData),
      createdAt: scanData.created_at as string,
    },
    clauses: (clauseData ?? []).map((row) => ({
      id: row.id as string,
      text: row.text as string,
      category: (row.category as string | null) ?? null,
      riskScore: row.risk_score != null ? Number(row.risk_score) : null,
      riskLevel: (row.risk_level as ClauseRecord["riskLevel"]) ?? null,
      position: row.position != null ? Number(row.position) : null,
      isFlagged: Boolean(row.is_flagged),
      isAiExplained: Boolean(row.is_ai_explained),
      isStandardPractice: Boolean(row.is_standard_practice),
      isTargetClause: Boolean(row.is_target_clause),
      explanation: (row.explanation as string | null) ?? null,
      whyItMatters: (row.why_it_matters as string | null) ?? null,
      recommendedAction: (row.recommended_action as string | null) ?? null,
      confidence: row.confidence != null ? Number(row.confidence) : null,
    })),
    fullExtraction,
  }
}

export async function getScanWithClauses(
  clerkId: string,
  scanId: string,
  includeFullExtraction = true,
  includeRawText = false,
): Promise<{ scan: ScanRecord; clauses: ClauseRecord[]; fullExtraction: FullExtractionSection[] } | null> {
  const userId = await getUserIdByClerkId(clerkId)
  if (!userId) return null

  const database = getDatabase()
  const documentColumns = includeRawText ? ", raw_text, document_object_key" : ""
  const { data: scanData, error: scanError } = await database
    .from("scans")
    .select(`id, title, url, domain, jurisdiction_country, jurisdiction_state, risk_score, clause_count, flagged_count, source, decision${documentColumns}, document_type, document_type_confidence, document_identity_key, created_at`)
    .eq("id", scanId)
    .eq("user_id", userId)
    .eq("is_deleted", false)
    .maybeSingle()

  if (scanError) throw scanError
  if (!scanData) return null

  const [clauseResult, rawText, fullExtraction] = await Promise.all([
    database
      .from("clauses")
      .select("id, text, category, risk_score, risk_level, position, is_flagged, is_ai_explained, is_standard_practice, is_target_clause, explanation, why_it_matters, recommended_action, confidence")
      .eq("scan_id", scanData.id)
      .order("position", { ascending: true }),
    includeRawText
      ? scanRawText(scanData as Record<string, unknown>)
      : Promise.resolve(null),
    includeFullExtraction
      ? getFullExtractionByScanId(scanData.id as string).catch(() => [])
      : Promise.resolve([] as FullExtractionSection[]),
  ])
  const { data: clauseData, error: clauseError } = clauseResult

  if (clauseError) throw clauseError

  return {
    scan: {
      id: scanData.id as string,
      title: (scanData.title as string | null) ?? null,
      url: (scanData.url as string | null) ?? null,
      domain: (scanData.domain as string | null) ?? null,
      jurisdictionCountry: (scanData as { jurisdiction_country?: string | null }).jurisdiction_country ?? null,
      jurisdictionState: (scanData as { jurisdiction_state?: string | null }).jurisdiction_state ?? null,
      riskScore: scanData.risk_score != null ? Number(scanData.risk_score) : null,
      clauseCount: Number(scanData.clause_count ?? 0),
      flaggedCount: Number(scanData.flagged_count ?? 0),
      source: scanData.source as ScanRecord["source"],
      decision: scanDecisionField(scanData as Record<string, unknown>),
      rawText,
      ...scanDocumentFields(scanData),
      createdAt: scanData.created_at as string,
    },
    clauses: (clauseData ?? []).map((row) => ({
      id: row.id as string,
      text: row.text as string,
      category: (row.category as string | null) ?? null,
      riskScore: row.risk_score != null ? Number(row.risk_score) : null,
      riskLevel: (row.risk_level as ClauseRecord["riskLevel"]) ?? null,
      position: row.position != null ? Number(row.position) : null,
      isFlagged: Boolean(row.is_flagged),
      isAiExplained: Boolean(row.is_ai_explained),
      isStandardPractice: Boolean(row.is_standard_practice),
      isTargetClause: Boolean(row.is_target_clause),
      explanation: (row.explanation as string | null) ?? null,
      whyItMatters: (row.why_it_matters as string | null) ?? null,
      recommendedAction: (row.recommended_action as string | null) ?? null,
      confidence: row.confidence != null ? Number(row.confidence) : null,
    })),
    fullExtraction,
  }
}

export async function getFullExtractionByClerkId(
  clerkId: string,
  scanId: string,
): Promise<FullExtractionSection[] | null> {
  const userId = await getUserIdByClerkId(clerkId)
  if (!userId) return null

  const database = getDatabase()
  const { data: scan, error } = await database
    .from("scans")
    .select("id")
    .eq("id", scanId)
    .eq("user_id", userId)
    .eq("is_deleted", false)
    .maybeSingle()

  if (error) throw error
  if (!scan?.id) return null
  return getFullExtractionByScanId(scanId)
}

export async function getScanDocumentByClerkId(
  clerkId: string,
  scanId: string,
): Promise<string | null | undefined> {
  const userId = await getUserIdByClerkId(clerkId)
  if (!userId) return undefined

  const database = getDatabase()
  const { data: scan, error } = await database
    .from("scans")
    .select("id, raw_text, document_object_key")
    .eq("id", scanId)
    .eq("user_id", userId)
    .eq("is_deleted", false)
    .maybeSingle()

  if (error) throw error
  if (!scan?.id) return undefined
  return scanRawText(scan as Record<string, unknown>)
}

// ─── Version Tracking ──────────────────────────────────────────────────────

/**
 * List all non-deleted scans for a given domain for the authenticated user,
 * ordered newest-first. Used to detect prior scans and build the timeline.
 */
export async function listScansByDomain(
  clerkId: string,
  domain: string,
  documentIdentityKey: string | null,
  documentType?: DocumentType,
): Promise<ScanRecord[]> {
  if (!documentIdentityKey) return []
  const userId = await getUserIdByClerkId(clerkId)
  if (!userId) return []

  const database = getDatabase()
  let query = database
    .from("scans")
    .select("id, title, url, domain, jurisdiction_country, jurisdiction_state, risk_score, clause_count, flagged_count, source, decision, document_type, document_type_confidence, document_identity_key, created_at")
    .eq("user_id", userId)
    .eq("domain", domain)
    .eq("document_identity_key", documentIdentityKey)
    .eq("is_deleted", false)

  if (documentType) query = query.eq("document_type", documentType)

  const { data, error } = await query.order("created_at", { ascending: false })

  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id as string,
    title: (row.title as string | null) ?? null,
    url: (row.url as string | null) ?? null,
    domain: (row.domain as string | null) ?? null,
    jurisdictionCountry: (row as any).jurisdiction_country ?? null,
    jurisdictionState: (row as any).jurisdiction_state ?? null,
    riskScore: row.risk_score != null ? Number(row.risk_score) : null,
    clauseCount: Number(row.clause_count ?? 0),
    flaggedCount: Number(row.flagged_count ?? 0),
    source: row.source as ScanRecord["source"],
    decision: scanDecisionField(row as Record<string, unknown>),
    rawText: null,
    ...scanDocumentFields(row),
    createdAt: row.created_at as string,
  }))
}

export async function getScanDomainHistorySummary(
  clerkId: string,
  domain: string,
  documentIdentityKey: string | null,
  currentScanId: string,
  documentType?: DocumentType,
): Promise<{ count: number; previousScanId?: string }> {
  if (!documentIdentityKey) return { count: 0 }
  const userId = await getUserIdByClerkId(clerkId)
  if (!userId) return { count: 0 }

  const database = getDatabase()
  const base = () => {
    let query = database
      .from("scans")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("domain", domain)
      .eq("document_identity_key", documentIdentityKey)
      .eq("is_deleted", false)
    if (documentType) query = query.eq("document_type", documentType)
    return query
  }

  let previousQuery = database
    .from("scans")
    .select("id")
    .eq("user_id", userId)
    .eq("domain", domain)
    .eq("document_identity_key", documentIdentityKey)
    .eq("is_deleted", false)
    .neq("id", currentScanId)
  if (documentType) previousQuery = previousQuery.eq("document_type", documentType)

  const [countResult, previousResult] = await Promise.all([
    base(),
    previousQuery
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1),
  ])

  if (countResult.error) throw countResult.error
  if (previousResult.error) throw previousResult.error
  const previous = previousResult.data?.[0]
  return {
    count: countResult.count ?? 0,
    previousScanId: typeof previous?.id === "string" ? previous.id : undefined,
  }
}

/**
 * Fetch two scans (with clauses) for a diff comparison.
 * Both scans must belong to the authenticated user.
 */
export async function getScanPair(
  clerkId: string,
  scanIdA: string,
  scanIdB: string
): Promise<{
  scanA: { scan: ScanRecord; clauses: ClauseRecord[] }
  scanB: { scan: ScanRecord; clauses: ClauseRecord[] }
} | null> {
  const [resultA, resultB] = await Promise.all([
    getScanWithClauses(clerkId, scanIdA),
    getScanWithClauses(clerkId, scanIdB),
  ])

  if (!resultA || !resultB) return null

  if (
    !resultA.scan.documentIdentityKey
    || resultA.scan.documentIdentityKey !== resultB.scan.documentIdentityKey
    || resultA.scan.documentType !== resultB.scan.documentType
  ) {
    return null
  }

  return {
    scanA: { scan: resultA.scan, clauses: resultA.clauses },
    scanB: { scan: resultB.scan, clauses: resultB.clauses },
  }
}

export async function listBlocklistItemsByClerkId(clerkId: string): Promise<
  Array<{
    id: string
    keyword: string
    category: string | null
    isCustom: boolean
    isActive: boolean
  }>
> {
  const userId = await getUserIdByClerkId(clerkId)
  if (!userId) return []

  const database = getDatabase()
  const { data, error } = await database
    .from("blocklist_items")
    .select("id, keyword, category, is_custom, is_active")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })

  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id as string,
    keyword: row.keyword as string,
    category: (row.category as string | null) ?? null,
    isCustom: Boolean(row.is_custom),
    isActive: Boolean(row.is_active),
  }))
}

export async function getCreditBalanceByClerkId(clerkId: string): Promise<number> {
  const userId = await getUserIdByClerkId(clerkId)
  if (!userId) return 0

  return getCreditBalanceByUserId(userId)
}

export async function getCreditBalanceByUserId(userId: string): Promise<number> {
  const database = getDatabase()
  const { data, error } = await database
    .from("credit_packs")
    .select("credits_remaining, expires_at")
    .eq("user_id", userId)
    .gt("credits_remaining", 0)
    .eq("refund_hold", false)
    .gt("expires_at", new Date().toISOString())

  if (error) throw error

  return (data ?? []).reduce((sum, row) => sum + Number(row.credits_remaining ?? 0), 0)
}

export type ScanPage = {
  scans: ScanRecord[]
  total: number
}

type ScanPageRow = {
  id: string
  title: string | null
  url: string | null
  domain: string | null
  jurisdiction_country?: string | null
  jurisdiction_state?: string | null
  risk_score: number | string | null
  clause_count: number | null
  flagged_count: number | null
  source: ScanRecord["source"]
  decision?: ScanDecision
  document_type?: string | null
  document_type_confidence?: number | string | null
  document_identity_key?: string | null
  created_at: string
}

export type ScanPageFilters = {
  search?: string
  risk?: "all" | "high" | "medium" | "low"
  dateRange?: "7" | "30" | "all"
  sort?: "date" | "risk" | "name"
}

export async function listScansPageByUserId(
  userId: string,
  page: number,
  pageSize: number,
  filters: ScanPageFilters = {},
): Promise<ScanPage> {
  const database = getDatabase()
  const offset = Math.max(0, page - 1) * pageSize
  const selectWithLocation =
    "id, title, url, domain, jurisdiction_country, jurisdiction_state, risk_score, clause_count, flagged_count, source, decision, document_type, document_type_confidence, document_identity_key, created_at"
  const selectWithoutLocation =
    "id, title, url, domain, risk_score, clause_count, flagged_count, source, decision, document_type, document_type_confidence, document_identity_key, created_at"

  const readPage = (select: string) => {
    let query = database
      .from("scans")
      .select(select, { count: "exact" })
      .eq("user_id", userId)
      .eq("is_deleted", false)

    const search = filters.search?.replace(/[,()]/g, " ").trim()
    if (search) {
      query = query.or(`title.ilike.%${search}%,domain.ilike.%${search}%`)
    }

    if (filters.risk === "high") {
      query = query.gte("risk_score", 7)
    } else if (filters.risk === "medium") {
      query = query.gte("risk_score", 4).lt("risk_score", 7)
    } else if (filters.risk === "low") {
      query = query.or("risk_score.lt.4,risk_score.is.null")
    }

    if (filters.dateRange === "7" || filters.dateRange === "30") {
      const days = filters.dateRange === "7" ? 7 : 30
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
      query = query.gte("created_at", since)
    }

    if (filters.sort === "risk") {
      query = query.order("risk_score", { ascending: false, nullsFirst: false })
    } else if (filters.sort === "name") {
      query = query.order("title", { ascending: true, nullsFirst: false })
    } else {
      query = query.order("created_at", { ascending: false })
    }

    return query.range(offset, offset + pageSize - 1)
  }

  let result = await readPage(selectWithLocation)
  let includesLocation = true
  if (result.error && isMissingColumnError(result.error)) {
    result = await readPage(selectWithoutLocation)
    includesLocation = false
  }
  if (result.error) throw result.error

  // D1 cannot infer a row shape from a runtime-built select string.
  // The select fields above are fixed, so normalize the boundary once here.
  const rows = (result.data ?? []) as unknown as ScanPageRow[]

  return {
    total: result.count ?? 0,
    scans: rows.map((row) => ({
      id: row.id,
      title: row.title ?? null,
      url: row.url ?? null,
      domain: row.domain ?? null,
      jurisdictionCountry: includesLocation
        ? (row.jurisdiction_country ?? null)
        : null,
      jurisdictionState: includesLocation
        ? (row.jurisdiction_state ?? null)
        : null,
      riskScore: row.risk_score != null ? Number(row.risk_score) : null,
      clauseCount: Number(row.clause_count ?? 0),
      flaggedCount: Number(row.flagged_count ?? 0),
      source: row.source,
      decision: scanDecisionField(row as unknown as Record<string, unknown>),
      rawText: null,
      ...scanDocumentFields(row as unknown as Record<string, unknown>),
      createdAt: row.created_at,
    })),
  }
}

export async function listInvoicesByClerkId(
  clerkId: string,
  limit = 20
): Promise<InvoiceRecord[]> {
  const userId = await getUserIdByClerkId(clerkId)
  if (!userId) return []

  const database = getDatabase()
  const { data, error } = await database
    .from("invoices")
    .select("id, amount, currency, status, description, paid_at")
    .eq("user_id", userId)
    .order("paid_at", { ascending: false })
    .limit(limit)

  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id as string,
    amount: Number(row.amount),
    currency: row.currency as string,
    status: row.status as InvoiceRecord["status"],
    description: (row.description as string | null) ?? null,
    paidAt: (row.paid_at as string | null) ?? null,
  }))
}

export async function insertInvoice(input: {
  userId: string
  stripeInvoiceId?: string | null
  stripePaymentId?: string | null
  amount: number
  currency?: string
  status: "paid" | "pending" | "failed" | "refunded"
  description?: string | null
  paidAt?: string | null
}): Promise<void> {
  const database = getDatabase()
  const row = {
    user_id: input.userId,
    stripe_invoice_id: input.stripeInvoiceId ?? null,
    stripe_payment_id: input.stripePaymentId ?? null,
    amount: input.amount,
    currency: input.currency ?? "usd",
    status: input.status,
    description: input.description ?? null,
    paid_at: input.paidAt ?? null,
  }

  if (input.stripeInvoiceId) {
    const existing = await database.from("invoices")
      .select("status, stripe_payment_id")
      .eq("stripe_invoice_id", input.stripeInvoiceId)
      .maybeSingle()
    if (existing.error) throw existing.error
    if (existing.data?.status === "refunded" && input.status === "paid") return
    if (!row.stripe_payment_id && existing.data?.stripe_payment_id) {
      row.stripe_payment_id = existing.data.stripe_payment_id as string
    }
    const { error } = await database
      .from("invoices")
      .upsert(row, { onConflict: "stripe_invoice_id" })
    if (error) throw error
    return
  }

  const { error } = await database.from("invoices").insert(row)
  if (!error) return

  // Payment IDs have a database unique index. If two webhook deliveries race,
  // the winner inserts and the loser confirms that same payment before
  // acknowledging the retry as idempotent.
  if (input.stripePaymentId) {
    const existing = await database
      .from("invoices")
      .select("id")
      .eq("stripe_payment_id", input.stripePaymentId)
      .maybeSingle()
    if (existing.error) throw existing.error
    if (existing.data) return
  }

  throw error
}

export async function updateScanDecision(
  scanId: string,
  clerkId: string,
  decision: ScanDecision
): Promise<boolean> {
  const userId = await getUserIdByClerkId(clerkId)
  if (!userId) return false

  const database = getDatabase()
  const { data, error } = await database
    .from("scans")
    .update({ decision })
    .eq("id", scanId)
    .eq("user_id", userId)
    .eq("is_deleted", false)
    .select("id")
    .maybeSingle()

  if (error) throw error
  return Boolean(data?.id)
}

export async function deleteScanByClerkId(
  clerkId: string,
  scanId: string
): Promise<boolean> {
  const userId = await getUserIdByClerkId(clerkId)
  if (!userId) return false

  const database = getDatabase()
  const { data: existing, error: existingError } = await database
    .from("scans")
    .select("id, raw_text, document_object_key")
    .eq("id", scanId)
    .eq("user_id", userId)
    .eq("is_deleted", false)
    .maybeSingle()

  if (existingError) throw existingError
  if (!existing) return false

  const { data, error } = await database
    .from("scans")
    .update({ is_deleted: true, raw_text: null })
    .eq("id", scanId)
    .eq("user_id", userId)
    .eq("is_deleted", false)
    .select("id")
    .maybeSingle()

  if (error) throw error
  const deleted = Boolean(data?.id)
  if (!deleted) return false

  try {
    await deleteScanDocument(
      typeof existing.document_object_key === "string"
        ? existing.document_object_key
        : null,
    )
  } catch (reason) {
    const rollback = await database
      .from("scans")
      .update({ is_deleted: false, raw_text: existing.raw_text ?? null })
      .eq("id", scanId)
      .eq("user_id", userId)
    if (rollback.error) {
      throw new AggregateError(
        [reason, rollback.error],
        "Failed to delete the scan document and restore its database record",
      )
    }
    throw reason
  }

  try {
    revalidateTag("public-live-stats", "max")
  } catch (error) {
    console.warn("[themys] public-live-stats revalidation skipped after scan delete:", error)
  }
  return deleted
}

function severityToRiskLevel(severity?: string): "green" | "yellow" | "red" {
  if (severity === "high") return "red"
  if (severity === "medium") return "yellow"
  return "green"
}

function clampConfidence(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null
  return Math.min(1, Math.max(0, value))
}

async function insertClauses(
  scanId: string,
  result: AnalysisResult
): Promise<void> {
  const database = getDatabase()
  const flagById = new Map<string, AnalysisResult["flags"][number]>()
  const flagByAnalysisKey = new Map<string, AnalysisResult["flags"][number]>()

  for (const flag of result.flags) {
    if (flag.id) flagById.set(flag.id, flag)
    flagByAnalysisKey.set(buildAnalysisKey(flag.text, flag.category), flag)
  }

  const clauseRows = result.clauses.map((clause, index) => {
    const flag =
      flagById.get(clause.id) ??
      (clause.matchedCategory
        ? flagByAnalysisKey.get(buildAnalysisKey(clause.text, clause.matchedCategory))
        : undefined) ??
      result.flags.find((f) => {
        return f.category === clause.matchedCategory && clause.text.includes(f.text)
      })

    const isAiExplained = flag
      ? ["llm", "llm-credit", "fallback"].includes(flag.source ?? "")
      : Boolean((clause as any).explanation)

    const isStandardPractice = Boolean((flag as any)?.isStandardPractice || (clause as any)?.isStandardPractice)
    const isTargetClause = Boolean((flag as any)?.isTargetClause || (clause as any)?.isTargetClause)
    let calculatedRiskLevel = flag ? severityToRiskLevel(flag.severity) : clause.riskLevel
    let calculatedRiskScore = flag ? flag.riskScore ?? clause.riskScore : clause.riskScore

    if (isStandardPractice && !isTargetClause) {
      calculatedRiskLevel = "yellow"
      if (calculatedRiskScore != null) calculatedRiskScore = Math.min(calculatedRiskScore, 5)
    }

    return {
      scan_id: scanId,
      text: flag ? flag.text : clause.text,
      category: flag ? flag.category : clause.matchedCategory,
      risk_score: calculatedRiskScore,
      risk_level: calculatedRiskLevel,
      position: clause.position ?? index + 1,
      is_flagged: Boolean(flag),
      is_ai_explained: isAiExplained,
      is_standard_practice: isStandardPractice,
      is_target_clause: isTargetClause,
      explanation: flag?.explanation ?? (clause as any).explanation ?? null,
      why_it_matters: flag?.whyItMatters ?? (clause as any).whyItMatters ?? null,
      recommended_action: flag?.recommendedAction ?? (clause as any).recommendedAction ?? null,
      confidence: clampConfidence(flag ? flag.confidence ?? clause.confidence : clause.confidence),
    }
  })

  if (clauseRows.length === 0) return

  const { error } = await database.from("clauses").insert(clauseRows)
  if (error) throw error
}

/**
 * Persist compliance tags from LLM-generated flags to the clause_compliance_tags table.
 * Matches flags to inserted clauses by text/category, then inserts tags.
 */
async function persistComplianceTags(
  scanId: string,
  result: AnalysisResult,
): Promise<void> {
  // Collect flags that have compliance tags
  const flagsWithTags = result.flags.filter(
    (f) => f.complianceTags && f.complianceTags.length > 0,
  )
  console.log(`[persistence] persistComplianceTags: ${result.flags.length} flags, ${flagsWithTags.length} with compliance tags`)
  if (flagsWithTags.length === 0) return

  const database = getDatabase()

  // These reads are independent. Keep both off the critical path of each
  // other before building the tag rows.
  const [{ data: dbClauses, error: clauseErr }, { data: regulations }] = await Promise.all([
    database
      .from("clauses")
      .select("id, text, category")
      .eq("scan_id", scanId),
    database
      .from("regulations")
      .select("id, code")
      .eq("is_active", true),
  ])

  if (clauseErr || !dbClauses || dbClauses.length === 0) return

  if (!regulations || regulations.length === 0) {
    console.warn('[persistence] persistComplianceTags: no regulations found in DB')
    return
  }
  console.log(`[persistence] persistComplianceTags: ${regulations.length} regulations, ${dbClauses.length} clauses`)

  const regByCode = new Map(
    regulations.map((r) => [r.code.toUpperCase(), r.id]),
  )

  // Match flags to clauses and build tag rows
  const tagRows: Array<{
    clause_id: string
    regulation_id: string
    article_id: string
    article_title: string | null
    relevance: number
    confidence: number
    quote: string | null
  }> = []

  for (const flag of flagsWithTags) {
    // Find matching clause by text containment + category
    const matchedClause = dbClauses.find(
      (c) =>
        c.text &&
        flag.text &&
        (c.text.includes(flag.text) || flag.text.includes(c.text)) &&
        (!c.category || !flag.category || c.category === flag.category),
    )
    if (!matchedClause) continue

    for (const tag of flag.complianceTags!) {
      const regId = regByCode.get(tag.regulationCode.toUpperCase())
      if (!regId) continue

      tagRows.push({
        clause_id: matchedClause.id as string,
        regulation_id: regId as string,
        article_id: tag.articleId,
        article_title: tag.articleTitle ?? null,
        relevance: tag.relevance ?? 0.8,
        confidence: tag.relevance ?? 0.7,
        quote: tag.quote ?? null,
      })
    }
  }

  if (tagRows.length === 0) {
    console.warn('[persistence] persistComplianceTags: matched 0 tag rows (flags had tags but no clause/regulation matches)')
    return
  }
  console.log(`[persistence] persistComplianceTags: inserting ${tagRows.length} tag rows`)

  // Bulk insert (ignore conflicts on unique constraint)
  const { error } = await database
    .from("clause_compliance_tags")
    .upsert(tagRows, { onConflict: "clause_id,regulation_id,article_id", ignoreDuplicates: true })

  if (error) {
    console.warn(`[persistence] Compliance tags insert error: ${error.message}`)
  }
}

export async function persistAnalysis(input: PersistedAnalysisInput): Promise<string> {
  const database = getDatabase()
  const profile = await upsertUserProfile(input.clerkId, { email: input.email })
  const normalizedResult: AnalysisResult = {
    ...input.result,
    flags: dedupeByText(input.result.flags, (flag) => `${flag.category}:::${flag.text}`),
    clauses: dedupeByText(input.result.clauses, (clause) => `${clause.matchedCategory || (clause as any).category || clause.id}:::${clause.text}`),
  }

  const jurisdictionCountry =
    input.country !== undefined ? clampString(input.country) : profile.country
  const jurisdictionState =
    input.state !== undefined ? clampString(input.state) : profile.state

  const scanId = randomUUID()
  const rawTextHash = sha256(normalizeValue(input.text))
  let documentObjectKey: string | null = null
  try {
    documentObjectKey = await storeScanDocument({
      userId: profile.id,
      scanId,
      text: input.text,
      sha256: rawTextHash,
    })
  } catch (error) {
    console.warn(
      "[persistence] R2 document storage skipped; storing raw text in D1",
      error instanceof Error ? error.message : "Unknown error",
    )
  }

  const scanPayload = {
    id: scanId,
    user_id: profile.id,
    url: clampString(input.url),
    domain: clampString(input.domain),
    title: inferTitle(input),
    jurisdiction_country: jurisdictionCountry,
    jurisdiction_state: jurisdictionState,
    risk_score: normalizedResult.riskScore,
    clause_count: Math.max(normalizedResult.clauses.length, normalizedResult.stats.totalClauses),
    flagged_count: normalizedResult.flags.length,
    raw_text_hash: rawTextHash,
    raw_text: documentObjectKey ? null : input.text,
    document_object_key: documentObjectKey,
    source: input.source ?? (input.url ? "web" : "paste"),
    is_monitoring_scan: input.isMonitoringScan ?? false,
    previous_scan_id: input.previousScanId ?? null,
    document_type: input.document.type,
    document_type_confidence: input.document.confidence,
    document_type_source: input.document.classifierVersion,
    document_type_evidence: input.document.evidence,
    document_identity_key: input.document.identityKey,
    decision: "open",
    ...(input.createdAt ? { created_at: input.createdAt } : {}),
  }

  let scanResult = await database
    .from("scans")
    .insert(scanPayload)
    .select("id")
    .single()

  if (scanResult.error && isMissingColumnError(scanResult.error)) {
    const legacyPayload = { ...scanPayload } as Record<string, unknown>
    delete legacyPayload.document_type
    delete legacyPayload.document_type_confidence
    delete legacyPayload.document_type_source
    delete legacyPayload.document_type_evidence
    delete legacyPayload.document_identity_key
    delete legacyPayload.is_monitoring_scan
    delete legacyPayload.previous_scan_id
    delete legacyPayload.jurisdiction_country
    delete legacyPayload.jurisdiction_state
    scanResult = await database
      .from("scans")
      .insert(legacyPayload)
      .select("id")
      .single()
  }

  if (scanResult.error || !scanResult.data?.id) {
    await deleteScanDocument(documentObjectKey).catch(() => undefined)
    if (scanResult.error) throw scanResult.error
    throw new Error("Failed to create scan record")
  }

  try {
    await insertClauses(scanId, normalizedResult)
  } catch (reason) {
    const cleanupErrors: unknown[] = []
    const rowCleanup = await database.from("scans").delete().eq("id", scanId)
    if (rowCleanup.error) cleanupErrors.push(rowCleanup.error)
    try {
      await deleteScanDocument(documentObjectKey)
    } catch (cleanupError) {
      cleanupErrors.push(cleanupError)
    }
    if (cleanupErrors.length > 0) {
      throw new AggregateError(
        [reason, ...cleanupErrors],
        "Failed to persist a scan and fully clean up its partial data",
      )
    }
    throw reason
  }

  try {
    await persistComplianceTags(scanId, normalizedResult)
  } catch (ctErr) {
    const message = ctErr instanceof Error ? ctErr.message : "Unknown error"
    console.warn(`[persistence] Compliance tags storage skipped: ${message}`)
  }

  if (normalizedResult.jevDiagnostics) {
    try {
      const diagnostics = normalizedResult.jevDiagnostics
      const { error } = await database.from("scan_jev_diagnostics").insert({
        scan_id: scanId,
        model_version: diagnostics.modelVersion,
        duration_ms: diagnostics.durationMs,
        decisions_json: JSON.stringify(diagnostics),
      })
      if (error) throw error
    } catch (error) {
      // The diagnostics migration is independent of the scan release.
      console.warn("[persistence] Jev diagnostics storage skipped", error instanceof Error ? error.message : "Unknown error")
    }
  }

  if (input.fullExtraction && input.fullExtraction.length > 0) {
    try {
      await persistFullExtraction(scanId, input.fullExtraction)
    } catch (feErr) {
      const message = feErr instanceof Error ? feErr.message : "Unknown error"
      console.warn(`[persistence] Full extraction storage skipped: ${message}`)
    }
  }

  try {
    revalidateTag("public-live-stats", "max")
  } catch (error) {
    console.warn(
      "[persistence] live-stats revalidation skipped",
      error instanceof Error ? error.message : "Unknown error",
    )
  }
  return scanId
}

export async function getCachedExplanation(
  category: ClauseAnalysis["category"],
  text: string
): Promise<CachedExplanation | null> {
  const database = getDatabase()
  const clauseHash = buildClauseHash(text, category)

  const { data, error } = await database
    .from("explanations_cache")
    .select("explanation, why_it_matters, recommended_action, model, expires_at")
    .eq("clause_hash", clauseHash)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const entry = data as unknown as CacheEntry
  return {
    explanation: entry.explanation,
    whyItMatters: entry.why_it_matters,
    recommendedAction: entry.recommended_action,
    model: entry.model,
  }
}

export async function storeCachedExplanation(
  category: ClauseAnalysis["category"],
  text: string,
  explanation: CachedExplanation
): Promise<void> {
  const database = getDatabase()
  const clauseHash = buildClauseHash(text, category)

  const { error } = await database.from("explanations_cache").upsert(
    {
      clause_hash: clauseHash,
      category,
      explanation: explanation.explanation,
      why_it_matters: explanation.whyItMatters,
      recommended_action: explanation.recommendedAction,
      model: explanation.model,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
    { onConflict: "clause_hash" }
  )

  if (error) throw error
}

export type CreditPackRecord = {
  id: string
  packSize: number
  creditsRemaining: number
  expiresAt: string
  purchasedAt: string
  pricePaid: number
}

export async function consumeCreditForClerkId(
  clerkId: string,
  options: {
    idempotencyKey?: string
    purpose?: "scan_overflow" | "ai_overflow"
  } = {},
): Promise<{ consumed: boolean; remaining: number; replay: boolean }> {
  const database = getDatabase()
  const { data, error } = await database.rpc("consume_user_credit", {
    p_clerk_id: clerkId,
    p_idempotency_key: options.idempotencyKey ?? crypto.randomUUID(),
    p_purpose: options.purpose ?? "scan_overflow",
  })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  return {
    consumed: row?.consumed === true,
    remaining: typeof row?.remaining === "number" ? row.remaining : 0,
    replay: row?.is_replay === true,
  }
}

export async function refundCreditForClerkId(
  clerkId: string,
  idempotencyKey: string,
): Promise<boolean> {
  const { data, error } = await getDatabase().rpc("refund_user_credit", {
    p_clerk_id: clerkId,
    p_idempotency_key: idempotencyKey,
  })
  if (error) throw error
  return data === true
}

export async function getCreditPacksByClerkId(clerkId: string): Promise<CreditPackRecord[]> {
  const userId = await getUserIdByClerkId(clerkId)
  if (!userId) return []

  const database = getDatabase()
  const { data, error } = await database
    .from("credit_packs")
    .select("id, pack_size, credits_remaining, expires_at, purchased_at, price_paid")
    .eq("user_id", userId)
    .order("purchased_at", { ascending: false })

  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id as string,
    packSize: Number(row.pack_size ?? 0),
    creditsRemaining: Number(row.credits_remaining ?? 0),
    expiresAt: row.expires_at as string,
    purchasedAt: row.purchased_at as string,
    pricePaid: Number(row.price_paid ?? 0),
  }))
}

export async function getUsageSummaryByClerkId(
  clerkId: string,
  tier: RateLimitTier
): Promise<{
  scans: RateLimitResult
  ai: RateLimitResult
  creditBalance: number
}> {
  const [scans, ai, creditBalance] = await Promise.all([
    getRateLimitStatus(clerkId, tier, "scans"),
    getRateLimitStatus(clerkId, tier, "ai"),
    getCreditBalanceByClerkId(clerkId),
  ])
  return { scans, ai, creditBalance }
}

/* ─── Full Extraction Persistence ─── */

export async function persistFullExtraction(
  scanId: string,
  sections: FullExtractionSection[]
): Promise<void> {
  const database = getDatabase()
  const validSections = sections.filter(
    (section) =>
      Boolean(section.section) &&
      Array.isArray(section.keyPoints) &&
      section.keyPoints.some((kp) => kp.title && kp.detail),
  )
  const sectionRows = validSections.map((section, position) => ({
    id: crypto.randomUUID(),
    scan_id: scanId,
    section: section.section,
    icon: section.icon || "📄",
    position,
  }))

  if (sectionRows.length === 0) return

  const { error: sectionError } = await database
    .from("full_extraction_sections")
    .insert(sectionRows)
  if (sectionError) throw sectionError

  const pointRows = validSections.flatMap((section, sectionIndex) =>
    section.keyPoints
      .filter((kp) => kp.title && kp.detail)
      .map((kp, position) => ({
        section_id: sectionRows[sectionIndex].id,
        title: kp.title,
        detail: kp.detail,
        quote: kp.quote || "",
        severity: kp.severity || "info",
        position,
      })),
  )

  if (pointRows.length === 0) return

  const { error: pointsError } = await database
    .from("full_extraction_points")
    .insert(pointRows)

  if (pointsError) throw pointsError
}

export async function getFullExtractionByScanId(
  scanId: string
): Promise<FullExtractionSection[]> {
  const database = getDatabase()

  const { data: sectionRows, error: sectionError } = await database
    .from("full_extraction_sections")
    .select("id, section, icon, position")
    .eq("scan_id", scanId)
    .order("position", { ascending: true })

  if (sectionError) throw sectionError
  if (!sectionRows || sectionRows.length === 0) return []

  const sectionIds = sectionRows.map((s) => s.id as string)

  const { data: pointRows, error: pointsError } = await database
    .from("full_extraction_points")
    .select("id, section_id, title, detail, quote, severity, position")
    .in("section_id", sectionIds)
    .order("position", { ascending: true })

  if (pointsError) throw pointsError

  const pointsBySection = new Map<string, Record<string, any>[]>()
  for (const point of pointRows ?? []) {
    const sectionId = point.section_id as string
    const existing = pointsBySection.get(sectionId) ?? []
    existing.push(point)
    pointsBySection.set(sectionId, existing)
  }

  return sectionRows.map((s) => ({
    section: s.section as string,
    icon: (s.icon as string) || "📄",
    keyPoints: (pointsBySection.get(s.id as string) ?? []).map((p) => ({
      title: p.title as string,
      detail: p.detail as string,
      quote: (p.quote as string) || "",
      severity: (p.severity as "info" | "caution" | "warning") || "info",
    })),
  }))
}
