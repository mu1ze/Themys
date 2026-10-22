import { NextResponse } from "next/server"

import { getAlerts, getUnreadAlertCount, markAlertRead } from "@/features/monitoring/server/subscriptions"
import { getUserProfileByClerkId } from "@/lib/persistence"
import { resolveRequestAuth } from "@/lib/request-auth"
import { readRequestText, RequestBodyTooLargeError } from "@/lib/request-body"

async function getProfile(request: Request) {
  const auth = await resolveRequestAuth(request, { allowApiKey: false })
  if (!auth.ok) return auth
  const profile = await getUserProfileByClerkId(auth.identity.clerkId)
  if (!profile) return { ok: false as const, status: 404, error: "User not found" }
  return { ok: true as const, profile }
}

export async function GET(request: Request) {
  try {
    const identity = await getProfile(request)
    if (!identity.ok) return NextResponse.json({ error: identity.error }, { status: identity.status })
    const unreadOnly = new URL(request.url).searchParams.get("unread") === "true"
    const [alerts, unreadCount] = await Promise.all([
      getAlerts(identity.profile.id, unreadOnly),
      getUnreadAlertCount(identity.profile.id),
    ])
    return NextResponse.json({ alerts, unreadCount })
  } catch (error) {
    console.error("[monitor/alerts] List failed", error instanceof Error ? error.name : "UnknownError")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const identity = await getProfile(request)
    if (!identity.ok) return NextResponse.json({ error: identity.error }, { status: identity.status })
    const raw = await readRequestText(request, 8 * 1024)
    const body = JSON.parse(raw) as { alertId?: unknown }
    const alertId = typeof body.alertId === "string" ? body.alertId : ""
    if (!alertId) return NextResponse.json({ error: "alertId is required" }, { status: 400 })
    await markAlertRead(alertId, identity.profile.id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return NextResponse.json({ error: "Request body is too large" }, { status: 413 })
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 })
    if (error instanceof Error && error.message === "alert_not_found") {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 })
    }
    console.error("[monitor/alerts] Update failed", error instanceof Error ? error.name : "UnknownError")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
