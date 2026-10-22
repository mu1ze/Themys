import { NextResponse } from "next/server"
import { isDeveloperApiRequest } from "@/contracts/developer-api"
import { developerJson } from "@/features/developer-api/server/response"
import { resolveTextFromUrl, storeResolvedText } from "@/lib/extract"
import { recordApiKeyUsage, type AuthenticatedApiKey } from "@/lib/api-keys"
import { getUserProfileByClerkId } from "@/lib/persistence"
import { checkRateLimit, settleRateLimit } from "@/lib/rate-limit"
import type { RateLimitBucket, RateLimitTier } from "@/lib/rate-limit"
import { resolveRequestAuth } from "@/lib/request-auth"
import { readRequestText, RequestBodyTooLargeError } from "@/lib/request-body"
import { getRequestIdempotencyKey } from "@/lib/usage-accounting"
import { normalizePublicHttpUrl } from "@/lib/url-security"
import { parseExtensionExtractRequest } from "@/contracts/extension"
import { extensionJson } from "@/features/extension-api/server/response"
import { requestIdFrom } from "@/lib/server-timing"

const MAX_REQUEST_BYTES = 16 * 1024

export async function POST(request: Request) {
  const startedAt = Date.now()
  const requestId = requestIdFrom(request)
  const developerRequest = isDeveloperApiRequest(request)
  let usageApiKey: AuthenticatedApiKey | null = null
  let extractReservationId: string | undefined
  let extractReservationReplay = false
  const json = async (body: Record<string, unknown>, status = 200) => {
    if (usageApiKey) {
      await recordApiKeyUsage(
        usageApiKey,
        "/api/extract",
        status,
        startedAt,
        typeof body.error === "string" ? body.error : undefined,
      )
    }
    return developerRequest
      ? developerJson(requestId, body, status)
      : NextResponse.json(body, { status })
  }

  try {
    const auth = await resolveRequestAuth(request, { apiKeyScope: "extract" })
    if (!auth.ok) {
      usageApiKey = auth.apiKey ?? null
      return json(
        { error: auth.error, ...(auth.requiredScope ? { requiredScope: auth.requiredScope } : {}) },
        auth.status,
      )
    }
    const apiKey = auth.identity.apiKey
    usageApiKey = apiKey
    const clerkId = auth.identity.clerkId

    let rawBody: string
    try {
      rawBody = await readRequestText(request, MAX_REQUEST_BYTES)
    } catch (error) {
      if (!(error instanceof RequestBodyTooLargeError)) throw error
      return json({ error: "Request body is too large" }, 413)
    }

    let body: unknown
    try {
      body = JSON.parse(rawBody)
    } catch {
      return json({ error: "Invalid JSON request body" }, 400)
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return json({ error: "Request body must be a JSON object" }, 400)
    }
    const requestBody = parseExtensionExtractRequest(body)
    const url = requestBody?.url

    if (!url || typeof url !== "string") {
      return json({ error: "Missing or invalid 'url' in request body" }, 400)
    }
    try {
      normalizePublicHttpUrl(url)
    } catch {
      return json({ error: "URL must be a safe public HTTP(S) URL" }, 400)
    }

    const profile = await getUserProfileByClerkId(clerkId)
    const tier: RateLimitTier = profile?.plan ?? "free"
    const bucket: RateLimitBucket = apiKey ? "api-key" : "user"
    const rateLimitUserId = apiKey ? `${clerkId}:${apiKey.apiKeyId}` : clerkId
    const idempotencyKey = getRequestIdempotencyKey(request) ?? crypto.randomUUID()

    const reservation = await checkRateLimit(rateLimitUserId, tier, "extract", bucket, 1, idempotencyKey)
    extractReservationId = reservation.reservationId
    extractReservationReplay = reservation.replay === true
    if (!reservation.allowed) {
      return json({ error: "Daily extract limit reached", tier }, 429)
    }

    let result
    try {
      result = await resolveTextFromUrl(url)
    } catch {
      await settleRateLimit(extractReservationReplay ? undefined : extractReservationId, false).catch(() => null)
      extractReservationId = undefined
      return json({ error: "Failed to extract text from the URL" }, 502)
    }
    await settleRateLimit(extractReservationReplay ? undefined : extractReservationId, true).catch(() => null)
    extractReservationId = undefined
    try {
      await storeResolvedText(url, result)
    } catch (cacheErr) {
      const message = cacheErr instanceof Error ? cacheErr.message : "Unknown cache error"
      console.warn(`[extract] Text cache write skipped: ${message}`)
    }
    return apiKey ? json(result) : extensionJson(result)
  } catch (err) {
    await settleRateLimit(extractReservationReplay ? undefined : extractReservationId, false).catch(() => null)
    console.error("[extract] Request failed", err instanceof Error ? err.name : "UnknownError")
    if (usageApiKey) {
      await recordApiKeyUsage(usageApiKey, "/api/extract", 500, startedAt, "Internal server error").catch(() => undefined)
    }
    return developerRequest
      ? developerJson(requestId, { error: "Internal server error" }, 500)
      : NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
