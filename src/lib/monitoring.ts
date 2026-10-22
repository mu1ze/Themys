import "server-only"

import { randomUUID } from "node:crypto"

import { getDatabase } from "@/lib/database"
import type { DocumentIdentity } from "@/lib/document-identity"
import type { DocumentType } from "@/lib/document-types"
import { getPlanEntitlements } from "@/lib/entitlements"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MonitoringSubscription = {
  id: string
  user_id: string
  url: string
  domain: string
  title: string | null
  frequency: "daily" | "weekly" | "monthly"
  is_active: boolean
  email_notifications_enabled: boolean
  last_checked_at: string | null
  last_changed_at: string | null
  created_at: string
  updated_at: string
  document_type: DocumentType
  document_type_confidence: number | null
  document_type_source: string | null
  document_type_evidence: string[]
  document_identity_key: string | null
  verification_status: "active" | "needs_review" | "mismatch"
  verification_message: string | null
}

export const MONITOR_LIMITS = {
  free: getPlanEntitlements("free").monitorLimit,
  base: getPlanEntitlements("base").monitorLimit,
  advanced: getPlanEntitlements("advanced").monitorLimit,
  lifetime: getPlanEntitlements("lifetime").monitorLimit,
} as const

export type TosSnapshot = {
  id: string
  url: string
  domain: string
  text_hash: string
  word_count: number | null
  risk_score: number | null
  flagged_count: number | null
  clause_count: number | null
  categories_json: Record<string, unknown> | null
  scan_id: string | null
  subscription_id: string | null
  document_type: DocumentType
  document_identity_key: string | null
  created_at: string
}

export type MonitoringAlert = {
  id: string
  subscription_id: string
  user_id: string
  old_snapshot_id: string | null
  new_snapshot_id: string
  change_type: "text_change" | "risk_increase" | "new_flags" | "all"
  risk_delta: number | null
  summary: string | null
  is_read: boolean
  is_email_sent: boolean
  email_status: "pending" | "sending" | "sent" | "failed" | "disabled"
  email_attempts: number
  email_last_attempt_at: string | null
  email_next_attempt_at: string
  email_last_error: string | null
  email_idempotency_key: string
  email_sent_at: string | null
  created_at: string
  /** Canonical persisted scan containing the full analysis/extraction result. */
  scan_id?: string | null
}

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

/**
 * Create a monitoring subscription for a URL.
 */
export async function subscribe(
  userId: string,
  url: string,
  domain: string,
  title: string | null,
  document: DocumentIdentity,
  frequency: "daily" | "weekly" | "monthly" = "weekly",
  limit = 1,
): Promise<MonitoringSubscription> {
  const database = getDatabase()

  const { data, error } = await database.rpc("subscribe_monitoring_with_identity_limit", {
    p_user_id: userId,
    p_url: url,
    p_domain: domain,
    p_title: title,
    p_frequency: frequency,
    p_limit: limit,
    p_document_type: document.type,
    p_document_type_confidence: document.confidence,
    p_document_type_source: document.classifierVersion,
    p_document_type_evidence: document.evidence,
    p_document_identity_key: document.identityKey,
  })

  if (error) throw new Error(`subscribe: ${error.message}`)
  return (Array.isArray(data) ? data[0] : data) as MonitoringSubscription
}

/**
 * Unsubscribe from monitoring a URL. Hard-delete the subscription row.
 */
export async function unsubscribe(
  subscriptionId: string,
  userId: string,
): Promise<void> {
  const database = getDatabase()

  const { data, error } = await database
    .from("monitoring_subscriptions")
    .delete()
    .eq("id", subscriptionId)
    .eq("user_id", userId)
    .select("id")

  if (error) throw new Error(`unsubscribe: ${error.message}`)
  if (!data?.length) throw new Error("subscription_not_found")
}

/**
 * List a user's active monitoring subscriptions.
 */
export async function getSubscriptions(
  userId: string,
  emailAlertsAllowed = true,
): Promise<MonitoringSubscription[]> {
  const database = getDatabase()

  const { data, error } = await database
    .from("monitoring_subscriptions")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })

  if (error) throw new Error(`getSubscriptions: ${error.message}`)
  return (data ?? []).map((subscription) => ({
    ...(subscription as MonitoringSubscription),
    email_notifications_enabled: Boolean(subscription.email_notifications_enabled && emailAlertsAllowed),
  }))
}

/**
 * Get all active subscriptions for a domain (used by the monitoring scheduler).
 */
export async function getSubscriptionsByDomain(
  domain: string,
): Promise<MonitoringSubscription[]> {
  const database = getDatabase()

  const { data, error } = await database
    .from("monitoring_subscriptions")
    .select("*")
    .eq("domain", domain)
    .eq("is_active", true)

  if (error) throw new Error(`getSubscriptionsByDomain: ${error.message}`)
  return (data ?? []) as MonitoringSubscription[]
}

// ---------------------------------------------------------------------------
// Snapshots
// ---------------------------------------------------------------------------

/**
 * Create a ToS text snapshot.
 */
