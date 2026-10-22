import { currentUser } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

import { developerAnalysisPolicy, isDeveloperApiRequest } from "@/contracts/developer-api"
import { analyzeItem, AnalysisProviderError } from "@/features/scans/server/analyze"
import { AnalysisInputTooLargeError, MAX_ANALYSIS_CHARS } from "@/lib/analysis-limits"
import { developerJson } from "@/features/developer-api/server/response"
import { recordApiKeyUsage, type AuthenticatedApiKey } from "@/lib/api-keys"
import {
  assertContractUploadAllowed,
  type ScanSource,
} from "@/lib/contract-upload"
import type { Plan } from "@/lib/entitlements"
import {
  consumeCreditForClerkId,
  countContractUploads,
  getCreditBalanceByClerkId,
  getUserProfileByClerkId,
  persistAnalysis,
  refundCreditForClerkId,
} from "@/lib/persistence"
import { buildPushbackList } from "@/lib/pushback"
import { extractPdfText, PdfTextError } from "@/lib/pdf-text"
import { checkRateLimit, getRateLimitStatus, settleRateLimit } from "@/lib/rate-limit"
import type { RateLimitBucket, RateLimitTier } from "@/lib/rate-limit"
import { resolveRequestAuth } from "@/lib/request-auth"
import { readRequestText, RequestBodyTooLargeError } from "@/lib/request-body"
import { getRequestIdempotencyKey, recordUsageEvent } from "@/lib/usage-accounting"
import { themysClientFromRequest, isOverlayCaptureClient } from "@/lib/themys-client"
import { normalizePublicHttpUrl } from "@/lib/url-security"
import { chargingPolicy } from "@/lib/usage-policy"
import { getRuntimeEnvironment } from "@/lib/runtime-env"
import { requestIdFrom, ServerTiming } from "@/lib/server-timing"

const MAX_REQUEST_BYTES = 256 * 1024
const MAX_URL_CHARS = 2_048
const MAX_DOMAIN_CHARS = 253
const MAX_PDF_BYTES = 8 * 1024 * 1024

class UsageLimitError extends Error {
  constructor(readonly kind: "scan" | "ai") {
    super(`${kind} limit reached`)
  }
}

class ScanPersistError extends Error {
  constructor() {
    super("Scan results could not be saved")
    this.name = "ScanPersistError"
  }
}

function persistenceFailureDetail(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message?: unknown }).message)
  }
  return String(error)
}

