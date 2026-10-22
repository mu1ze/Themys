import { createHash } from "node:crypto"
import type { DocumentType } from "@/lib/document-types"

export type { DocumentType } from "@/lib/document-types"
export type DocumentConfidence = "high" | "medium" | "low"

export type DocumentClassification = {
  type: DocumentType
  confidence: number
  confidenceLevel: DocumentConfidence
  classifierVersion: "rules_v1"
  evidence: string[]
  needsReview: boolean
}

export type DocumentIdentity = DocumentClassification & {
  identityKey: string | null
  canonicalUrl: string | null
}

type ClassificationInput = {
  text: string
  url?: string | null
  title?: string | null
}

type ScoredType = {
  score: number
  evidence: string[]
  hasPrimaryEvidence: boolean
}

const LABELS: Record<Exclude<DocumentType, "other" | "unknown">, string[]> = {
  terms_of_service: ["terms of service", "service terms"],
  terms_of_use: ["terms of use", "use terms"],
  terms_and_conditions: ["terms and conditions", "terms & conditions"],
  privacy_policy: [
    "privacy policy",
    "privacy statement",
    "privacy notice",
    "data privacy notice",
    "data privacy",
  ],
  acceptable_use_policy: ["acceptable use policy", "acceptable use terms"],
  cookie_policy: ["cookie policy", "cookies policy", "cookie notice"],
  eula: ["end user license agreement", "end-user license agreement", "eula"],
}

const CLASSIFIABLE_TYPES = Object.keys(LABELS) as Array<keyof typeof LABELS>
const HIGH_CONFIDENCE_THRESHOLD = 0.85

function clean(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function addScore(
  scores: Record<keyof typeof LABELS, ScoredType>,
  type: keyof typeof LABELS,
  score: number,
  evidence: string,
  primary = false,
): void {
  scores[type].score += score
  scores[type].evidence.push(evidence)
  scores[type].hasPrimaryEvidence ||= primary
}

function normalizedUrl(value: string | null | undefined): string | null {
  if (!value) return null

  try {
    const url = new URL(value)
    url.hash = ""
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "")

    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid$|gclid$|ref$|source$)/i.test(key)) {
        url.searchParams.delete(key)
      }
    }
    url.searchParams.sort()

    url.pathname = url.pathname.replace(/\/{2,}/g, "/")
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/$/, "")

    return url.href
  } catch {
    return null
  }
}

function confidenceFor(score: number, margin: number, primary: boolean): number {
  if (primary && score >= 15 && margin >= 5) return 0.98
  if (primary && score >= 10 && margin >= 4) return 0.94
  if (score >= 10 && margin >= 4) return 0.9
  if (score >= 8 && margin >= 3) return 0.86
  if (score >= 6 && margin >= 2) return 0.76
  return 0.55
}

export function classifyDocument(input: ClassificationInput): DocumentClassification {
  const text = clean(input.text)
  const opening = text.slice(0, 4_000)
  const firstBlock = text.slice(0, 1_200)
  const title = clean(input.title)
  const canonicalUrl = normalizedUrl(input.url)
  const urlPath = canonicalUrl ? clean(new URL(canonicalUrl).pathname.replace(/[-_]+/g, " ")) : ""
  const scores = Object.fromEntries(
    CLASSIFIABLE_TYPES.map((type) => [type, { score: 0, evidence: [], hasPrimaryEvidence: false }]),
  ) as unknown as Record<keyof typeof LABELS, ScoredType>

  for (const type of CLASSIFIABLE_TYPES) {
    for (const label of LABELS[type]) {
      const escaped = escapeRegex(label)
      const exactHeading = new RegExp(`(?:^|\\n)\\s*(?:the\\s+)?${escaped}\\s*(?:$|\\n|[|:\\-])`, "i")
      const selfReference = new RegExp(
        `\\b(?:these|this|our)\\s+(?:the\\s+)?${escaped}\\b|\\b${escaped}\\s+(?:govern|apply|describe|explain|set out|constitute)\\b`,
        "i",
      )

      if (exactHeading.test(input.text.slice(0, 4_000))) {
        addScore(scores, type, 10, `opening heading: ${label}`, true)
        break
      }
      if (selfReference.test(firstBlock)) {
        addScore(scores, type, 9, `opening self-identification: ${label}`, true)
        break
      }
      if (firstBlock.includes(label)) {
        addScore(scores, type, 6, `opening label: ${label}`, true)
        break
      }
      if (opening.includes(label)) {
        addScore(scores, type, 2, `early mention: ${label}`)
        break
      }
    }

    if (LABELS[type].some((label) => title.includes(label))) {
      addScore(scores, type, 8, "page title", true)
    }
    if (LABELS[type].some((label) => urlPath.includes(label))) {
      addScore(scores, type, 6, "URL path", true)
    }
  }

  const privacySignals = [
    "personal information",
    "personal data",
    "data controller",
    "data protection officer",
    "information we collect",
    "how we use your information",
    "privacy rights",
  ].filter((signal) => opening.includes(signal)).length
  if (privacySignals >= 2) {
    addScore(scores, "privacy_policy", Math.min(4, privacySignals), `${privacySignals} privacy-content signals`)
  }

  const termsSignals = [
    "binding arbitration",
    "governing law",
    "limitation of liability",
    "disclaimer of warranties",
    "terminate your account",
    "use of the service",
  ].filter((signal) => opening.includes(signal)).length
  if (termsSignals >= 2) {
    for (const type of ["terms_of_service", "terms_of_use", "terms_and_conditions"] as const) {
      addScore(scores, type, Math.min(2, termsSignals), `${termsSignals} general-terms signals`)
    }
  }

  const ranked = CLASSIFIABLE_TYPES
    .map((type) => ({ type, ...scores[type] }))
    .sort((a, b) => b.score - a.score)
  const best = ranked[0]
  const runnerUp = ranked[1]
  const margin = best.score - runnerUp.score
  const confidence = confidenceFor(best.score, margin, best.hasPrimaryEvidence)

  if (best.score < 6 || confidence < 0.7 || margin < 2) {
    return {
      type: "unknown",
      confidence: Math.min(confidence, 0.69),
      confidenceLevel: "low",
      classifierVersion: "rules_v1",
      evidence: best.evidence.slice(0, 4),
      needsReview: true,
    }
  }

  return {
    type: best.type,
    confidence,
    confidenceLevel: confidence >= HIGH_CONFIDENCE_THRESHOLD ? "high" : "medium",
    classifierVersion: "rules_v1",
    evidence: best.evidence.slice(0, 4),
    needsReview: confidence < HIGH_CONFIDENCE_THRESHOLD,
  }
}

export function identifyDocument(input: ClassificationInput): DocumentIdentity {
  const classification = classifyDocument(input)
  const canonicalUrl = normalizedUrl(input.url)
  const identityKey = canonicalUrl && classification.type !== "unknown"
    ? createHash("sha256")
        .update(`${classification.type}\n${canonicalUrl}`)
        .digest("hex")
    : null

  return { ...classification, identityKey, canonicalUrl }
}
