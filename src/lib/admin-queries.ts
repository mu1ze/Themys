import "server-only"

import { revalidateTag } from "next/cache"

import { getDatabase, getDatabaseBinding } from "@/lib/database"
import type { D1Value } from "@/lib/database-client"
import { type UserProfileRecord, type ScanRecord, type ClauseRecord, type InvoiceRecord, type CreditPackRecord } from "@/lib/persistence"
import { getFullExtractionByScanId } from "@/lib/persistence"
import { isKvAvailable, listCacheKeysByPrefix } from "@/lib/cache"
import { RATE_LIMITS, getRateLimitStatus } from "@/lib/rate-limit"
import { isAdminScanId } from "@/lib/admin-scan-id"
import { getStripe } from "@/lib/stripe"
import type { FullExtractionSection } from "@/lib/llm"
import { deleteScanDocument, readScanDocument } from "@/lib/object-storage"

/* ─── Types ─── */

export type AdminStats = {
  totalUsers: number
  totalScans: number
  scansToday: number
  activeSubscribers: number
  totalRevenue: number
  explanationCacheCount: number
  planDistribution: Record<string, number>
}

export type AdminUserRow = {
  id: string
  clerkId: string
  email: string
  plan: string
  stripeCustomerId: string | null
  subscriptionStatus: string | null
  scanCount: number
  creditBalance: number
  createdAt: string
  updatedAt: string
}

export type AdminScanRow = {
  id: string
  title: string | null
  url: string | null
  domain: string | null
  jurisdiction_country?: string | null
  jurisdiction_state?: string | null
  riskScore: number | null
  clauseCount: number
  flaggedCount: number
  source: string
  createdAt: string
  userEmail: string | null
  userId: string
  rawText?: string | null
}

export type AdminUserDetail = {
  profile: UserProfileRecord
  scans: ScanRecord[]
  creditPacks: CreditPackRecord[]
  invoices: InvoiceRecord[]
  scanRateLimit: { remaining: number; limit: number; resetsAt: number } | null
  aiRateLimit: { remaining: number; limit: number; resetsAt: number } | null
}

export type SystemHealthData = {
  scanVolumeByDay: { date: string; count: number }[]
  avgRiskScore: number
  topCategories: { category: string; count: number }[]
  sourceBreakdown: { source: string; count: number }[]
  totalClauses: number
  totalFlagged: number
  rateLimits: typeof RATE_LIMITS
}

export type StripeRevenueData = {
  totalRevenue: number
  mrr: number
  recentCharges: {
    id: string
    amount: number
    currency: string
    status: string
    description: string | null
    customerEmail: string | null
    created: number
  }[]
  subscriptionCounts: { status: string; count: number }[]
  creditPackRevenue: number
  creditPackSummary: {
    totalSold: number
    totalConsumed: number
    totalExpired: number
  }
}

export type ConversionSignals = {
  windowDays: number
  funnel: {
    activatedUsers: number
    paywallViewers: number
    checkoutStarters: number
    payers: number
  }
  quotaRejections: {
    total: number
    byKind: { kind: string; count: number }[]
    byDay: { date: string; count: number }[]
  }
  paywallViews: {
    total: number
    byVariant: { variant: string; count: number }[]
  }
  pricingViews: number
  checkoutStarts: number
}

export type RevenueTrendPoint = { date: string; amount: number }

export type UsageTrendPoint = { date: string; count: number }

export type UsageTrendData = {
  windowDays: number
  series: UsageTrendPoint[]
  totalEvents: number
  quotaRejected: number
  peakDay: UsageTrendPoint | null
}

export type AdminNavigationSummary = {
  dataState: "connected" | "unavailable"
  unclassifiedScans: number | null
}

/* ─── Queries ─── */

/**
 * Lightweight, best-effort facts for the persistent admin shell. The shell
 * must remain usable when D1 is unavailable, and it must never render a
 * guessed operational count.
 */
export async function getAdminNavigationSummary(): Promise<AdminNavigationSummary> {
  const database = getDatabase()

  try {
    const { count, error } = await database
      .from("scans")
      .select("*", { count: "exact", head: true })
      .eq("is_deleted", false)
      .eq("document_type", "unknown")

    if (error) throw error

    return {
      dataState: "connected",
      unclassifiedScans: count ?? 0,
    }
  } catch (reason) {
    console.error(
      "[admin-navigation] D1 summary unavailable",
      reason instanceof Error ? reason.message : "unknown database error",
    )
    return { dataState: "unavailable", unclassifiedScans: null }
  }
}

