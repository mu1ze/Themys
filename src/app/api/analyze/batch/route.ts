import { currentUser } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

import { developerAnalysisPolicy, developerItemFailure, isDeveloperApiRequest } from "@/contracts/developer-api"
import { developerJson } from "@/features/developer-api/server/response"
import { analyzeItem, AnalysisProviderError } from "@/features/scans/server/analyze"
import { AnalysisInputTooLargeError, MAX_ANALYSIS_CHARS } from "@/lib/analysis-limits"
import { recordApiKeyUsage, type AuthenticatedApiKey } from "@/lib/api-keys"
import {
  consumeCreditForClerkId,
  getCreditBalanceByClerkId,
  getUserProfileByClerkId,
  persistAnalysis,
  refundCreditForClerkId,
} from "@/lib/persistence"
import { checkRateLimit, getRateLimitStatus, settleRateLimit } from "@/lib/rate-limit"
import type { RateLimitBucket, RateLimitTier } from "@/lib/rate-limit"
import { resolveRequestAuth } from "@/lib/request-auth"
import { readRequestText, RequestBodyTooLargeError } from "@/lib/request-body"
import { getRequestIdempotencyKey, recordUsageEvent } from "@/lib/usage-accounting"
import { normalizePublicHttpUrl } from "@/lib/url-security"
import { chargingPolicy } from "@/lib/usage-policy"
import { requestIdFrom } from "@/lib/server-timing"

const MAX_BATCH_ITEMS = 5
const MAX_REQUEST_BYTES = 1024 * 1024

type BatchItem = { text?: unknown; url?: unknown; sourceUrl?: unknown; domain?: unknown }
type BatchItemResult =
  | { ok: true; index: number; cached: boolean; result: unknown }
  | { ok: false; index: number; error: string; status: number }

class BatchQuotaError extends Error {
  constructor(readonly kind: "scan" | "ai") { super(kind) }
}

