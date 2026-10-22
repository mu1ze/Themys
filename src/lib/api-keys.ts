import "server-only"

import { createHash, randomBytes } from "node:crypto"
import { getDatabase } from "./database"
import { getUserIdForClerkId } from "./persistence"
import { getRateLimitStatus as _getRateLimitStatus } from "./rate-limit"
import type { RateLimitResult, RateLimitTier } from "./rate-limit"

// ── Types ──────────────────────────────────────────────────────────────────

export type ApiKeyRecord = {
  id: string
  user_id: string
  name: string
  key_prefix: string
  key_hash: string
  scopes: string[]
  request_count: number
  last_used_at: string | null
  created_at: string
  is_active: boolean
}

export type ApiKeyListItem = {
  id: string
  name: string
  keyPrefix: string
  scopes: string[]
  requestCount: number
  lastUsedAt: string | null
  createdAt: string
}

export type ApiUsageStats = {
  totalRequests: number
  successCount: number
  errorCount: number
  successRate: number
  errorRate: number
  dailyRequests: { date: string; count: number }[]
  recentErrors: { date: string; statusCode: number; endpoint: string; message: string }[]
}

// ── Helpers ────────────────────────────────────────────────────────────────

function generateApiKey(): { raw: string; hash: string; prefix: string } {
  const bytes = randomBytes(32)
  const raw = `tmys_${bytes.toString("base64url")}`
  const hash = createHash("sha256").update(raw).digest("hex")
  const prefix = raw.slice(0, 12) // "tmys_" + first 7 chars
  return { raw, hash, prefix }
}

export const API_KEY_SCOPES = ["extract", "analyze"] as const

export class ApiKeyValidationError extends Error {}

function normalizeScopes(scopes?: unknown): string[] {
  if (scopes !== undefined && !Array.isArray(scopes)) {
    throw new ApiKeyValidationError("API key scopes must be an array")
  }
  if (Array.isArray(scopes) && scopes.some((scope) => typeof scope !== "string")) {
    throw new ApiKeyValidationError("API key scopes must contain only strings")
  }

  const requested = scopes?.length ? scopes : [...API_KEY_SCOPES]
  const normalized = [...new Set((requested as string[]).map((scope) => scope.trim().toLowerCase()))]
  const invalid = normalized.filter(
    (scope) => !API_KEY_SCOPES.includes(scope as (typeof API_KEY_SCOPES)[number]),
  )
  if (invalid.length > 0) {
    throw new ApiKeyValidationError(`Unsupported API key scope: ${invalid.join(", ")}`)
  }
  return normalized
}

// ── CRUD ───────────────────────────────────────────────────────────────────

export async function createApiKey(
  clerkId: string,
  name?: unknown,
  scopes?: unknown,
): Promise<{ rawKey: string; keyPrefix: string; id: string }> {
  const database = getDatabase()
  const userId = await getUserIdForClerkId(clerkId)
  if (!userId) throw new Error("Create your user profile before creating an API key")
  const { raw, hash, prefix } = generateApiKey()

  if (name !== undefined && typeof name !== "string") {
    throw new ApiKeyValidationError("API key name must be a string")
  }
  const keyName = name?.trim() || `API Key ${new Date().toLocaleDateString()}`
  if (keyName.length > 100) {
    throw new ApiKeyValidationError("API key name must be 100 characters or fewer")
  }
  const keyScopes = normalizeScopes(scopes)

  const { data, error } = await database
    .from("api_keys")
    .insert({
      user_id: userId,
      name: keyName,
      key_prefix: prefix,
      key_hash: hash,
      scopes: keyScopes,
      request_count: 0,
      is_active: true,
    })
    .select("id")
    .single()

  if (error) {
    throw new Error(`Failed to create API key: ${error.message}`)
  }
  if (!data) throw new Error("Failed to create API key: no row returned")

  return { rawKey: raw, keyPrefix: prefix, id: data.id }
}

export async function listApiKeys(clerkId: string): Promise<ApiKeyListItem[]> {
  const database = getDatabase()
  const userId = await getUserIdForClerkId(clerkId)
  if (!userId) return []

  const { data, error } = await database
    .from("api_keys")
    .select("id, name, key_prefix, scopes, request_count, last_used_at, created_at")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error(`Failed to list API keys: ${error.message}`)
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    keyPrefix: row.key_prefix,
    scopes: row.scopes ?? [],
    requestCount: row.request_count ?? 0,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
  }))
}

export async function revokeApiKey(clerkId: string, keyId: string): Promise<void> {
  const database = getDatabase()
  const userId = await getUserIdForClerkId(clerkId)
  if (!userId) return

  const { error } = await database
    .from("api_keys")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", keyId)
    .eq("user_id", userId)

  if (error) {
    throw new Error(`Failed to revoke API key: ${error.message}`)
  }
}

// ── Authentication ─────────────────────────────────────────────────────────

/**
 * Authenticated API key context returned by authenticateApiKey().
 */
export type AuthenticatedApiKey = {
  apiKeyId: string
  clerkId: string
  scopes: string[]
  keyPrefix: string
}

/**
 * Extract and authenticate a Bearer API key from a Request.
 *
 * Returns null if the Authorization header is missing, doesn't start with
 * "Bearer ", or doesn't match a non-revoked api_keys row.
 *
 * Usage is recorded separately once the handler knows the final status code.
 */