export async function getAdminStats(): Promise<AdminStats> {
  const database = getDatabase()

  const [
    { count: totalUsers },
    { count: totalScans },
    { count: scansToday },
    { count: activeSubscribers },
    { count: explanationCacheCount },
  ] = await Promise.all([
    database.from("users").select("*", { count: "exact", head: true }),
    database.from("scans").select("*", { count: "exact", head: true }),
    database
      .from("scans")
      .select("*", { count: "exact", head: true })
      .gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
    database
      .from("users")
      .select("*", { count: "exact", head: true })
      .in("subscription_status", ["active", "trialing"]),
    database.from("explanations_cache").select("*", { count: "exact", head: true }),
  ])

  // Plan distribution
  const { data: planRows } = await database
    .from("users")
    .select("plan")

  const planDistribution: Record<string, number> = {}
  for (const row of planRows ?? []) {
    const plan = (row.plan as string) ?? "free"
    planDistribution[plan] = (planDistribution[plan] ?? 0) + 1
  }

  // Total revenue from invoices table
  const { data: revenueRows } = await database
    .from("invoices")
    .select("amount")
    .eq("status", "paid")

  const totalRevenue = (revenueRows ?? []).reduce(
    (sum, row) => sum + Number(row.amount ?? 0),
    0
  )

  return {
    totalUsers: totalUsers ?? 0,
    totalScans: totalScans ?? 0,
    scansToday: scansToday ?? 0,
    activeSubscribers: activeSubscribers ?? 0,
    totalRevenue,
    explanationCacheCount: explanationCacheCount ?? 0,
    planDistribution,
  }
}

export async function listAllUsers(
  page = 1,
  pageSize = 25,
  search?: string,
  planFilter?: string
): Promise<{ users: AdminUserRow[]; total: number }> {
  const database = getDatabase()
  const offset = (page - 1) * pageSize

  let query = database
    .from("users")
    .select("id, clerk_id, email, plan, stripe_customer_id, subscription_status, created_at, updated_at", { count: "exact" })

  if (search) {
    query = query.ilike("email", `%${search}%`)
  }
  if (planFilter && planFilter !== "all") {
    query = query.eq("plan", planFilter)
  }

  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1)

  if (error) throw error

  // Batch fetch scan counts and credit balances
  const userIds = (data ?? []).map((u) => u.id as string)

  const [scanCounts, creditBalances] = await Promise.all([
    batchScanCounts(userIds),
    batchCreditBalances(userIds),
  ])

  const users: AdminUserRow[] = (data ?? []).map((row) => ({
    id: row.id as string,
    clerkId: row.clerk_id as string,
    email: row.email as string,
    plan: row.plan as string,
    stripeCustomerId: (row.stripe_customer_id as string | null) ?? null,
    subscriptionStatus: (row.subscription_status as string | null) ?? null,
    scanCount: scanCounts.get(row.id as string) ?? 0,
    creditBalance: creditBalances.get(row.id as string) ?? 0,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }))

  return { users, total: count ?? 0 }
}

async function batchScanCounts(userIds: string[]): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map()
  const database = getDatabase()
  const { data } = await database
    .from("scans")
    .select("user_id")
    .in("user_id", userIds)
    .eq("is_deleted", false)

  const counts = new Map<string, number>()
  for (const row of data ?? []) {
    const uid = row.user_id as string
    counts.set(uid, (counts.get(uid) ?? 0) + 1)
  }
  return counts
}

async function batchCreditBalances(userIds: string[]): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map()
  const database = getDatabase()
  const { data } = await database
    .from("credit_packs")
    .select("user_id, credits_remaining")
    .in("user_id", userIds)
    .gt("credits_remaining", 0)
    .eq("refund_hold", false)
    .gt("expires_at", new Date().toISOString())

  const balances = new Map<string, number>()
  for (const row of data ?? []) {
    const uid = row.user_id as string
    balances.set(uid, (balances.get(uid) ?? 0) + Number(row.credits_remaining ?? 0))
  }
  return balances
}