export async function createSnapshot(
  url: string,
  domain: string,
  textHash: string,
  wordCount: number | null,
  riskScore: number | null,
  flaggedCount: number | null,
  clauseCount: number | null,
  categoriesJson: Record<string, unknown> | null,
  scanId: string | null,
  subscriptionId: string,
  documentType: DocumentType,
  documentIdentityKey: string,
): Promise<TosSnapshot> {
  const database = getDatabase()

  const { data, error } = await database
    .from("tos_snapshots")
    .insert({
      url,
      domain,
      text_hash: textHash,
      word_count: wordCount,
      risk_score: riskScore,
      // D1 stores snapshot counters as non-null; an unanalysed baseline keeps
      // risk_score null but represents absent counts as zero.
      flagged_count: flaggedCount ?? 0,
      clause_count: clauseCount ?? 0,
      categories_json: categoriesJson,
      scan_id: scanId,
      subscription_id: subscriptionId,
      document_type: documentType,
      document_identity_key: documentIdentityKey,
    })
    .select()
    .single()

  if (error) throw new Error(`createSnapshot: ${error.message}`)
  return data as unknown as TosSnapshot
}

/**
 * Get the most recent snapshot for a URL.
 */
export async function getLatestSnapshot(
  url: string,
  subscriptionId?: string,
): Promise<TosSnapshot | null> {
  const database = getDatabase()

  let query = database
    .from("tos_snapshots")
    .select("*")
    .eq("url", url)

  if (subscriptionId) {
    query = query.eq("subscription_id", subscriptionId)
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`getLatestSnapshot: ${error.message}`)
  return data as TosSnapshot | null
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

/**
 * Create a monitoring alert.
 */
export async function createAlert(
  subscriptionId: string,
  userId: string,
  oldSnapshotId: string | null,
  newSnapshotId: string,
  changeType: "text_change" | "risk_increase" | "new_flags" | "all" = "text_change",
  riskDelta: number | null = null,
  summary: string | null = null,
): Promise<MonitoringAlert> {
  const database = getDatabase()

  const { data, error } = await database
    .from("monitoring_alerts")
    .insert({
      subscription_id: subscriptionId,
      user_id: userId,
      old_snapshot_id: oldSnapshotId,
      new_snapshot_id: newSnapshotId,
      change_type: changeType,
      risk_delta: riskDelta,
      summary,
      // Email delivery claims this key atomically. Keep it explicit so alert
      // creation remains valid on databases where the NOT NULL column has no
      // server-side default (including the current production schema).
      email_idempotency_key: randomUUID(),
    })
    .select()
    .single()

  if (error) throw new Error(`createAlert: ${error.message}`)
  return data as unknown as MonitoringAlert
}

/**
 * Get a user's monitoring alerts, optionally filtered to unread only.
 */
export async function getAlerts(
  userId: string,
  unreadOnly: boolean = false,
): Promise<MonitoringAlert[]> {
  const database = getDatabase()

  let query = database
    .from("monitoring_alerts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (unreadOnly) {
    query = query.eq("is_read", false)
  }

  const { data, error } = await query

  if (error) throw new Error(`getAlerts: ${error.message}`)
  const alerts = (data ?? []) as MonitoringAlert[]
  const snapshotIds = alerts
    .map((alert) => alert.new_snapshot_id)
    .filter((id): id is string => typeof id === "string" && id.length > 0)

  if (snapshotIds.length === 0) return alerts

  const snapshotRows: Array<{ id: string; scan_id: string | null }> = []
  for (let index = 0; index < snapshotIds.length; index += 100) {
    const { data: snapshots, error: snapshotError } = await database
      .from("tos_snapshots")
      .select("id, scan_id")
      .in("id", snapshotIds.slice(index, index + 100))

    if (snapshotError) throw new Error(`getAlerts snapshots: ${snapshotError.message}`)
    snapshotRows.push(...((snapshots ?? []) as Array<{ id: string; scan_id: string | null }>))
  }

  const scanBySnapshot = new Map(
    snapshotRows.map((snapshot) => [String(snapshot.id), snapshot.scan_id ?? null]),
  )
  return alerts.map((alert) => ({
    ...alert,
    scan_id: scanBySnapshot.get(alert.new_snapshot_id) ?? null,
  }))
}

/**
 * Mark a single alert as read.
 */
export async function markAlertRead(
  alertId: string,
  userId: string,
): Promise<void> {
  const database = getDatabase()

  const { data, error } = await database
    .from("monitoring_alerts")
    .update({ is_read: true })
    .eq("id", alertId)
    .eq("user_id", userId)
    .select("id")

  if (error) throw new Error(`markAlertRead: ${error.message}`)
  if (!data?.length) throw new Error("alert_not_found")
}

/**
 * Count unread alerts for a user.
 */
export async function getUnreadAlertCount(userId: string): Promise<number> {
  const database = getDatabase()

  const { count, error } = await database
    .from("monitoring_alerts")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false)

  if (error) throw new Error(`getUnreadAlertCount: ${error.message}`)
  return count ?? 0
}
