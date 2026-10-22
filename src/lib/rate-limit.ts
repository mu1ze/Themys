import { PLAN_ENTITLEMENTS, type Plan } from "./entitlements.ts"

export type RateLimitTier = Plan
export type LimitType = "scans" | "ai" | "extract"
export type RateLimitBucket = "user" | "api-key"

export type RateLimitResult = {
  allowed: boolean
  remaining: number
  limit: number
  resetsAt: number
  windowEnd: number
  reservationId?: string
  replay?: boolean
}

const MONTHLY_WINDOW_SECONDS = 30 * 86_400

export const RATE_LIMITS: Record<RateLimitTier, Record<LimitType, { max: number; windowSeconds: number }>> =
  Object.fromEntries(Object.entries(PLAN_ENTITLEMENTS).map(([plan, entitlements]) => [
    plan,
    {
      scans: { max: entitlements.monthlyReviews, windowSeconds: MONTHLY_WINDOW_SECONDS },
      ai: { max: entitlements.monthlyAiExplanations, windowSeconds: MONTHLY_WINDOW_SECONDS },
      extract: { max: entitlements.dailyExtracts, windowSeconds: 86_400 },
    },
  ])) as Record<RateLimitTier, Record<LimitType, { max: number; windowSeconds: number }>>

function scansWindowKey(now: Date): string {
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, "0")
  const d = String(now.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function aiWindowKey(now: Date): string {
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, "0")
  return `${y}-${m}`
}

function nextMidnightUTC(now: Date): number {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
}

function nextMonthStartUTC(now: Date): number {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
}

export function getRateLimitWindow(
  type: LimitType,
  now = new Date(),
): { key: string; resetsAt: number } {
  if (type === "extract") {
    return { key: scansWindowKey(now), resetsAt: nextMidnightUTC(now) }
  }
  return { key: aiWindowKey(now), resetsAt: nextMonthStartUTC(now) }
}

function rateLimitKey(bucket: RateLimitBucket, userId: string, type: LimitType, windowKey: string): string {
  return bucket === "api-key" ? `rl:apikey:${userId}:${type}:${windowKey}` : `rl:${userId}:${type}:${windowKey}`
}

async function getRateLimitDatabase() {
  const { getDatabase } = await import("./database.ts")
  return getDatabase()
}

export async function checkRateLimit(
  userId: string,
  tier: RateLimitTier,
  type: LimitType,
  bucket: RateLimitBucket = "user",
  amount = 1,
  idempotencyKey?: string,
): Promise<RateLimitResult> {
  const config = RATE_LIMITS[tier][type]
  const limit = config.max
  const { key: windowKey, resetsAt } = getRateLimitWindow(type)
  const kvKey = rateLimitKey(bucket, userId, type, windowKey)
  const database = await getRateLimitDatabase()
  const { data, error } = await database.rpc("reserve_usage_slots", {
    p_bucket_key: kvKey,
    p_limit: limit,
    p_window_end: new Date(resetsAt).toISOString(),
    p_amount: amount,
    p_idempotency_key: idempotencyKey ?? null,
  })
  if (error) throw new Error(`Rate-limit storage failed: ${error.message}`)
  const row = Array.isArray(data) ? data[0] : data
  if (!row || typeof row.current_count !== "number" || typeof row.allowed !== "boolean") {
    throw new Error("Rate-limit storage returned an invalid result")
  }
  return {
    allowed: row.allowed,
    remaining: Math.max(0, limit - row.current_count),
    limit,
    resetsAt,
    windowEnd: resetsAt,
    reservationId: typeof row.reservation_id === "string" ? row.reservation_id : undefined,
    replay: row.is_replay === true,
  }
}

export async function settleRateLimit(
  reservationId: string | undefined,
  commit: boolean,
): Promise<number | null> {
  if (!reservationId) return null
  const database = await getRateLimitDatabase()
  const { data, error } = await database.rpc("settle_usage_reservation", {
    p_reservation_id: reservationId,
    p_commit: commit,
  })
  if (error) throw new Error(`Rate-limit settlement failed: ${error.message}`)
  if (typeof data !== "number") throw new Error("Rate-limit settlement returned an invalid result")
  return data
}

export async function refundRateLimit(
  userId: string,
  type: LimitType,
  amount: number,
  bucket: RateLimitBucket = "user",
): Promise<number> {
  const { key: windowKey } = getRateLimitWindow(type)
  const bucketKey = rateLimitKey(bucket, userId, type, windowKey)
  const database = await getRateLimitDatabase()
  const { data, error } = await database.rpc("refund_api_rate_limit_slots", {
    p_bucket_key: bucketKey,
    p_amount: amount,
  })
  if (error) throw new Error(`Rate-limit refund failed: ${error.message}`)
  if (typeof data !== "number") throw new Error("Rate-limit refund returned an invalid result")
  return data
}

export async function getRateLimitStatus(
  userId: string,
  tier: RateLimitTier,
  type: LimitType,
  bucket: RateLimitBucket = "user",
): Promise<RateLimitResult> {
  const config = RATE_LIMITS[tier][type]
  const limit = config.max
  const { key: windowKey, resetsAt } = getRateLimitWindow(type)
  const kvKey = rateLimitKey(bucket, userId, type, windowKey)
  const database = await getRateLimitDatabase()
  const { data, error } = await database.rpc("get_api_rate_limit_status", {
    p_bucket_key: kvKey,
  })
  if (error) throw new Error(`Rate-limit storage failed: ${error.message}`)
  const row = Array.isArray(data) ? data[0] : data
  const current = row?.current_count
  if (typeof current !== "number") {
    throw new Error("Rate-limit storage returned an invalid result")
  }

  return {
    allowed: current < limit,
    remaining: Math.max(0, limit - current),
    limit,
    resetsAt,
    windowEnd: resetsAt,
  }
}