function normalizeInput(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function pdfExtractionErrorMessage(code: PdfTextError["code"]): string {
  if (code === "too_large") return "PDF file is too large"
  if (code === "image_only") return "PDF appears to be image-only or too short to analyze"
  return "PDF contains no extractable text"
}

function pdfExtractionErrorStatus(code: PdfTextError["code"]): number {
  if (code === "too_large") return 413
  if (code === "image_only" || code === "empty") return 422
  return 400
}

export async function POST(request: Request) {
  const startedAt = Date.now()
  const requestId = requestIdFrom(request)
  const developerRequest = isDeveloperApiRequest(request)
  const timing = new ServerTiming()
  let usageApiKey: AuthenticatedApiKey | null = null
  const json = async (body: Record<string, unknown>, status = 200) => {
    if (usageApiKey) {
      await timing.measure("api-key-usage", () => recordApiKeyUsage(
        usageApiKey as AuthenticatedApiKey,
        "/api/analyze",
        status,
        startedAt,
        typeof body.error === "string" ? body.error : undefined,
      ))
    }
    const response = developerRequest
      ? developerJson(requestId, body, status)
      : NextResponse.json(body, { status })
    response.headers.set("x-request-id", requestId)
    const serverTiming = timing.header()
    if (serverTiming) response.headers.set("server-timing", serverTiming)
    return response
  }

  const auth = await timing.measure("auth", () =>
    resolveRequestAuth(request, { apiKeyScope: "analyze" }),
  )
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
  const profile = await timing.measure("profile", () => getUserProfileByClerkId(clerkId))
  const user = apiKey || profile ? null : await timing.measure("clerk-user", () => currentUser())
  const tier: RateLimitTier = profile?.plan ?? "free"
  const bucket: RateLimitBucket = apiKey ? "api-key" : "user"
  const rateLimitUserId = apiKey ? `${clerkId}:${apiKey.apiKeyId}` : clerkId
  const idempotencyKey = getRequestIdempotencyKey(request) ?? crypto.randomUUID()
  const client = themysClientFromRequest(request, { apiKey: Boolean(apiKey) })

  let scanReservationId: string | undefined
  let aiReservationId: string | undefined
  let scanReservationReplay = false
  let aiReservationReplay = false
  let scanCreditKey: string | undefined
  let aiCreditKey: string | undefined
  let scanCreditConsumed = false
  let aiCreditConsumed = false

  try {
    const contentType = request.headers.get("content-type") ?? ""
    const isMultipart = contentType.includes("multipart/form-data")

    let text = ""
    let url = ""
    let sourceUrl = ""
    let domain = ""
    let bypassCache = false
    let persistSource: ScanSource | undefined
    let scanSource: ScanSource | undefined

    if (isMultipart) {
      if (apiKey) {
        return json({ error: "PDF upload is only supported for signed-in web sessions" }, 400)
      }

      const declaredLength = Number(request.headers.get("content-length"))
      if (Number.isFinite(declaredLength) && declaredLength > MAX_PDF_BYTES) {
        return json({ error: "PDF file is too large" }, 413)
      }

      const formData = await request.formData()
      const file = formData.get("file")
      if (!file || typeof file === "string") {
        return json({ error: "PDF file is required" }, 400)
      }

      const upload = file as File
      if (upload.type !== "application/pdf") {
        return json({ error: "Only PDF files are supported" }, 400)
      }
      if (upload.size > MAX_PDF_BYTES) {
        return json({ error: "PDF file is too large" }, 413)
      }

      try {
        text = await extractPdfText(new Uint8Array(await upload.arrayBuffer()))
      } catch (error) {
        if (error instanceof PdfTextError) {
          return json(
            { error: pdfExtractionErrorMessage(error.code) },
            pdfExtractionErrorStatus(error.code),
          )
        }
        throw error
      }

      persistSource = "upload"
      scanSource = "upload"
    } else {
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

      const input = body as Record<string, unknown>
      text = normalizeInput(input.text)
      url = normalizeInput(input.url)
      sourceUrl = normalizeInput(input.sourceUrl)
      domain = normalizeInput(input.domain)
      const bypassCacheInput = input.bypassCache

      if (Boolean(url) === Boolean(text)) {
        return json({ error: "Provide exactly one of URL or pasted terms text" }, 400)
      }
      if (sourceUrl && !text) return json({ error: "sourceUrl is only valid with pasted text" }, 400)
      if (text.length > MAX_ANALYSIS_CHARS) return json({ error: "Pasted text is too large" }, 413)
      if (Math.max(url.length, sourceUrl.length) > MAX_URL_CHARS) return json({ error: "URL is too long" }, 413)
      if (domain.length > MAX_DOMAIN_CHARS) return json({ error: "Domain is too long" }, 400)
      if (bypassCacheInput !== undefined && typeof bypassCacheInput !== "boolean") {
        return json({ error: "bypassCache must be a boolean" }, 400)
      }
      bypassCache = bypassCacheInput === true

      if (text && !url) {
        scanSource = isOverlayCaptureClient(client) ? "extension" : "paste"
        if (client === "web") persistSource = "paste"
      }
    }

    const documentUrl = url || sourceUrl
    if (documentUrl) {
      try {
        normalizePublicHttpUrl(documentUrl)
      } catch {
        return json({ error: "URL must be a safe public HTTP(S) URL" }, 400)
      }
    }
    if (bypassCache) {
      const admins = new Set(
        (getRuntimeEnvironment().ADMIN_CLERK_IDS ?? "").split(",").map((id) => id.trim()).filter(Boolean),
      )
      if (apiKey || !admins.has(clerkId)) {
        return json({ error: "bypassCache is restricted to administrators" }, 403)
      }
    }

    const needsContractUploadGate =
      !apiKey && client === "web" && (persistSource === "paste" || persistSource === "upload")
    if (needsContractUploadGate) {
      const used = await timing.measure("contract-count", () => countContractUploads(clerkId))
      const uploadAllowed = assertContractUploadAllowed(tier as Plan, used)
      if (!uploadAllowed.ok) {
        await recordUsageEvent({
          actor: rateLimitUserId,
          client,
          operation: "contract_upload",
          outcome: "quota_rejected",
          idempotencyKey: `${idempotencyKey}:contract-upload`,
          metadata: { tier, reason: "contract_upload" },
        }).catch(() => undefined)
        return json(
          {
            upgradeRequired: true,
            reason: "contract_upload",
            tier,
            upgradePlan: "advanced",
          },
          402,
        )
      }
    }

    const scanReservation = await timing.measure("scan-quota", () => checkRateLimit(
      rateLimitUserId,
      tier,
      "scans",
      bucket,
      1,
      `${idempotencyKey}:scan`,
    ))
    scanReservationId = scanReservation.reservationId
    scanReservationReplay = scanReservation.replay === true
    if (!scanReservation.allowed) {
      if (apiKey) throw new UsageLimitError("scan")
      scanCreditKey = `${idempotencyKey}:scan-credit`
      const credit = await consumeCreditForClerkId(clerkId, {
        idempotencyKey: scanCreditKey,
        purpose: "scan_overflow",
      })
      if (!credit.consumed) throw new UsageLimitError("scan")
      scanCreditConsumed = !credit.replay
    }

    const output = await timing.measure("analysis", () => analyzeItem(
      { text, url, sourceUrl, domain },
      {
        bypassCache: bypassCache === true,
        scanSource,
        targetClauses: profile?.targetClauses ?? [],
        strictMode: profile?.strictMode ?? false,
        userContext: { userId: clerkId, tier },
        beforeProvider: async () => {
          const aiReservation = await timing.measure("ai-quota", () => checkRateLimit(
            rateLimitUserId,
            tier,
            "ai",
            bucket,
            1,
            `${idempotencyKey}:ai`,
          ))
          aiReservationId = aiReservation.reservationId
          aiReservationReplay = aiReservation.replay === true
          if (aiReservation.allowed) return
          if (apiKey) throw new UsageLimitError("ai")
          aiCreditKey = `${idempotencyKey}:ai-credit`
          const credit = await consumeCreditForClerkId(clerkId, {
            idempotencyKey: aiCreditKey,
            purpose: "ai_overflow",
          })
          if (!credit.consumed) throw new UsageLimitError("ai")
          aiCreditConsumed = !credit.replay
        },
      },
    ))

    const email = profile?.email ?? (user
      ? user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? "unknown@example.com"
      : `api-key+${apiKey?.keyPrefix ?? "unknown"}@themys.invalid`)
    let scanId: string
    try {
      scanId = await timing.measure("persist", () => persistAnalysis({
        clerkId,
        email,
        text: output.text,
        url: output.documentUrl ?? undefined,
        domain: domain || (output.documentUrl ? new URL(output.documentUrl).hostname.replace(/^www\./, "") : undefined),
        source:
          persistSource ??
          (isOverlayCaptureClient(client) ? "extension" : output.source),
        result: output.result,
        fullExtraction: output.fullExtraction,
        document: output.document,
      }))
    } catch (error) {
      console.warn(`[analyze] Persistence failed — ${persistenceFailureDetail(error)}`)
      throw new ScanPersistError()
    }

    await Promise.all([
      settleRateLimit(scanReservationReplay ? undefined : scanReservationId, true),
      settleRateLimit(aiReservationReplay ? undefined : aiReservationId, true),
    ])

    const compactWebResponse = !developerRequest
      && !apiKey
      && client === "web"
      && request.headers.get("x-themys-response") === "web-compact"
    const policy = chargingPolicy(output.cached ? "cached_success" : "uncached_success")
    await recordUsageEvent({
      actor: rateLimitUserId,
      client,
      operation: "analyze",
      outcome: scanReservationReplay ? "idempotent_replay" : "success",
      cached: output.cached,
      metadata: { duration_ms: Date.now() - startedAt },
      scanSlots: scanReservationReplay ? 0 : policy.scanSlots,
      aiSlots: aiReservationReplay ? 0 : policy.aiSlots,
      credits: Number(scanCreditConsumed) + Number(aiCreditConsumed),
      idempotencyKey,
    }).catch(() => undefined)

    if (persistSource === "paste" || persistSource === "upload") {
      await recordUsageEvent({
        actor: rateLimitUserId,
        client,
        operation: "contract_upload",
        outcome: "success",
        idempotencyKey: `${idempotencyKey}:contract-upload`,
        metadata: { source: persistSource },
      }).catch(() => undefined)
    }

    if (compactWebResponse) {
      return json({ scanId })
    }

    const [scanStatus, aiStatus, creditBalance] = await timing.measure(
      "usage-status",
      () => Promise.all([
        getRateLimitStatus(rateLimitUserId, tier, "scans", bucket),
        getRateLimitStatus(rateLimitUserId, tier, "ai", bucket),
        apiKey ? Promise.resolve(0) : getCreditBalanceByClerkId(clerkId),
      ]),
    )

    const { jevDiagnostics: _jevDiagnostics, ...publicResult } = output.result
    return json({
      ...publicResult,
      scanId,
      pushback: buildPushbackList(output.result.clauses, 10),
      fullExtraction: output.fullExtraction,
      document: output.document,
      analysisPolicy: developerAnalysisPolicy(profile),
      usage: {
        tier,
        scans: scanStatus,
        ai: aiStatus,
        creditBalance,
        creditConsumed: scanCreditConsumed || aiCreditConsumed,
        scanCreditConsumed,
        aiCreditConsumed,
        cached: output.cached,
        authenticatedAs: apiKey ? "api-key" : "clerk",
      },
    })
  } catch (error) {
    await Promise.all([
      settleRateLimit(scanReservationReplay ? undefined : scanReservationId, false).catch(() => null),
      settleRateLimit(aiReservationReplay ? undefined : aiReservationId, false).catch(() => null),
      scanCreditConsumed && scanCreditKey
        ? refundCreditForClerkId(clerkId, scanCreditKey).catch(() => false)
        : Promise.resolve(false),
      aiCreditConsumed && aiCreditKey
        ? refundCreditForClerkId(clerkId, aiCreditKey).catch(() => false)
        : Promise.resolve(false),
    ])
    const status = error instanceof UsageLimitError
      ? apiKey ? 429 : 402
      : error instanceof AnalysisInputTooLargeError
        ? 413
      : error instanceof AnalysisProviderError
        ? 502
        : error instanceof ScanPersistError
          ? 500
          : 500
    const message = error instanceof UsageLimitError
      ? `${error.kind === "ai" ? "Monthly AI" : "Daily scan"} limit reached`
      : error instanceof AnalysisInputTooLargeError
        ? error.message
      : error instanceof AnalysisProviderError
        ? "Analysis provider unavailable"
        : error instanceof ScanPersistError
          ? error.message
          : "Internal server error"
    await recordUsageEvent({
      actor: rateLimitUserId,
      client,
      operation: "analyze",
      outcome: status === 402 || status === 429 ? "quota_rejected" : "failed",
      idempotencyKey,
      // Record *which* limit drove the rejection so the admin Conversion
      // dashboard can attribute paywall pressure to scan vs. AI limits.
      metadata:
        error instanceof UsageLimitError
          ? { kind: error.kind, tier, duration_ms: Date.now() - startedAt }
          : { tier, duration_ms: Date.now() - startedAt },
    }).catch(() => undefined)
    console.error(
      "[analyze] Request failed",
      JSON.stringify({ requestId, name: error instanceof Error ? error.name : "UnknownError" }),
    )
    return json({ error: message, tier, upgradeRequired: status === 402 }, status)
  }
}
