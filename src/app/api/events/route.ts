import { currentUser } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

import { recordUsageEvent } from "@/lib/usage-accounting"
import { parseThemysClientHeader } from "@/lib/themys-client"

/**
 * First-party funnel-event intake. Persists product-funnel events into the
 * existing `usage_events` table so the admin Conversion dashboard can measure
 * paywall → pricing → checkout behaviour without a third-party analytics SDK.
 *
 * Reuses `usage_events` (operation = event name, outcome = phase, metadata =
 * props) to avoid a schema migration. Writes happen with the service-role
 * client inside `recordUsageEvent`, so the table's restrictive RLS is respected.
 */

const ALLOWED_EVENTS = new Set([
  "paywall_view",
  "pricing_view",
  "checkout_start",
  "cta_click",
  "playbook_used",
  "decision_set",
  "extension_cta_click",
])

const OUTCOME_BY_EVENT: Record<string, string> = {
  paywall_view: "view",
  pricing_view: "view",
  checkout_start: "start",
  cta_click: "click",
  playbook_used: "select",
  decision_set: "set",
  extension_cta_click: "click",
}

const MAX_PROPS = 8

export async function POST(request: Request) {
  const user = await currentUser()
  // Funnel events are only attributable for signed-in users. Drop anonymous
  // calls quietly — the client fires-and-forgets and never surfaces this.
  if (!user?.id) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Body must be an object" }, { status: 400 })
  }

  const { event, props } = body as { event?: unknown; props?: unknown }
  if (typeof event !== "string" || !ALLOWED_EVENTS.has(event)) {
    return NextResponse.json({ error: "Unknown event" }, { status: 400 })
  }

  const metadata: Record<string, string | number | boolean | null> = {}
  if (props && typeof props === "object" && !Array.isArray(props)) {
    let count = 0
    for (const [key, value] of Object.entries(props as Record<string, unknown>)) {
      if (count >= MAX_PROPS) break
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) {
        metadata[key] = typeof value === "string" ? value.slice(0, 200) : value
        count++
      }
    }
  }

  const client = parseThemysClientHeader(request.headers.get("x-themys-client"))

  await recordUsageEvent({
    actor: user.id,
    client,
    operation: event,
    outcome: OUTCOME_BY_EVENT[event] ?? "event",
    metadata,
  }).catch(() => undefined)

  return NextResponse.json({ ok: true })
}
