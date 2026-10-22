/**
 * Anonymous top-of-funnel event intake. Accepts pageview/landing_view events
 * from unauthenticated visitors and persists them into the existing usage_events
 * table with a keyed fingerprint (verified IP + user-agent) as actor_hash.
 *
 * This is the first-party replacement for PostHog — same data, zero third-party.
 * Raw IPs are never persisted.
 */

import { NextResponse } from "next/server"
import { recordUsageEvent } from "@/lib/usage-accounting"
import { parseThemysClientHeader } from "@/lib/themys-client"
import {
  ANONYMOUS_EVENT_MAX_BODY_BYTES,
  ANONYMOUS_EVENT_WINDOW_SECONDS,
  buildAnonymousActor,
  getAnonymousClientIdentifier,
} from "@/lib/anonymous-events"
import { takeAnonymousEventSlot } from "@/lib/anonymous-events-rate-limit"
import { readRequestText, RequestBodyTooLargeError } from "@/lib/request-body"
import { getRuntimeEnvironment } from "@/lib/runtime-env"

const ALLOWED_EVENTS = new Set([
  "pageview",
  "landing_view",
])

const OUTCOME_BY_EVENT: Record<string, string> = {
  pageview: "view",
  landing_view: "view",
}

const MAX_PROPS = 6

export async function POST(request: Request) {
  const identifier = getAnonymousClientIdentifier(request)
  if (!await takeAnonymousEventSlot(identifier)) {
    return NextResponse.json(
      { error: "Too many events" },
      { status: 429, headers: { "Retry-After": String(ANONYMOUS_EVENT_WINDOW_SECONDS) } },
    )
  }

  let rawBody: string
  try {
    rawBody = await readRequestText(request, ANONYMOUS_EVENT_MAX_BODY_BYTES)
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: "Request body is too large" }, { status: 413 })
    }
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Body must be an object" }, { status: 400 })
  }

  const { event, props, route } = body as { event?: unknown; props?: unknown; route?: unknown }
  if (typeof event !== "string" || !ALLOWED_EVENTS.has(event)) {
    return NextResponse.json({ error: "Unknown event" }, { status: 400 })
  }

  const metadata: Record<string, string | number | boolean | null> = {}
  if (typeof route === "string" && route.length <= 200) {
    metadata.route = route
  }
  if (props && typeof props === "object" && !Array.isArray(props)) {
    let count = Object.keys(metadata).length
    for (const [key, value] of Object.entries(props as Record<string, unknown>)) {
      if (count >= MAX_PROPS) break
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) {
        metadata[key] = typeof value === "string" ? value.slice(0, 200) : value
        count++
      }
    }
  }

  const client = parseThemysClientHeader(request.headers.get("x-themys-client"))
  const fingerprintSecret = getRuntimeEnvironment().USAGE_FINGERPRINT_SECRET
  if (!fingerprintSecret || new TextEncoder().encode(fingerprintSecret.trim()).byteLength < 32) {
    console.error("[anonymous events] USAGE_FINGERPRINT_SECRET is not securely configured")
    return NextResponse.json({ error: "Event intake is unavailable" }, { status: 503 })
  }
  const actor = await buildAnonymousActor(request, fingerprintSecret)

  await recordUsageEvent({
    actor,
    client,
    operation: event,
    outcome: OUTCOME_BY_EVENT[event] ?? "event",
    metadata,
  }).catch(() => undefined)

  return NextResponse.json({ ok: true })
}