export async function getUserAdminDetail(userId: string): Promise<AdminUserDetail | null> {
  const database = getDatabase()

  const { data: profileData, error: profileError } = await database
    .from("users")
    .select("id, clerk_id, email, plan, stripe_customer_id, subscription_status, subscription_ends_at, country, state, target_clauses, strict_mode, playbook_id, created_at, updated_at")
    .eq("id", userId)
    .maybeSingle()

  if (profileError) throw profileError
  if (!profileData) return null

  const profile: UserProfileRecord = {
    id: profileData.id as string,
    clerkId: profileData.clerk_id as string,
    email: profileData.email as string,
    plan: profileData.plan as UserProfileRecord["plan"],
    stripeCustomerId: (profileData.stripe_customer_id as string | null) ?? null,
    subscriptionStatus: (profileData.subscription_status as string | null) ?? null,
    subscriptionEndsAt: (profileData.subscription_ends_at as string | null) ?? null,
    country: (profileData.country as string | null) ?? null,
    state: (profileData.state as string | null) ?? null,
    targetClauses: (profileData.target_clauses as string[] | null) ?? [],
    strictMode: Boolean(profileData.strict_mode),
    playbookId:
      profileData.playbook_id === "saas_vendor" || profileData.playbook_id === "contractor"
        ? profileData.playbook_id
        : "consumer_app",
    createdAt: profileData.created_at as string,
    updatedAt: profileData.updated_at as string,
  }

  const [scansResult, creditsResult, invoicesResult] = await Promise.all([
    database
      .from("scans")
      .select("id, title, url, domain, jurisdiction_country, jurisdiction_state, risk_score, clause_count, flagged_count, source, decision, document_type, document_type_confidence, document_identity_key, created_at")
      .eq("user_id", userId)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(50),
    database
      .from("credit_packs")
      .select("id, pack_size, credits_remaining, expires_at, purchased_at, price_paid")
      .eq("user_id", userId)
      .order("purchased_at", { ascending: false }),
    database
      .from("invoices")
      .select("id, amount, currency, status, description, paid_at")
      .eq("user_id", userId)
      .order("paid_at", { ascending: false })
      .limit(50),
  ])

  const scans: ScanRecord[] = (scansResult.data ?? []).map((row) => ({
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
    decision:
      row.decision === "sign" || row.decision === "negotiate" || row.decision === "walk_away"
        ? row.decision
        : "open",
    rawText: null,
    documentType: row.document_type as ScanRecord["documentType"],
    documentTypeConfidence: row.document_type_confidence != null ? Number(row.document_type_confidence) : null,
    documentIdentityKey: (row.document_identity_key as string | null) ?? null,
    createdAt: row.created_at as string,
  }))

  const creditPacks: CreditPackRecord[] = (creditsResult.data ?? []).map((row) => ({
    id: row.id as string,
    packSize: Number(row.pack_size ?? 0),
    creditsRemaining: Number(row.credits_remaining ?? 0),
    expiresAt: row.expires_at as string,
    purchasedAt: row.purchased_at as string,
    pricePaid: Number(row.price_paid ?? 0),
  }))

  const invoices: InvoiceRecord[] = (invoicesResult.data ?? []).map((row) => ({
    id: row.id as string,
    amount: Number(row.amount),
    currency: row.currency as string,
    status: row.status as InvoiceRecord["status"],
    description: (row.description as string | null) ?? null,
    paidAt: (row.paid_at as string | null) ?? null,
  }))

  const tier = profile.plan === "base" || profile.plan === "advanced" ? profile.plan : "free" as const
  const [scanRateLimit, aiRateLimit] = await Promise.all([
    getRateLimitStatus(profile.clerkId, tier, "scans").catch(() => null),
    getRateLimitStatus(profile.clerkId, tier, "ai").catch(() => null),
  ])

  return {
    profile,
    scans,
    creditPacks,
    invoices,
    scanRateLimit,
    aiRateLimit,
  }
}

export async function updateUserPlan(
  userId: string,
  plan: "free" | "base" | "advanced" | "lifetime"
): Promise<void> {
  const database = getDatabase()

  const { data: userData } = await database
    .from("users")
    .select("clerk_id, stripe_subscription_id")
    .eq("id", userId)
    .single()

  if (!userData) throw new Error("User not found")

  // Free and lifetime are not backed by an ongoing subscription. Stop billing
  // before applying either, or the user would keep being charged for access
  // the admin just revoked (free) or replaced with a lifetime grant (lifetime).
  // Fail closed: if Stripe cannot schedule cancellation, abort the plan change.
  if ((plan === "free" || plan === "lifetime") && userData.stripe_subscription_id) {
    const stripe = getStripe()
    const subscription = await stripe.subscriptions
      .retrieve(userData.stripe_subscription_id as string)
      .catch(() => null)
    const cancellable = new Set(["active", "trialing", "past_due", "unpaid", "paused"])
    if (subscription && cancellable.has(subscription.status)) {
      if (!subscription.cancel_at_period_end) {
        const updated = await stripe.subscriptions.update(subscription.id, {
          cancel_at_period_end: true,
        })
        const periodEnd = updated.items.data[0]?.current_period_end
        await database
          .from("users")
          .update({
            subscription_status: "canceling",
            subscription_ends_at: periodEnd
              ? new Date(periodEnd * 1000).toISOString()
              : null,
          })
          .eq("id", userId)
      }
    }
  }

  await database
    .from("users")
    .update({ plan, updated_at: new Date().toISOString() })
    .eq("id", userId)

  // Sync Clerk tier metadata
  try {
    const { clerkClient } = await import("@clerk/nextjs/server")
    const client = await clerkClient()
    await client.users.updateUserMetadata(userData.clerk_id as string, {
      publicMetadata: { tier: plan === "lifetime" ? "advanced" : plan },
    })
  } catch {
    // Best effort
  }
}

