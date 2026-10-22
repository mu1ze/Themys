import "server-only"

import { documentTypeLabel } from "@/lib/document-types"
import { getPlanEntitlements } from "@/lib/entitlements"
import { getRuntimeEnvironment, type WorkerServiceBinding } from "@/lib/runtime-env"
import { getDatabase } from "@/lib/database"
import { type MonitoringAlert } from "@/lib/monitoring"
import { isMonitoringEmailEligible } from "@/lib/monitoring-email-policy"

const MAX_ATTEMPTS = 6
const REQUEST_TIMEOUT_MS = 10_000

type DeliveryAlert = Pick<MonitoringAlert, "id" | "summary" | "created_at" | "email_idempotency_key" | "email_attempts"> & {
  is_email_sent: boolean
  subscription_id: string
  user_id: string
}

type DeliverySubscription = {
  id: string
  url: string
  domain: string
  title: string | null
  document_type: Parameters<typeof documentTypeLabel>[0]
  is_active: boolean
  email_notifications_enabled: boolean
}

type DeliveryUser = {
  email: string
  plan: string
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character)
}

function retryAt(attempts: number): string {
  const delays = [5 * 60_000, 30 * 60_000, 2 * 60 * 60_000, 12 * 60 * 60_000, 24 * 60 * 60_000]
  return new Date(Date.now() + (delays[Math.min(Math.max(attempts - 1, 0), delays.length - 1)] ?? delays.at(-1)!)).toISOString()
}

async function updateDelivery(alertId: string, values: Record<string, unknown>) {
  const { error } = await getDatabase()
    .from("monitoring_alerts")
    .update(values)
    .eq("id", alertId)
  if (error) throw new Error(`monitor email state update failed: ${error.message}`)
}

/**
 * Deliver one alert. The database claim is the concurrency/idempotency gate;
 * the Worker adds a second gate before calling Cloudflare Email Sending.
 */
export async function dispatchMonitoringAlertEmail(alertId: string): Promise<"sent" | "skipped" | "failed" | "busy"> {
  const database = getDatabase()
  const { data: claimed, error: claimError } = await database.rpc("claim_monitoring_alert_email", {
    p_alert_id: alertId,
    p_now: new Date().toISOString(),
  })
  if (claimError) throw new Error(`monitor email claim failed: ${claimError.message}`)

  const alert = (Array.isArray(claimed) ? claimed[0] : claimed) as DeliveryAlert | null
  if (!alert) return "busy"

  const [{ data: subscription, error: subscriptionError }, { data: user, error: userError }] = await Promise.all([
    database
      .from("monitoring_subscriptions")
      .select("id, url, domain, title, document_type, is_active, email_notifications_enabled")
      .eq("id", alert.subscription_id)
      .maybeSingle(),
    database
      .from("users")
      .select("email, plan")
      .eq("id", alert.user_id)
      .maybeSingle(),
  ])

  if (subscriptionError || userError) {
    await updateDelivery(alert.id, {
      email_status: "failed",
      email_last_error: (subscriptionError || userError)?.message.slice(0, 240) ?? "Delivery context lookup failed",
      email_next_attempt_at: retryAt(alert.email_attempts),
    })
    return "failed"
  }

  const typedSubscription = subscription as DeliverySubscription | null
  const typedUser = user as DeliveryUser | null
  if (!typedSubscription || !typedUser || !isMonitoringEmailEligible({
    isActive: typedSubscription.is_active,
    emailNotificationsEnabled: typedSubscription.email_notifications_enabled,
    emailAlertsAllowed: getPlanEntitlements(typedUser.plan).emailAlerts,
    email: typedUser.email,
  })) {
    await updateDelivery(alert.id, { email_status: "disabled", email_last_error: null })
    return "skipped"
  }

  const env = getRuntimeEnvironment()
  const worker = env.MONITORING_EMAIL_WORKER as unknown as WorkerServiceBinding | undefined
  const from = env.MONITORING_EMAIL_FROM?.trim() || "alerts@themys.ca"
  if (!worker) {
    const message = "Monitoring email service binding is not configured"
    await updateDelivery(alert.id, {
      email_status: "failed",
      email_last_error: message,
      email_next_attempt_at: retryAt(alert.email_attempts),
    })
    return "failed"
  }

  const appUrl = env.APP_URL?.trim() || "https://themys.ca"
  const documentLabel = documentTypeLabel(typedSubscription.document_type)
  const alertUrl = new URL(`/monitoring?alert=${encodeURIComponent(alert.id)}`, appUrl).href
  const subject = `${typedSubscription.domain} ${documentLabel} changed`
  const text = [
    `${typedSubscription.title || typedSubscription.domain} — ${documentLabel} changed`,
    "",
    alert.summary || "A monitored legal document changed.",
    `Detected: ${new Date(alert.created_at).toISOString()}`,
    `Review the alert: ${alertUrl}`,
    "",
    "You can disable email alerts from your Themys Monitoring page.",
  ].join("\n")
  const html = `<h2>${escapeHtml(typedSubscription.title || typedSubscription.domain)} — ${escapeHtml(documentLabel)} changed</h2><p>${escapeHtml(alert.summary || "A monitored legal document changed.")}</p><p>Detected: ${escapeHtml(new Date(alert.created_at).toISOString())}</p><p><a href="${escapeHtml(alertUrl)}">Review the alert in Themys</a></p><p>You can disable email alerts from your Themys Monitoring page.</p>`
  const body = JSON.stringify({
    alertId: alert.id,
    idempotencyKey: alert.email_idempotency_key,
    to: typedUser.email,
    from,
    subject,
    text,
    html,
  })

  try {
    const response = await worker.fetch(new Request("https://monitoring-email.internal/deliver", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }))
    if (!response.ok) throw new Error(`email worker returned ${response.status}`)
    await updateDelivery(alert.id, {
      email_status: "sent",
      is_email_sent: true,
      email_sent_at: new Date().toISOString(),
      email_last_error: null,
    })
    return "sent"
  } catch (error) {
    const attempts = Number(alert.email_attempts || 1)
    const exhausted = attempts >= MAX_ATTEMPTS
    await updateDelivery(alert.id, {
      email_status: "failed",
      email_last_error: error instanceof Error ? error.message.slice(0, 240) : "Email worker request failed",
      email_next_attempt_at: exhausted ? new Date("9999-12-31T00:00:00.000Z").toISOString() : retryAt(attempts),
    })
    return "failed"
  }
}

export async function dispatchPendingMonitoringAlertEmails(limit = 50): Promise<number> {
  const { data, error } = await getDatabase()
    .from("monitoring_alerts")
    .select("id")
    .eq("is_email_sent", false)
    .in("email_status", ["pending", "failed"])
    .lte("email_next_attempt_at", new Date().toISOString())
    .order("email_next_attempt_at", { ascending: true })
    .limit(limit)
  if (error) throw new Error(`monitor email queue lookup failed: ${error.message}`)

  let sent = 0
  for (const row of data ?? []) {
    if ((await dispatchMonitoringAlertEmail(String(row.id))) === "sent") sent++
  }
  return sent
}
