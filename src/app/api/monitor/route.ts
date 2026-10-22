import { NextResponse } from "next/server"

import {
  createSnapshot,
  getLatestSnapshot,
  getSubscriptions,
  MONITOR_LIMITS,
  subscribe,
  unsubscribe,
} from "@/features/monitoring/server/subscriptions"
import {
  parseExtensionMonitorSubscribeRequest,
  parseExtensionMonitorUnsubscribeRequest,
} from "@/contracts/extension"
import { extensionJson } from "@/features/extension-api/server/response"
import { getDatabase } from "@/lib/database"
import { getUserProfileByClerkId } from "@/lib/persistence"
import { resolveRequestAuth } from "@/lib/request-auth"
import { readRequestText, RequestBodyTooLargeError } from "@/lib/request-body"
import { PublicUrlValidationError, validatePublicHttpUrl } from "@/lib/url-security"
import { computeTextHash } from "@/lib/change-detection"
import { resolveTextFromUrl, storeResolvedText } from "@/lib/extract"
import { identifyDocument } from "@/lib/document-identity"
import { getPlanEntitlements } from "@/lib/entitlements"

const MAX_BODY_BYTES = 16 * 1024

async function getIdentity(request: Request) {
  const auth = await resolveRequestAuth(request, { allowApiKey: false })
  if (!auth.ok) return auth
  const profile = await getUserProfileByClerkId(auth.identity.clerkId)
  if (!profile) return { ok: false as const, status: 404, error: "User not found" }
  return { ok: true as const, profile }
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const raw = await readRequestText(request, MAX_BODY_BYTES)
  const parsed = JSON.parse(raw) as unknown
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid_body")
  return parsed as Record<string, unknown>
}