export async function listAllScans(
  page = 1,
  pageSize = 25,
  filters?: {
    search?: string
    riskLevel?: "low" | "medium" | "high"
    source?: string
  }
): Promise<{ scans: AdminScanRow[]; total: number }> {
  type ScanDirectoryRow = {
    raw_text_hash: string
    title: string | null
    url: string | null
    domain: string | null
    risk_score: number | null
    clause_count: number | null
    flagged_count: number | null
    source: string | null
    created_at: string
    user_id: string | null
  }

  const database = getDatabase()
  const binding = getDatabaseBinding()
  const offset = (page - 1) * pageSize
  const where = ["is_deleted = 0", "raw_text_hash IS NOT NULL"]
  const values: D1Value[] = []

  if (filters?.search?.trim()) {
    const escaped = filters.search
      .trim()
      .toLowerCase()
      .replace(/\\/g, "\\\\")
      .replace(/%/g, "\\%")
      .replace(/_/g, "\\_")
    const needle = `%${escaped}%`
    where.push("(lower(domain) LIKE ? ESCAPE '\\' OR lower(title) LIKE ? ESCAPE '\\')")
    values.push(needle, needle)
  }

  if (filters?.riskLevel === "high") {
    where.push("risk_score >= 7")
  } else if (filters?.riskLevel === "medium") {
    where.push("risk_score >= 4 AND risk_score < 7")
  } else if (filters?.riskLevel === "low") {
    where.push("risk_score < 4")
  }

  if (filters?.source && filters.source !== "all") {
    where.push("source = ?")
    values.push(filters.source)
  }

  const predicate = where.join(" AND ")
  const countStatement = binding
      .prepare(`SELECT COUNT(*) AS count FROM (
        SELECT substr(raw_text_hash, 1, 16)
        FROM scans
        WHERE ${predicate}
        GROUP BY substr(raw_text_hash, 1, 16)
      )`)
      .bind(...values)
  const pageStatement = binding
      .prepare(`WITH ranked AS (
        SELECT raw_text_hash, title, url, domain, risk_score, clause_count,
          flagged_count, source, created_at, user_id,
          ROW_NUMBER() OVER (
            PARTITION BY substr(raw_text_hash, 1, 16)
            ORDER BY created_at DESC, id DESC
          ) AS duplicate_rank
        FROM scans
        WHERE ${predicate}
      )
      SELECT raw_text_hash, title, url, domain, risk_score, clause_count,
        flagged_count, source, created_at, user_id
      FROM ranked
      WHERE duplicate_rank = 1
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?`)
      .bind(...values, pageSize, offset)
  const [countResult, pageResult] = await Promise.all([
    countStatement.all<{ count: number }>(),
    pageStatement.all<ScanDirectoryRow>(),
  ])

  if (
    countResult?.success === false || countResult?.error || !countResult?.results ||
    pageResult?.success === false || pageResult?.error || !pageResult?.results
  ) {
    const message = countResult?.error ?? pageResult?.error ?? "D1 scan query failed"
    console.error("[admin] listAllScans query failed", message)
    throw new Error("Could not load the scan directory")
  }

  const total = Number(countResult.results[0]?.count ?? 0)
  const paginated = pageResult.results

  // Batch-fetch user emails for this page
  const userIds = [...new Set(paginated.map(r => r.user_id).filter(Boolean))]
  const emailMap = new Map<string, string>()
  if (userIds.length > 0) {
    const { data: userRows } = await database
      .from("users")
      .select("id, email")
      .in("id", userIds)
    for (const u of userRows ?? []) {
      emailMap.set(u.id as string, u.email as string)
    }
  }

  // Map to AdminScanRow
  const scans: AdminScanRow[] = paginated.map(row => ({
    id: row.raw_text_hash.slice(0, 16),
    title: row.title ?? null,
    url: row.url ?? null,
    domain: row.domain ?? null,
    riskScore: row.risk_score != null ? Number(row.risk_score) : null,
    clauseCount: Number(row.clause_count ?? 0),
    flaggedCount: Number(row.flagged_count ?? 0),
    source: row.source ?? "web",
    createdAt: row.created_at ?? new Date().toISOString(),
    userEmail: row.user_id ? (emailMap.get(row.user_id) ?? null) : null,
    userId: row.user_id ?? "global",
  }))

  return { scans, total }
}

