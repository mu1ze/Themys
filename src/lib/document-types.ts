export const DOCUMENT_TYPES = [
  "terms_of_service",
  "terms_of_use",
  "terms_and_conditions",
  "privacy_policy",
  "acceptable_use_policy",
  "cookie_policy",
  "eula",
  "other",
  "unknown",
] as const

export type DocumentType = (typeof DOCUMENT_TYPES)[number]

export function documentTypeLabel(type: DocumentType): string {
  const labels: Record<DocumentType, string> = {
    terms_of_service: "Terms of Service",
    terms_of_use: "Terms of Use",
    terms_and_conditions: "Terms and Conditions",
    privacy_policy: "Privacy Policy",
    acceptable_use_policy: "Acceptable Use Policy",
    cookie_policy: "Cookie Policy",
    eula: "End-User License Agreement",
    other: "Other legal document",
    unknown: "Document type needs review",
  }
  return labels[type]
}
