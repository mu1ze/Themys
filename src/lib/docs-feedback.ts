export const DOCS_FEEDBACK_MAX_BODY_BYTES = 4_096
export const DOCS_FEEDBACK_MAX_COMMENT_LENGTH = 1_000
export const DOCS_FEEDBACK_CHALLENGE_AFTER = 3
export const DOCS_FEEDBACK_MAX_PER_HOUR = 10
export const DOCS_FEEDBACK_WINDOW_SECONDS = 60 * 60

export const KNOWN_DOC_SLUGS = new Set([
  "account",
  "api-analyze",
  "api-batch",
  "api-extract",
  "api-keys",
  "api-overview",
  "changelog",
  "extraction",
  "faq",
  "installation",
  "quick-start",
  "risk-scoring",
  "understanding-results",
])

export type DocsFeedbackInput = {
  slug: string
  helpful: boolean
  comment: string | null
  deviceId: string | null
  turnstileToken: string | null
}

export class DocsFeedbackValidationError extends Error {}

export function parseDocsFeedback(value: unknown): DocsFeedbackInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new DocsFeedbackValidationError("Request body must be an object")
  }

  const record = value as Record<string, unknown>
  const allowed = new Set(["slug", "helpful", "comment", "deviceId", "turnstileToken"])
  if (Object.keys(record).some((key) => !allowed.has(key))) {
    throw new DocsFeedbackValidationError("Unexpected field")
  }
  if (typeof record.slug !== "string" || !KNOWN_DOC_SLUGS.has(record.slug)) {
    throw new DocsFeedbackValidationError("Unknown documentation page")
  }
  if (typeof record.helpful !== "boolean") {
    throw new DocsFeedbackValidationError("helpful must be a boolean")
  }
  if (record.comment !== undefined && record.comment !== null && typeof record.comment !== "string") {
    throw new DocsFeedbackValidationError("comment must be a string or null")
  }

  const comment = typeof record.comment === "string" ? record.comment.trim() : null
  if (comment && comment.length > DOCS_FEEDBACK_MAX_COMMENT_LENGTH) {
    throw new DocsFeedbackValidationError(
      `comment must be ${DOCS_FEEDBACK_MAX_COMMENT_LENGTH} characters or fewer`,
    )
  }

  const deviceId = typeof record.deviceId === "string" && /^[a-zA-Z0-9_-]{16,80}$/.test(record.deviceId)
    ? record.deviceId
    : null
  const turnstileToken = typeof record.turnstileToken === "string" && record.turnstileToken.length <= 2_048
    ? record.turnstileToken
    : null

  return {
    slug: record.slug,
    helpful: record.helpful,
    comment: comment || null,
    deviceId,
    turnstileToken,
  }
}

export type FeedbackGate = "allow" | "challenge" | "rate_limited"

export function getFeedbackGate(currentCount: number, challengeConfigured: boolean): FeedbackGate {
  if (currentCount >= DOCS_FEEDBACK_MAX_PER_HOUR) return "rate_limited"
  if (challengeConfigured && currentCount >= DOCS_FEEDBACK_CHALLENGE_AFTER) return "challenge"
  return "allow"
}