export async function getAdminScanDetail(scanId: string): Promise<{
  scan: AdminScanRow
  clauses: ClauseRecord[]
  fullExtraction: FullExtractionSection[]
  userEmail: string | null
} | null> {
  if (!isAdminScanId(scanId)) return null

  const { getCached } = await import("@/lib/cache")
  const cached = await getCached<import("@/lib/cache").UnifiedScanResult>(`scan:v3:${scanId}`)

  const database = getDatabase()

  const { data: dbScan } = await database
    .from("scans")
    .select("id, title, domain, url, source, created_at, user_id, jurisdiction_country, jurisdiction_state, raw_text, document_object_key, risk_score")
    .like("raw_text_hash", `${scanId}%`)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!cached && !dbScan) {
    return null
  }

  let userEmail: string | null = dbScan?.user_id ? null : "Global Cache"
  if (dbScan?.user_id) {
    const { data: userData } = await database
      .from("users")
      .select("email")
      .eq("id", dbScan.user_id)
      .maybeSingle()
    if (userData?.email) userEmail = userData.email
  }

  let clauses: ClauseRecord[]
  let fullExtraction: FullExtractionSection[]

  if (cached) {
    clauses = cached.result.clauses.map((c, i) => {
      const flag = cached.result.flags.find(f => f.category === c.matchedCategory && c.text.includes(f.text)) || cached.result.flags.find(f => c.text.includes(f.text))
      return {
        id: `clause-${i}`,
        text: flag ? flag.text : c.text,
        category: flag ? flag.category : c.matchedCategory,
        riskScore: flag ? flag.riskScore ?? c.riskScore : c.riskScore,
        riskLevel: flag ? (flag.severity === "high" ? "red" : flag.severity === "medium" ? "yellow" : "green") : c.riskLevel,
        position: i + 1,
        isFlagged: Boolean(flag),
        isStandardPractice: Boolean((flag as any)?.isStandardPractice || (c as any)?.isStandardPractice),
        isTargetClause: Boolean((flag as any)?.isTargetClause || (c as any)?.isTargetClause),
        isAiExplained: false,
        explanation: flag?.explanation ?? null,
        whyItMatters: flag?.whyItMatters ?? null,
        recommendedAction: flag?.recommendedAction ?? null,
        confidence: flag ? flag.confidence ?? c.confidence : c.confidence,
      }
    })
    fullExtraction = cached.fullExtraction || []
  } else {
    const { data: clauseRows, error: clausesError } = await database
      .from("clauses")
      .select("text, category, risk_score, risk_level, position, is_flagged, is_ai_explained, is_standard_practice, is_target_clause, explanation, why_it_matters, recommended_action, confidence")
      .eq("scan_id", dbScan!.id)
      .order("position", { ascending: true })

    if (clausesError) {
      console.error(
        "[admin] fallback clause fetch failed",
        clausesError.code ?? "UnknownError",
      )
      return null
    }

    clauses = (clauseRows ?? []).map((c, i) => ({
      id: `clause-${i}`,
      text: c.text as string,
      category: (c.category as string) ?? null,
      riskScore: c.risk_score != null ? Number(c.risk_score) : null,
      riskLevel: (c.risk_level as "green" | "yellow" | "red") ?? null,
      position: c.position != null ? Number(c.position) : i + 1,
      isFlagged: Boolean(c.is_flagged),
      isAiExplained: Boolean(c.is_ai_explained),
      isStandardPractice: Boolean(c.is_standard_practice),
      isTargetClause: Boolean(c.is_target_clause),
      explanation: (c.explanation as string) ?? null,
      whyItMatters: (c.why_it_matters as string) ?? null,
      recommendedAction: (c.recommended_action as string | null) ?? null,
      confidence: c.confidence != null ? Number(c.confidence) : null,
    }))

    fullExtraction = await getFullExtractionByScanId(dbScan!.id as string)
  }

  const clauseCount = cached ? cached.result.clauses.length : clauses.length
  const flaggedCount = cached ? cached.result.flags.length : clauses.filter(c => c.isFlagged).length
  const riskScore = cached ? cached.result.riskScore : (dbScan!.risk_score != null ? Number(dbScan!.risk_score) : null)
  const storedRawText = dbScan?.document_object_key
    ? await readScanDocument(dbScan.document_object_key as string)
    : null

  const scan: AdminScanRow = {
    id: scanId,
    title: dbScan?.title ?? (cached ? "Cached Scan" : "Untitled Scan"),
    url: dbScan?.url ?? null,
    domain: dbScan?.domain ?? null,
    jurisdiction_country: dbScan?.jurisdiction_country ?? null,
    jurisdiction_state: dbScan?.jurisdiction_state ?? null,
    riskScore,
    clauseCount,
    flaggedCount,
    source: dbScan?.source ?? "unknown",
    createdAt: dbScan?.created_at ?? new Date().toISOString(),
    userEmail,
    userId: dbScan?.user_id ?? "global",
    rawText: storedRawText ?? (dbScan?.raw_text as string) ?? null,
  }

  return {
    scan,
    clauses,
    fullExtraction,
    userEmail,
  }
}