export async function POST(request: Request) {
  try {
    const identity = await getIdentity(request)
    if (!identity.ok) return NextResponse.json({ error: identity.error }, { status: identity.status })
    const body = parseExtensionMonitorSubscribeRequest(await readBody(request))
    const url = body?.url.trim() ?? ""
    const title = body?.title?.trim().slice(0, 300) ?? null
    const frequency = body?.frequency ?? "weekly"
    if (!url) return NextResponse.json({ error: "url is required" }, { status: 400 })

    const normalizedUrl = (await validatePublicHttpUrl(url)).href
    const domain = new URL(normalizedUrl).hostname.replace(/^www\./, "")
    const resolved = await resolveTextFromUrl(normalizedUrl)
    const text = resolved.text.trim()
    if (!text) return NextResponse.json({ error: "The document is empty" }, { status: 422 })

    const document = identifyDocument({ text, url: normalizedUrl })
    if (document.needsReview || !document.identityKey) {
      return NextResponse.json(
        {
          error: "We could not confidently identify this legal document. Use the direct Privacy Policy, Terms of Use, or Terms of Service URL.",
          document,
        },
        { status: 422 },
      )
    }

    const limit = MONITOR_LIMITS[identity.profile.plan] ?? MONITOR_LIMITS.free
    const subscription = await subscribe(
      identity.profile.id,
      normalizedUrl,
      domain,
      title,
      document,
      frequency,
      limit,
    )

    if (!getPlanEntitlements(identity.profile.plan).emailAlerts) {
      await getDatabase()
        .from("monitoring_subscriptions")
        .update({ email_notifications_enabled: false })
        .eq("id", subscription.id)
    }

    try {
      const existingSnapshot = await getLatestSnapshot(normalizedUrl, subscription.id)
      if (!existingSnapshot) {
        const { data: recentScan } = await getDatabase()
          .from("scans")
          .select("id, risk_score, flagged_count, clause_count")
          .eq("url", normalizedUrl)
          .eq("user_id", identity.profile.id)
          .eq("document_identity_key", document.identityKey)
          .eq("is_deleted", false)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
        await createSnapshot(
          normalizedUrl,
          domain,
          computeTextHash(text),
          resolved.wordCount,
          recentScan?.risk_score == null ? null : Number(recentScan.risk_score),
          recentScan?.flagged_count == null ? null : Number(recentScan.flagged_count),
          recentScan?.clause_count == null ? null : Number(recentScan.clause_count),
          null,
          recentScan?.id == null ? null : String(recentScan.id),
          subscription.id,
          document.type,
          document.identityKey,
        )
        await storeResolvedText(normalizedUrl, resolved)
      }
    } catch (error) {
      console.warn("[monitor] Initial snapshot skipped", error instanceof Error ? error.name : "UnknownError")
    }
    return extensionJson({ ok: true, subscription, limit })
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: "Request body is too large" }, { status: 413 })
    }
    const message = error instanceof Error ? error.message : ""
    if (message.includes("monitor_limit_reached")) {
      return NextResponse.json({ error: "Monitoring plan limit reached", upgradeRequired: true }, { status: 402 })
    }
    if (message.includes("invalid_body") || error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 })
    }
    if (error instanceof PublicUrlValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (message.includes("Invalid monitoring subscription parameters")) {
      return NextResponse.json({ error: "Monitoring requires a high-confidence recognized legal document." }, { status: 422 })
    }
    console.error("[monitor] Subscribe failed", error instanceof Error ? error.name : "UnknownError")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const identity = await getIdentity(request)
    if (!identity.ok) return NextResponse.json({ error: identity.error }, { status: identity.status })
    const body = parseExtensionMonitorUnsubscribeRequest(await readBody(request))
    const subscriptionId = body?.subscriptionId ?? ""
    if (!subscriptionId) return NextResponse.json({ error: "subscriptionId is required" }, { status: 400 })
    await unsubscribe(subscriptionId, identity.profile.id)
    return extensionJson({ ok: true })
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return NextResponse.json({ error: "Request body is too large" }, { status: 413 })
    if (error instanceof SyntaxError || (error instanceof Error && error.message === "invalid_body")) {
      return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 })
    }
    if (error instanceof Error && error.message === "subscription_not_found") {
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 })
    }
    console.error("[monitor] Unsubscribe failed", error instanceof Error ? error.name : "UnknownError")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const identity = await getIdentity(request)
    if (!identity.ok) return NextResponse.json({ error: identity.error }, { status: identity.status })
    const body = await readBody(request)
    const subscriptionId = typeof body.subscriptionId === "string" ? body.subscriptionId : ""
    const enabled = body.emailNotificationsEnabled
    if (!subscriptionId || typeof enabled !== "boolean") {
      return NextResponse.json({ error: "subscriptionId and emailNotificationsEnabled are required" }, { status: 400 })
    }
    if (enabled && !getPlanEntitlements(identity.profile.plan).emailAlerts) {
      return NextResponse.json({ error: "Email monitoring alerts require a Personal or Founder plan", upgradeRequired: true }, { status: 402 })
    }
    const { data, error } = await getDatabase()
      .from("monitoring_subscriptions")
      .update({ email_notifications_enabled: enabled })
      .eq("id", subscriptionId)
      .eq("user_id", identity.profile.id)
      .eq("is_active", true)
      .select()
      .maybeSingle()
    if (error) throw error
    if (!data) return NextResponse.json({ error: "Subscription not found" }, { status: 404 })
    return extensionJson({ ok: true, subscription: data })
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return NextResponse.json({ error: "Request body is too large" }, { status: 413 })
    if (error instanceof SyntaxError || (error instanceof Error && error.message === "invalid_body")) {
      return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 })
    }
    console.error("[monitor] Notification preference update failed", error instanceof Error ? error.name : "UnknownError")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const identity = await getIdentity(request)
    if (!identity.ok) return NextResponse.json({ error: identity.error }, { status: identity.status })
    const subscriptions = await getSubscriptions(
      identity.profile.id,
      getPlanEntitlements(identity.profile.plan).emailAlerts,
    )
    return extensionJson({
      subscriptions,
      limit: MONITOR_LIMITS[identity.profile.plan] ?? MONITOR_LIMITS.free,
    })
  } catch (error) {
    console.error("[monitor] List failed", error instanceof Error ? error.name : "UnknownError")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