function value(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export async function POST(request: Request) {
  const startedAt = Date.now()
  const requestId = requestIdFrom(request)
  const developerRequest = isDeveloperApiRequest(request)
  let usageApiKey: AuthenticatedApiKey | null = null
  const json = async (body: Record<string, unknown>, status = 200) => {
    if (usageApiKey) {
      await recordApiKeyUsage(
        usageApiKey,
        "/api/analyze/batch",
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
    const auth = await resolveRequestAuth(request, { apiKeyScope: "analyze" })
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
    const profile = await getUserProfileByClerkId(clerkId)
    const user = apiKey || profile ? null : await currentUser()
    const tier: RateLimitTier = profile?.plan ?? "free"
    const bucket: RateLimitBucket = apiKey ? "api-key" : "user"
    const rateLimitUserId = apiKey ? `${clerkId}:${apiKey.apiKeyId}` : clerkId
    const requestKey = getRequestIdempotencyKey(request) ?? crypto.randomUUID()

    let rawBody: string
    try {
      rawBody = await readRequestText(request, MAX_REQUEST_BYTES)
    } catch (error) {
      if (!(error instanceof RequestBodyTooLargeError)) throw error
      return json({ error: "Request body is too large" }, 413)
    }
    let body: unknown
    try { body = JSON.parse(rawBody) } catch { return json({ error: "Invalid JSON request body" }, 400) }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return json({ error: "Request body must be a JSON object" }, 400)
    }
    const itemsValue = (body as { items?: unknown }).items
    const items = Array.isArray(itemsValue) ? itemsValue as BatchItem[] : []
    if (items.length < 1) return json({ error: "Provide at least 1 item" }, 400)
    if (items.length > MAX_BATCH_ITEMS) {
      return json({ error: `Batch size ${items.length} exceeds limit of ${MAX_BATCH_ITEMS}` }, 400)
    }

    const processItem = async (raw: BatchItem, index: number): Promise<BatchItemResult> => {
      const text = value(raw?.text)
      const url = value(raw?.url)
      const sourceUrl = value(raw?.sourceUrl)
      const domain = value(raw?.domain)
      if (Boolean(text) === Boolean(url)) {
        return { ok: false, index, error: "Provide exactly one of text or url", status: 400 }
      }
      if (text.length > MAX_ANALYSIS_CHARS) return { ok: false, index, error: "Item text is too large", status: 413 }
      if (Math.max(url.length, sourceUrl.length) > 2_048 || domain.length > 253) {
        return { ok: false, index, error: "Item URL or domain is too long", status: 400 }
      }
      try {
        if (url || sourceUrl) normalizePublicHttpUrl(url || sourceUrl)
      } catch {
        return { ok: false, index, error: "Item URL must be a safe public HTTP(S) URL", status: 400 }
      }

      const itemKey = `${requestKey}:item:${index}`
      let scanReservationId: string | undefined
      let aiReservationId: string | undefined
      let scanReservationReplay = false
      let aiReservationReplay = false
      let scanCreditKey: string | undefined
      let aiCreditKey: string | undefined
      let scanCredit = false
      let aiCredit = false
      try {
        const scan = await checkRateLimit(rateLimitUserId, tier, "scans", bucket, 1, `${itemKey}:scan`)
        scanReservationId = scan.reservationId
        scanReservationReplay = scan.replay === true
        if (!scan.allowed) {
          if (apiKey) throw new BatchQuotaError("scan")
          scanCreditKey = `${itemKey}:scan-credit`
          const credit = await consumeCreditForClerkId(clerkId, {
            idempotencyKey: scanCreditKey,
            purpose: "scan_overflow",
          })
          if (!credit.consumed) throw new BatchQuotaError("scan")
          scanCredit = !credit.replay
        }

        const output = await analyzeItem(
          { text, url, sourceUrl, domain },
          {
            targetClauses: profile?.targetClauses ?? [],
            strictMode: profile?.strictMode ?? false,
            userContext: { userId: clerkId, tier },
            beforeProvider: async () => {
              const ai = await checkRateLimit(rateLimitUserId, tier, "ai", bucket, 1, `${itemKey}:ai`)
              aiReservationId = ai.reservationId
              aiReservationReplay = ai.replay === true
              if (ai.allowed) return
              if (apiKey) throw new BatchQuotaError("ai")
              aiCreditKey = `${itemKey}:ai-credit`
              const credit = await consumeCreditForClerkId(clerkId, {
                idempotencyKey: aiCreditKey,
                purpose: "ai_overflow",
              })
              if (!credit.consumed) throw new BatchQuotaError("ai")
              aiCredit = !credit.replay
            },
          },
        )
        const email = profile?.email ?? (user
          ? user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? "unknown@example.com"
          : `api-key+${apiKey?.keyPrefix ?? "unknown"}@themys.invalid`)
        await persistAnalysis({
          clerkId,
          email,
          text: output.text,
          url: output.documentUrl ?? undefined,
          domain: domain || (output.documentUrl ? new URL(output.documentUrl).hostname.replace(/^www\./, "") : undefined),
          source: output.source,
          result: output.result,
          fullExtraction: output.fullExtraction,
          document: output.document,
        })
        await Promise.all([
          settleRateLimit(scanReservationReplay ? undefined : scanReservationId, true),
          settleRateLimit(aiReservationReplay ? undefined : aiReservationId, true),
        ])
        const policy = chargingPolicy(output.cached ? "cached_success" : "uncached_success")
        await recordUsageEvent({
          actor: rateLimitUserId,
          client: apiKey ? "api_key" : "web",
          operation: "batch_item",
          outcome: scanReservationReplay ? "idempotent_replay" : "success",
          cached: output.cached,
          scanSlots: scanReservationReplay ? 0 : policy.scanSlots,
          aiSlots: aiReservationReplay ? 0 : policy.aiSlots,
          credits: Number(scanCredit) + Number(aiCredit),
          idempotencyKey: itemKey,
          metadata: { index },
        }).catch(() => undefined)
        const { jevDiagnostics: _jevDiagnostics, ...publicResult } = output.result
        return {
          ok: true,
          index,
          cached: output.cached,
          result: {
            ...publicResult,
            fullExtraction: output.fullExtraction,
            document: output.document,
            analysisPolicy: developerAnalysisPolicy(profile),
          },
        }
      } catch (error) {
        await Promise.all([
          settleRateLimit(scanReservationReplay ? undefined : scanReservationId, false).catch(() => null),
          settleRateLimit(aiReservationReplay ? undefined : aiReservationId, false).catch(() => null),
          scanCredit && scanCreditKey ? refundCreditForClerkId(clerkId, scanCreditKey).catch(() => false) : false,
          aiCredit && aiCreditKey ? refundCreditForClerkId(clerkId, aiCreditKey).catch(() => false) : false,
        ])
        const status = error instanceof BatchQuotaError
          ? apiKey ? 429 : 402
          : error instanceof AnalysisInputTooLargeError
            ? 413
            : error instanceof AnalysisProviderError ? 502 : 502
        const message = error instanceof BatchQuotaError
          ? `${error.kind === "ai" ? "AI" : "Scan"} quota exceeded`
          : error instanceof AnalysisInputTooLargeError
            ? error.message
          : error instanceof AnalysisProviderError
            ? "Analysis provider unavailable"
            : url ? "Failed to extract or analyze URL" : "Analysis failed"
        await recordUsageEvent({
          actor: rateLimitUserId,
          client: apiKey ? "api_key" : "web",
          operation: "batch_item",
          outcome: error instanceof BatchQuotaError ? "quota_rejected" : "failed",
          idempotencyKey: itemKey,
          metadata: error instanceof BatchQuotaError ? { index, kind: error.kind } : { index },
        }).catch(() => undefined)
        return { ok: false, index, error: message, status }
      }
    }

    const results = await Promise.all(items.map(processItem))
    const [scanStatus, aiStatus, creditBalance] = await Promise.all([
      getRateLimitStatus(rateLimitUserId, tier, "scans", bucket),
      getRateLimitStatus(rateLimitUserId, tier, "ai", bucket),
      apiKey ? Promise.resolve(0) : getCreditBalanceByClerkId(clerkId),
    ])
    const succeeded = results.filter((result) => result.ok).length
    const responseResults = developerRequest
      ? results.map((result) => result.ok
          ? result
          : developerItemFailure(result.index, result.status, result.error))
      : results
    return json({
      results: responseResults,
      summary: {
        total: results.length,
        succeeded,
        failed: results.length - succeeded,
        authenticatedAs: apiKey ? "api-key" : "clerk",
      },
      usage: { tier, scans: scanStatus, ai: aiStatus, creditBalance },
    })
  } catch (error) {
    console.error("[analyze/batch] Request failed", error instanceof Error ? error.name : "UnknownError")
    return json({ error: "Internal server error" }, 500)
  }
}