export async function deleteScanAdmin(scanId: string): Promise<boolean> {
  // Admin scan ids are content hashes (hex). Reject anything else so the
  // LIKE prefix match below can never be widened by wildcard characters.
  if (!isAdminScanId(scanId)) return false

  const database = getDatabase()

  const { data: matchingRows, error: matchingError } = await database
    .from("scans")
    .select("id, document_object_key")
    .like("raw_text_hash", `${scanId}%`)
  if (matchingError) {
    console.error("[admin] Failed to resolve DB rows", matchingError.code ?? "UnknownError")
    return false
  }

  // Soft-delete every DB scan row sharing this content hash — the same
  // document may have been scanned by multiple users. Without this the
  // "deleted" scan would remain visible in user history and admin lists.
  const { error } = await database
    .from("scans")
    .update({ is_deleted: true, raw_text: null })
    .like("raw_text_hash", `${scanId}%`)
  if (error) {
    console.error("[admin] Failed to soft-delete DB rows", error.code ?? "UnknownError")
    return false
  }

  const objectDeletes = await Promise.allSettled(
    (matchingRows ?? []).map((row) => deleteScanDocument(
      typeof row.document_object_key === "string" ? row.document_object_key : null,
    )),
  )
  if (objectDeletes.some((result) => result.status === "rejected")) {
    console.error("[admin] One or more R2 scan documents could not be deleted")
    return false
  }

  // Cache eviction is best-effort: the DB rows are the source of truth for
  // what users see, and the entry may already be absent.
  try {
    const { deleteCachedScansByTextHash } = await import("@/lib/cache")
    await deleteCachedScansByTextHash(scanId)
  } catch (cacheErr) {
    console.warn(
      "[admin] Failed to delete KV cache",
      cacheErr instanceof Error ? cacheErr.name : "UnknownError",
    )
  }

  revalidateTag("public-live-stats", "max")
  return true
}

export async function getCacheOverview() {
  const kvAvailable = await isKvAvailable()

  async function collectKeys(prefix: string) {
    const keys: { name: string; metadata?: unknown }[] = []
    let cursor: string | undefined
    do {
      const page = await listCacheKeysByPrefix(prefix, { limit: 999, cursor })
      keys.push(...page.keys)
      cursor = page.list_complete ? undefined : page.cursor
    } while (cursor)
    return keys
  }

  const [scanKeys, textKeys] = await Promise.all([
    collectKeys("scan:v3:"),
    collectKeys("text:"),
  ])

  const domainCounts = new Map<string, number>()
  for (const k of scanKeys) {
    const meta = k.metadata as { domain?: string } | undefined
    const domain = meta?.domain?.trim()
    if (domain) {
      domainCounts.set(domain, (domainCounts.get(domain) ?? 0) + 1)
    }
  }

  const topDomains = Array.from(domainCounts.entries())
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  return {
    kvAvailable,
    scanEntries: scanKeys.length,
    textEntries: textKeys.length,
    topDomains,
  }
}