export async function authenticateApiKey(request: Request): Promise<AuthenticatedApiKey | null> {
  const authHeader = request.headers.get("authorization") ?? request.headers.get("Authorization")
  if (!authHeader) return null
  const match = /^Bearer\s+(.+)$/.exec(authHeader.trim())
  if (!match) return null
  const raw = match[1].trim()
  if (!raw.startsWith("tmys_")) return null

  const hash = createHash("sha256").update(raw).digest("hex")
  const database = getDatabase()

  const { data, error } = await database
    .from("api_keys")
    .select("id, user_id, scopes, key_prefix, users!inner(clerk_id)")
    .eq("key_hash", hash)
    .eq("is_active", true)
    .maybeSingle()

  if (error || !data) return null

  const scopes = Array.isArray(data.scopes) ? data.scopes : []
  const joinedUser = Array.isArray(data.users) ? data.users[0] : data.users
  const clerkId = (joinedUser as { clerk_id?: string } | null)?.clerk_id
  if (!clerkId) return null
  const result: AuthenticatedApiKey = {
    apiKeyId: data.id,
    clerkId,
    scopes,
    keyPrefix: data.key_prefix,
  }

  return result
}

export async function recordApiKeyUsage(
  auth: AuthenticatedApiKey,
  endpoint: string,
  statusCode: number,
  startedAt: number,
  message?: string,
): Promise<void> {
  const database = getDatabase()
  const { error } = await database.rpc("record_api_key_usage", {
    p_api_key_id: auth.apiKeyId,
    p_endpoint: endpoint,
    p_status_code: statusCode,
    p_response_time_ms: Math.max(0, Date.now() - startedAt),
    p_message: message?.slice(0, 500) ?? null,
  })
  if (error) throw new Error(`Failed to record API usage: ${error.message}`)
}

/**
 * Check whether an authenticated API key includes the given scope.
 * Clerk-session auth bypasses scope checks (treated as full user).
 */
export function hasScope(auth: { scopes?: string[] } | null | undefined, required: string): boolean {
  if (!auth) return false
  if (!auth.scopes) return false
  return auth.scopes.includes(required)
}

export class ApiKeyScopeError extends Error {
  constructor(public required: string) {
    super(`API key missing required scope: ${required}`)
    this.name = "ApiKeyScopeError"
  }
}

/**
 * Throw ApiKeyScopeError if the provided auth is missing the required scope.
 */
export function enforceScope(auth: { scopes?: string[] } | null | undefined, required: string): void {
  if (!hasScope(auth, required)) {
    throw new ApiKeyScopeError(required)
  }
}

// ── Per-key rate limit status ──────────────────────────────────────────────

export type ApiKeyRateStatus = {
  keyId: string
  keyPrefix: string
  scans: RateLimitResult
  ai: RateLimitResult
}

/**
 * Read-only views of per-key rate limit usage. The peephole read reflects
 * "what would happen if you tried now" rather than a historically accurate
 * snapshot — increment by calling analyzeTerms/extract directly through
 * the request lifecycle path.
 */
export async function getApiKeyRateStatus(
  clerkId: string,
  tier: RateLimitTier,
  keyId: string
): Promise<{ scans: RateLimitResult; ai: RateLimitResult }> {
  const [scans, ai] = await Promise.all([
    _getRateLimitStatus(`${clerkId}:${keyId}`, tier, "scans", "api-key"),
    _getRateLimitStatus(`${clerkId}:${keyId}`, tier, "ai", "api-key"),
  ])
  return { scans, ai }
}

export async function getApiUsageStats(
  clerkId: string,
  days: number = 30
): Promise<ApiUsageStats> {
  const database = getDatabase()
  const userId = await getUserIdForClerkId(clerkId)
  if (!userId) {
    throw new Error("User profile not found")
  }

  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceIso = since.toISOString()

  const { data: usageData, error: usageError } = await database
    .from("api_usage_logs")
    .select("status_code, created_at, endpoint, message")
    .eq("user_id", userId)
    .gte("created_at", sinceIso)

  if (usageError) throw new Error(`Failed to load API usage: ${usageError.message}`)

  const records = usageData ?? []
  const totalRequests = records.length
  const errorCount = records.filter((r) => r.status_code >= 400).length
  const successCount = totalRequests - errorCount
  const successRate = totalRequests > 0 ? (successCount / totalRequests) * 100 : 0
  const errorRate = totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0

  // Group by day
  const dailyMap = new Map<string, number>()
  for (let i = 0; i < days; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    dailyMap.set(d.toISOString().slice(0, 10), 0)
  }
  for (const r of records) {
    const day = r.created_at.slice(0, 10)
    dailyMap.set(day, (dailyMap.get(day) ?? 0) + 1)
  }
  const dailyRequests = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }))

  // Recent errors
  const recentErrors = records
    .filter((r) => r.status_code >= 400)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 10)
    .map((r) => ({
      date: r.created_at,
      statusCode: r.status_code,
      endpoint: r.endpoint ?? "unknown",
      message: r.message ?? "Error",
    }))

  return {
    totalRequests,
    successCount,
    errorCount,
    successRate: Math.round(successRate * 10) / 10,
    errorRate: Math.round(errorRate * 10) / 10,
    dailyRequests,
    recentErrors,
  }
}
