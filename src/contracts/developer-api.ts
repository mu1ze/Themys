/** Stable, dependency-free contract for API-key consumers. */
export const DEVELOPER_API_VERSION = "2026-09-20" as const
export const DEVELOPER_API_MEDIA_TYPE = "application/vnd.themys.v1+json" as const

export type DeveloperApiSuccess<T> = {
  schemaVersion: typeof DEVELOPER_API_VERSION
  requestId: string
  ok: true
  data: T
}

export type DeveloperApiError = {
  schemaVersion: typeof DEVELOPER_API_VERSION
  requestId: string
  ok: false
  error: {
    code: string
    message: string
    status: number
    details?: Record<string, unknown>
  }
}

export type DeveloperAnalysisPolicy = {
  mode: "standard" | "strict_targets_only"
  targetClauses: string[]
  playbookId: string
  jurisdiction: {
    country: string | null
    state: string | null
  }
  complianceEvidence: "source_grounded"
  notice: "informational_not_legal_advice"
}

export function isDeveloperApiRequest(request: Request): boolean {
  return /^Bearer\s+tmys_/i.test(request.headers.get("authorization")?.trim() ?? "")
}

export function developerErrorCode(status: number, message: string): string {
  const normalized = message.toLowerCase()
  if (status === 401) return "authentication_required"
  if (status === 403 && normalized.includes("scope")) return "insufficient_scope"
  if (status === 403) return "forbidden"
  if (status === 402) return "upgrade_required"
  if (status === 413) return "payload_too_large"
  if (status === 422) return "unprocessable_document"
  if (status === 429) return "rate_limit_exceeded"
  if (status === 502) return "upstream_unavailable"
  if (status >= 500) return "internal_error"
  return "invalid_request"
}

export function developerSuccess<T>(requestId: string, data: T): DeveloperApiSuccess<T> {
  return { schemaVersion: DEVELOPER_API_VERSION, requestId, ok: true, data }
}

export function developerFailure(
  requestId: string,
  status: number,
  message: string,
  details?: Record<string, unknown>,
): DeveloperApiError {
  return {
    schemaVersion: DEVELOPER_API_VERSION,
    requestId,
    ok: false,
    error: {
      code: developerErrorCode(status, message),
      message,
      status,
      ...(details && Object.keys(details).length > 0 ? { details } : {}),
    },
  }
}

export function developerItemFailure(index: number, status: number, message: string) {
  return {
    ok: false as const,
    index,
    error: {
      code: developerErrorCode(status, message),
      message,
      status,
    },
  }
}

export function developerAnalysisPolicy(profile: {
  targetClauses?: string[] | null
  strictMode?: boolean | null
  playbookId?: string | null
  country?: string | null
  state?: string | null
} | null): DeveloperAnalysisPolicy {
  const targetClauses = profile?.targetClauses ?? []
  return {
    mode: profile?.strictMode && targetClauses.length > 0 ? "strict_targets_only" : "standard",
    targetClauses,
    playbookId: profile?.playbookId ?? "consumer_app",
    jurisdiction: {
      country: profile?.country ?? null,
      state: profile?.state ?? null,
    },
    complianceEvidence: "source_grounded",
    notice: "informational_not_legal_advice",
  }
}