export async function getSystemHealth(): Promise<SystemHealthData> {
  const database = getDatabase()

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString()

  const [scansResult, clausesResult, flaggedResult] = await Promise.all([
    database
      .from("scans")
      .select("created_at, risk_score, source")
      .gte("created_at", thirtyDaysAgo)
      .order("created_at", { ascending: true }),
    database.from("clauses").select("*", { count: "exact", head: true }),
    database
      .from("clauses")
      .select("category")
      .eq("is_flagged", true),
  ])

  // Scan volume by day
  const volumeByDay = new Map<string, number>()
  let totalRiskScore = 0
  let riskCount = 0
  const sourceCounts = new Map<string, number>()

  for (const row of scansResult.data ?? []) {
    const date = (row.created_at as string).slice(0, 10)
    volumeByDay.set(date, (volumeByDay.get(date) ?? 0) + 1)

    if (row.risk_score != null) {
      totalRiskScore += Number(row.risk_score)
      riskCount++
    }

    const source = (row.source as string) ?? "web"
    sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1)
  }

  // Top flagged categories
  const categoryCounts = new Map<string, number>()
  for (const row of flaggedResult.data ?? []) {
    const cat = (row.category as string) ?? "uncategorized"
    categoryCounts.set(cat, (categoryCounts.get(cat) ?? 0) + 1)
  }

  return {
    scanVolumeByDay: Array.from(volumeByDay.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    avgRiskScore: riskCount > 0 ? totalRiskScore / riskCount : 0,
    topCategories: Array.from(categoryCounts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    sourceBreakdown: Array.from(sourceCounts.entries())
      .map(([source, count]) => ({ source, count })),
    totalClauses: clausesResult.count ?? 0,
    totalFlagged: (flaggedResult.data ?? []).length,
    rateLimits: RATE_LIMITS,
  }
}

export async function getStripeRevenueData(): Promise<StripeRevenueData> {
  const stripe = getStripe()

  // Fetch recent charges from Stripe
  const charges = await stripe.charges.list({ limit: 50 })

  const recentCharges = charges.data.map((charge) => ({
    id: charge.id,
    amount: charge.amount / 100,
    currency: charge.currency,
    status: charge.status,
    description: charge.description ?? null,
    customerEmail: charge.billing_details?.email ?? null,
    created: charge.created,
  }))

  const totalRevenue = charges.data
    .filter((c) => c.status === "succeeded")
    .reduce((sum, c) => sum + c.amount / 100, 0)

  // Fetch active subscriptions for MRR
  const subscriptions = await stripe.subscriptions.list({ limit: 100, status: "all" })

  let mrr = 0
  const statusCounts = new Map<string, number>()

  for (const sub of subscriptions.data) {
    const status = sub.status
    statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1)

    if (status === "active" || status === "trialing") {
      const item = sub.items?.data[0]
      if (item?.price?.unit_amount && item.price.recurring) {
        const amount = item.price.unit_amount / 100
        const interval = item.price.recurring.interval
        if (interval === "month") {
          mrr += amount
        } else if (interval === "year") {
          mrr += amount / 12
        }
      }
    }
  }

  // Credit Pack Summary from Database
  const database = getDatabase()
  const { data: creditPacks } = await database
    .from("credit_packs")
    .select("credits_total, credits_remaining, expires_at, price_paid")

  let totalSold = 0
  let totalConsumed = 0
  let totalExpired = 0
  let creditPackRevenue = 0

  const now = new Date().toISOString()
  for (const pack of creditPacks ?? []) {
    const total = Number(pack.credits_total ?? 0)
    const remaining = Number(pack.credits_remaining ?? 0)
    const consumed = total - remaining
    
    totalSold += total
    totalConsumed += consumed
    creditPackRevenue += Number(pack.price_paid ?? 0)

    if (pack.expires_at && pack.expires_at < now) {
      totalExpired += remaining
    }
  }

  return {
    totalRevenue,
    mrr: Math.round(mrr * 100) / 100,
    recentCharges,
    subscriptionCounts: Array.from(statusCounts.entries())
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count),
    creditPackRevenue,
    creditPackSummary: {
      totalSold,
      totalConsumed,
      totalExpired,
    }
  }
}

/** Count of users currently on a paid plan or active/trialing subscription. */
export async function getPayingUserCount(): Promise<number> {
  const database = getDatabase()
  const { count, error } = await database
    .from("users")
    .select("*", { count: "exact", head: true })
    .or("plan.in.(base,advanced,lifetime),subscription_status.in.(active,trialing)")
  if (error) throw error
  return count ?? 0
}

/**
 * Paid revenue grouped by day (UTC) from the `invoices` table, for the revenue
 * trend chart. Only settled (`paid`) invoices are counted.
 */
