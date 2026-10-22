import "server-only"

import { getAttentionLevel } from "@/lib/attention-level"
import { getAlerts, getSubscriptions } from "@/lib/monitoring"
import { getDatabase } from "@/lib/database"
import { getCreditBalanceByUserId } from "@/lib/persistence"
import { buildPushbackList, type PushbackItem } from "@/lib/pushback"
import { buildCompanyLogoUrl, formatCompanyName } from "@/lib/scan-display"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ScansOverTimeEntry = {
  date: string
  scans: number
  avgRisk: number
}

export type RiskBreakdownEntry = {
  category: string
  score: number
}

export type TopRiskyServiceEntry = {
  domain: string
  name: string
  riskScore: number
  logoUrl: string
  scanCount: number
}

export type KpiData = {
  totalScans: number
  highRiskFlags: number
  avgScore: number
  scanTrend: number[]
  highRiskTrend: number[]
  scoreTrend: number[]
}

export type DashboardMetrics = {
  kpi: KpiData
  scansOverTime: ScansOverTimeEntry[]
  riskBreakdown: RiskBreakdownEntry[]
  topServices: TopRiskyServiceEntry[]
}

export type VendorDashboardData = {
  displayName: string
  chromeStoreUrl: string | null
  openDecisions: Array<{
    id: string
    title: string | null
    domain: string | null
    createdAt: string
    attentionLabel: string
  }>
  watchlist: Array<{
    id: string
    domain: string
    url: string
    title: string | null
    lastCheckedAt: string | null
    hasUnreadAlert: boolean
    emailEnabled: boolean
  }>
  recentPushback: Array<{
    scanId: string
    title: string | null
    domain: string | null
    items: PushbackItem[]
  }>
  creditBalance: number
  scanCount: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Map internal category slugs to human-readable display names. */
function categoryToDisplayName(category: string): string {
  const c = category.toLowerCase()

  if (/(data|privacy|tracking|cookie|information)/.test(c)) return "Data Privacy"
  if (/(arbitration|dispute|jurisdiction|law|class action|class waiver)/.test(c)) return "Arbitration"
  if (/(liability|warrant|indemnif|responsibilit|breach)/.test(c)) return "Liability"
  if (/(content|\bip\b|license|copyright|trademark|intellectual property|software use)/.test(c)) return "Content/IP"
  if (/(billing|payment|renewal|subscription|fee|refund)/.test(c)) return "Billing"
  if (/(account|terminat|suspen|ban|age|modif|notice|terms)/.test(c)) return "Account"

  // Fallback map for legacy exact slugs if any
  const map: Record<string, string> = {
    data_sharing: "Data Privacy",
    auto_renewal: "Billing",
    content_license: "Content/IP",
    no_opt_out: "Account",
    location_tracking: "Data Privacy",
  }
  return map[category.toLowerCase().trim()] ?? "Other"
}

/** Merge a raw count-map into an array, aggregating by display category. */
function mergeIntoCategoryMap(
  target: Map<string, { totalScore: number; count: number }>,
  category: string,
  score: number,
) {
  const display = categoryToDisplayName(category)
  const existing = target.get(display)
  if (existing) {
    existing.totalScore += score
    existing.count += 1
  } else {
    target.set(display, { totalScore: score, count: 1 })
  }
}

function chromeStoreUrlFromEnv(): string | null {
  const value = process.env.NEXT_PUBLIC_CHROME_STORE_URL?.trim()
  return value ? value : null
}

function emptyVendorDashboard(creditBalance = 0): Omit<VendorDashboardData, "displayName"> {
  return {
    chromeStoreUrl: chromeStoreUrlFromEnv(),
    openDecisions: [],
    watchlist: [],
    recentPushback: [],
    creditBalance,
    scanCount: 0,
  }
}

/** Vendor workspace: open decisions, watchlist, recent pushback. No vanity charts. */
export async function getVendorDashboardForUser(
  clerkId: string
): Promise<Omit<VendorDashboardData, "displayName">> {
  const userId = await getUserIdByClerkId(clerkId)
  if (!userId) return emptyVendorDashboard()

  const database = getDatabase()
  const [scansResult, subscriptions, unreadAlerts, creditBalance] = await Promise.all([
    database
      .from("scans")
      .select("id, title, domain, created_at, risk_score, decision")
      .eq("user_id", userId)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(50),
    getSubscriptions(userId),
    getAlerts(userId, true),
    getCreditBalanceByUserId(userId),
  ])

  if (scansResult.error) throw scansResult.error

  const scans = scansResult.data ?? []
  const unreadBySubscription = new Set(
    unreadAlerts.map((alert) => alert.subscription_id).filter(Boolean)
  )

  const openDecisions = scans
    .filter((row) => {
      const decision = row.decision
      return decision === "open" || decision == null || decision === ""
    })
    .slice(0, 12)
    .map((row) => ({
      id: row.id as string,
      title: (row.title as string | null) ?? null,
      domain: (row.domain as string | null) ?? null,
      createdAt: row.created_at as string,
      attentionLabel: getAttentionLevel(
        row.risk_score == null ? null : Number(row.risk_score)
      ).label,
    }))

  const watchlist = subscriptions.map((subscription) => ({
    id: subscription.id,
    domain: subscription.domain,
    url: subscription.url,
    title: subscription.title,
    lastCheckedAt: subscription.last_checked_at,
    hasUnreadAlert: unreadBySubscription.has(subscription.id),
    emailEnabled: subscription.email_notifications_enabled,
  }))

  const recentScans = scans.slice(0, 8)
  const recentIds = recentScans.map((row) => row.id as string)
  let recentPushback: VendorDashboardData["recentPushback"] = []

  if (recentIds.length > 0) {
    const { data: clauseRows, error: clauseError } = await database
      .from("clauses")
      .select("id, scan_id, text, why_it_matters, recommended_action, is_target_clause, risk_score")
      .in("scan_id", recentIds)

    if (clauseError) throw clauseError

    type DashboardClauseRow = {
      id: unknown
      scan_id: unknown
      text: unknown
      why_it_matters: unknown
      recommended_action: unknown
      is_target_clause: unknown
      risk_score: unknown
    }
    const clausesByScan = new Map<
      string,
      DashboardClauseRow[]
    >()
    for (const row of clauseRows ?? []) {
      const scanId = row.scan_id as string
      const bucket = clausesByScan.get(scanId) ?? []
      bucket.push(row as DashboardClauseRow)
      clausesByScan.set(scanId, bucket)
    }

    recentPushback = recentScans
      .map((row) => {
        const scanId = row.id as string
        const items = buildPushbackList(
          (clausesByScan.get(scanId) ?? []).map((clause) => ({
            id: clause.id as string,
            text: (clause.text as string) ?? "",
            whyItMatters: (clause.why_it_matters as string | null) ?? null,
            recommendedAction: (clause.recommended_action as string | null) ?? null,
            isTargetClause: Boolean(clause.is_target_clause),
            riskScore: clause.risk_score == null ? null : Number(clause.risk_score),
          })),
          3
        )
        return {
          scanId,
          title: (row.title as string | null) ?? null,
          domain: (row.domain as string | null) ?? null,
          items,
        }
      })
      .filter((entry) => entry.items.length > 0)
      .slice(0, 3)
  }

  return {
    chromeStoreUrl: chromeStoreUrlFromEnv(),
    openDecisions,
    watchlist,
    recentPushback,
    creditBalance,
    scanCount: scans.length,
  }
}

// ---------------------------------------------------------------------------
// 1. Scans over time (last N days, with gaps filled)
// ---------------------------------------------------------------------------

export async function getScansOverTime(
  clerkId: string,
  days: number = 30,
): Promise<ScansOverTimeEntry[]> {
  const userId = await getUserIdByClerkId(clerkId)
  if (!userId) return []

  const database = getDatabase()
  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceISO = since.toISOString()

  // Fetch all scans for this user in the window.
  // D1 query client doesn't support GROUP BY, so we aggregate client-side.
  const { data, error } = await database
    .from("scans")
    .select("created_at, risk_score")
    .eq("user_id", userId)
    .eq("is_deleted", false)
    .gte("created_at", sinceISO)
    .order("created_at", { ascending: true })

  if (error) throw error

  // Build a lookup: date → { scans, totalRisk }
  const bucket = new Map<string, { scans: number; totalRisk: number }>()
  for (const row of data ?? []) {
    const date = formatDate(new Date(row.created_at as string))
    const score = row.risk_score != null ? Number(row.risk_score) : 0
    const existing = bucket.get(date)
    if (existing) {
      existing.scans += 1
      existing.totalRisk += score
    } else {
      bucket.set(date, { scans: 1, totalRisk: score })
    }
  }

  // Fill gaps for the entire window
  const result: ScansOverTimeEntry[] = []
  const cursor = new Date(since)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  cursor.setHours(0, 0, 0, 0)

  while (cursor <= today) {
    const key = formatDate(cursor)
    const entry = bucket.get(key)
    result.push({
      date: key,
      scans: entry?.scans ?? 0,
      avgRisk: entry ? Math.round((entry.totalRisk / entry.scans) * 10) / 10 : 0,
    })
    cursor.setDate(cursor.getDate() + 1)
  }

  return result
}

// ---------------------------------------------------------------------------
// 2. Risk breakdown by category
// ---------------------------------------------------------------------------

export async function getRiskBreakdown(
  clerkId: string,
): Promise<RiskBreakdownEntry[]> {
  const userId = await getUserIdByClerkId(clerkId)
  if (!userId) return []

  const database = getDatabase()

  // Get scan IDs for this user
  const { data: scans, error: scanErr } = await database
    .from("scans")
    .select("id")
    .eq("user_id", userId)
    .eq("is_deleted", false)

  if (scanErr) throw scanErr
  const scanIds = (scans ?? []).map((s) => s.id as string)
  if (scanIds.length === 0) return []

  // Fetch clauses for those scans
  // D1 `in` filter handles up to 1000 items; chunk if needed.
  const categoryMap = new Map<string, { totalScore: number; count: number }>()
  const CHUNK = 1000
  for (let i = 0; i < scanIds.length; i += CHUNK) {
    const chunk = scanIds.slice(i, i + CHUNK)
    const { data: clauses, error: clauseErr } = await database
      .from("clauses")
      .select("category, risk_score")
      .in("scan_id", chunk)

    if (clauseErr) throw clauseErr

    for (const row of clauses ?? []) {
      const cat = (row.category as string | null) ?? null
      const score = row.risk_score != null ? Number(row.risk_score) : 0
      if (cat) {
        mergeIntoCategoryMap(categoryMap, cat, score)
      }
    }
  }

  // Ensure all 6 display categories are present
  const displayCategories = [
    "Data Privacy",
    "Arbitration",
    "Liability",
    "Content/IP",
    "Billing",
    "Account",
  ]

  const result: RiskBreakdownEntry[] = displayCategories.map((cat) => {
    const entry = categoryMap.get(cat)
    return {
      category: cat,
      score: entry ? Math.round((entry.totalScore / entry.count) * 10) / 10 : 0,
    }
  })

  return result
}

// ---------------------------------------------------------------------------
// 3. Top risky services
// ---------------------------------------------------------------------------

export async function getTopRiskyServices(
  clerkId: string,
  limit: number = 5,
): Promise<TopRiskyServiceEntry[]> {
  const userId = await getUserIdByClerkId(clerkId)
  if (!userId) return []

  const database = getDatabase()
  const { data, error } = await database
    .from("scans")
    .select("domain, title, url, risk_score")
    .eq("user_id", userId)
    .eq("is_deleted", false)
    .order("risk_score", { ascending: false })

  if (error) throw error

  // Aggregate by domain (pick highest risk, count scans)
  const domainMap = new Map<
    string,
    { domain: string; title: string | null; url: string | null; maxRisk: number; count: number }
  >()

  for (const row of data ?? []) {
    const domain = (row.domain as string | null) ?? null
    if (!domain) continue
    const score = row.risk_score != null ? Number(row.risk_score) : 0
    const existing = domainMap.get(domain)
    if (existing) {
      existing.count += 1
      if (score > existing.maxRisk) {
        existing.maxRisk = score
      }
    } else {
      domainMap.set(domain, {
        domain,
        title: (row.title as string | null) ?? null,
        url: (row.url as string | null) ?? null,
        maxRisk: score,
        count: 1,
      })
    }
  }

  // Sort by max risk desc and take top N
  const sorted = Array.from(domainMap.values())
    .sort((a, b) => b.maxRisk - a.maxRisk)
    .slice(0, limit)

  return sorted.map((entry) => {
    const scanIdentity = {
      domain: entry.domain,
      title: entry.title,
      url: entry.url,
    }
    return {
      domain: entry.domain,
      name: formatCompanyName(scanIdentity),
      riskScore: Math.round(entry.maxRisk * 10) / 10,
      logoUrl: buildCompanyLogoUrl(scanIdentity) ?? "",
      scanCount: entry.count,
    }
  })
}

// ---------------------------------------------------------------------------
// 4. KPI data
// ---------------------------------------------------------------------------

export async function getKpiData(clerkId: string): Promise<KpiData> {
  const userId = await getUserIdByClerkId(clerkId)
  if (!userId) {
    return {
      totalScans: 0,
      highRiskFlags: 0,
      avgScore: 0,
      scanTrend: Array(7).fill(0),
      highRiskTrend: Array(7).fill(0),
      scoreTrend: Array(7).fill(0),
    }
  }

  const database = getDatabase()

  // We need data from the last 14 days (7 current + 7 previous for delta)
  const since14 = new Date()
  since14.setDate(since14.getDate() - 14)

  const { data: scans, error } = await database
    .from("scans")
    .select("created_at, risk_score")
    .eq("user_id", userId)
    .eq("is_deleted", false)
    .gte("created_at", since14.toISOString())
    .order("created_at", { ascending: true })

  if (error) throw error

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Buckets for last 14 days: index 0 = 13 days ago, index 13 = today
  const dailyScans: number[] = Array(14).fill(0)
  const dailyHighRisk: number[] = Array(14).fill(0)
  const dailyTotalRisk: number[] = Array(14).fill(0)

  for (const row of scans ?? []) {
    const created = new Date(row.created_at as string)
    created.setHours(0, 0, 0, 0)
    const diffDays = Math.floor(
      (today.getTime() - created.getTime()) / (24 * 60 * 60 * 1000),
    )
    const idx = 13 - diffDays
    if (idx < 0 || idx > 13) continue

    const score = row.risk_score != null ? Number(row.risk_score) : 0
    dailyScans[idx] += 1
    dailyTotalRisk[idx] += score
    if (score >= 7) {
      dailyHighRisk[idx] += 1
    }
  }

  // Current 7 days (indices 7-13) and previous 7 days (indices 0-6)
  const scanTrend = dailyScans.slice(7, 14)
  const highRiskTrend = dailyHighRisk.slice(7, 14)
  const scoreTrend = dailyTotalRisk.slice(7, 14).map((total, i) => {
    const count = scanTrend[i]
    return count > 0 ? Math.round((total / count) * 10) / 10 : 0
  })

  // Totals over ALL time
  const { count: totalScans, error: countErr } = await database
    .from("scans")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_deleted", false)

  if (countErr) throw countErr

  // High-risk flags & avg score from all scans
  const { data: allScans, error: allErr } = await database
    .from("scans")
    .select("risk_score")
    .eq("user_id", userId)
    .eq("is_deleted", false)

  if (allErr) throw allErr

  let highRiskFlags = 0
  let totalRisk = 0
  let scoredCount = 0
  for (const row of allScans ?? []) {
    const score = row.risk_score != null ? Number(row.risk_score) : null
    if (score !== null) {
      totalRisk += score
      scoredCount += 1
      if (score >= 7) highRiskFlags += 1
    }
  }

  return {
    totalScans: totalScans ?? 0,
    highRiskFlags,
    avgScore: scoredCount > 0 ? Math.round((totalRisk / scoredCount) * 10) / 10 : 0,
    scanTrend,
    highRiskTrend,
    scoreTrend,
  }
}
