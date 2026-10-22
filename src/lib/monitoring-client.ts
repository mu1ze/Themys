import type { MonitoringAlert, MonitoringSubscription } from "@/lib/monitoring"

const MONITOR_ROUTE = "/api/monitor"
const ALERTS_ROUTE = "/api/monitor/alerts"

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  const body = await response.json().catch(() => ({})) as Record<string, unknown>
  if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Monitoring request failed")
  return body as T
}

export function listMonitoringSubscriptions() {
  return requestJson<{ subscriptions: MonitoringSubscription[]; limit: number }>(MONITOR_ROUTE)
}

export function createMonitoringSubscription(input: {
  url: string
  domain?: string
  title?: string
  frequency?: "daily" | "weekly" | "monthly"
}) {
  return requestJson<{ ok: true; subscription: MonitoringSubscription; limit: number }>(MONITOR_ROUTE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
}

export function deleteMonitoringSubscription(subscriptionId: string) {
  return requestJson<{ ok: true }>(MONITOR_ROUTE, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscriptionId }),
  })
}

export function updateMonitoringNotifications(subscriptionId: string, enabled: boolean) {
  return requestJson<{ ok: true; subscription: MonitoringSubscription }>(MONITOR_ROUTE, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscriptionId, emailNotificationsEnabled: enabled }),
  })
}

export function listMonitoringAlerts(unreadOnly = false) {
  return requestJson<{ alerts: MonitoringAlert[]; unreadCount: number }>(
    `${ALERTS_ROUTE}${unreadOnly ? "?unread=true" : ""}`,
  )
}

export function markMonitoringAlertRead(alertId: string) {
  return requestJson<{ ok: true }>(ALERTS_ROUTE, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ alertId }),
  })
}