export async function getRevenueTrend(days = 30): Promise<RevenueTrendPoint[]> {
  const database = getDatabase()
  const since = new Date(Date.now() - days * 86_400_000).toISOString()
  const { data, error } = await database
    .from("invoices")
    .select("amount, paid_at")
    .eq("status", "paid")
    .gte("paid_at", since)
  if (error) throw error

  const byDay = new Map<string, number>()
  for (const row of data ?? []) {
    if (!row.paid_at) continue
    const date = (row.paid_at as string).slice(0, 10)
    byDay.set(date, (byDay.get(date) ?? 0) + Number(row.amount ?? 0))
  }
  return Array.from(byDay.entries())
    .map(([date, amount]) => ({ date, amount: Math.round(amount * 100) / 100 }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Daily usage-event volume (all operations) grouped by day (UTC), zero-filled
 * across the window so the trend line is continuous. Powers /admin/usage.
 */
export async function getUsageTrend(windowDays = 30): Promise<UsageTrendData> {
  const database = getDatabase()
  const since = new Date(Date.now() - windowDays * 86_400_000).toISOString()

  // No .order(): the byDay aggregation is order-independent, and an ascending
  // order + limit would silently drop the newest events once the window
  // exceeds the row cap.
  const { data, error } = await database
    .from("usage_events")
    .select("outcome, created_at")
    .gte("created_at", since)
    .limit(50000)

  if (error) throw error

  const byDay = new Map<string, number>()
  let quotaRejected = 0
  for (const row of data ?? []) {
    const date = (row.created_at as string).slice(0, 10)
    byDay.set(date, (byDay.get(date) ?? 0) + 1)
    if (row.outcome === "quota_rejected") quotaRejected++
  }

  const series: UsageTrendPoint[] = []
  for (let i = windowDays - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000)
    const key = d.toISOString().slice(0, 10)
    series.push({ date: key, count: byDay.get(key) ?? 0 })
  }

  // Totals come from byDay (the full query window), not the zero-filled
  // series — the series covers whole UTC days only, so summing it would
  // undercount events from the partial first day and could push the
  // rejection rate above 100%.
  const totalEvents = Array.from(byDay.values()).reduce((sum, c) => sum + c, 0)
  const peakDay = series.reduce<UsageTrendPoint | null>(
    (best, p) => (p.count > (best?.count ?? 0) ? p : best),
    null
  )

  return { windowDays, series, totalEvents, quotaRejected, peakDay }
}

/**
 * Conversion funnel + "inability" (limit-hit) signals, assembled from the
 * first-party `usage_events` table plus `scans`/`users`. Powers /admin/conversion.
 *
 * Funnel unique-viewer counts use `actor_hash` (a per-user SHA-256) as the
 * distinct key — for web/extension traffic the actor is the Clerk id, so this
 * is a reliable per-user proxy without joining PII.
 */
export async function getConversionSignals(windowDays = 30): Promise<ConversionSignals> {
  const database = getDatabase()
  const since = new Date(Date.now() - windowDays * 86_400_000).toISOString()

  const [eventsResult, activatedResult, payersResult] = await Promise.all([
    database
      .from("usage_events")
      .select("operation, outcome, metadata, actor_hash, created_at")
      .gte("created_at", since)
      .in("operation", ["analyze", "batch_item", "paywall_view", "pricing_view", "checkout_start"])
      .order("created_at", { ascending: true })
      .limit(10000),
    database.from("scans").select("user_id").eq("is_deleted", false),
    database
      .from("users")
      .select("*", { count: "exact", head: true })
      .or("plan.in.(base,advanced,lifetime),subscription_status.in.(active,trialing)"),
  ])

  const events = eventsResult.data ?? []

  const kindCounts = new Map<string, number>()
  const quotaByDay = new Map<string, number>()
  const variantCounts = new Map<string, number>()
  const paywallViewers = new Set<string>()
  const checkoutStarters = new Set<string>()
  let quotaTotal = 0
  let pricingViews = 0
  let checkoutStarts = 0
  let paywallTotal = 0

  for (const row of events) {
    const metadata = (row.metadata ?? {}) as Record<string, unknown>
    const date = (row.created_at as string).slice(0, 10)

    if (row.outcome === "quota_rejected") {
      quotaTotal++
      const kind = typeof metadata.kind === "string" ? metadata.kind : "unknown"
      kindCounts.set(kind, (kindCounts.get(kind) ?? 0) + 1)
      quotaByDay.set(date, (quotaByDay.get(date) ?? 0) + 1)
    } else if (row.operation === "paywall_view") {
      paywallTotal++
      const variant = typeof metadata.variant === "string" ? metadata.variant : "unknown"
      variantCounts.set(variant, (variantCounts.get(variant) ?? 0) + 1)
      paywallViewers.add(row.actor_hash as string)
    } else if (row.operation === "pricing_view") {
      pricingViews++
    } else if (row.operation === "checkout_start") {
      checkoutStarts++
      checkoutStarters.add(row.actor_hash as string)
    }
  }

  const activatedUsers = new Set(
    (activatedResult.data ?? []).map((r) => r.user_id as string).filter(Boolean),
  ).size

  const byKind = Array.from(kindCounts.entries())
    .map(([kind, count]) => ({ kind, count }))
    .sort((a, b) => b.count - a.count)
  const byVariant = Array.from(variantCounts.entries())
    .map(([variant, count]) => ({ variant, count }))
    .sort((a, b) => b.count - a.count)
  const quotaByDaySorted = Array.from(quotaByDay.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return {
    windowDays,
    funnel: {
      activatedUsers,
      paywallViewers: paywallViewers.size,
      checkoutStarters: checkoutStarters.size,
      payers: payersResult.count ?? 0,
    },
    quotaRejections: { total: quotaTotal, byKind, byDay: quotaByDaySorted },
    paywallViews: { total: paywallTotal, byVariant },
    pricingViews,
    checkoutStarts,
  }
}
