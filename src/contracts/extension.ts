/**
 * Stable request/response boundary for the Manifest V3 extension.
 * Keep this dependency-free: the extension is intentionally plain JavaScript
 * and is released separately from the Next.js application.
 */
export const EXTENSION_API_VERSION = "2026-07-15" as const
export const THEMYS_SAFARI_IOS_CLIENT = "safari-ios" as const

export type ExtensionAnalyzeRequest = {
  text?: string
  url?: string
  sourceUrl?: string
  domain?: string
  bypassCache?: boolean
}

export type ExtensionExtractRequest = { url: string }
export type ExtensionHistoryRequest = { limit?: number }
export type ExtensionProfileUpdateRequest = {
  country?: string
  state?: string
  targetClauses?: string[]
  strictMode?: boolean
  playbookId?: string
}
export type ExtensionMonitorSubscribeRequest = {
  url: string
  title?: string
  frequency?: "daily" | "weekly" | "monthly"
}
export type ExtensionMonitorUnsubscribeRequest = { subscriptionId: string }
export type ExtensionErrorResponse = { error: string; requiredScope?: string }

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

export function parseExtensionHistoryRequest(value: unknown): ExtensionHistoryRequest {
  if (!isRecord(value) || typeof value.limit !== "number") return {}
  return { limit: value.limit }
}

export function parseExtensionExtractRequest(value: unknown): ExtensionExtractRequest | null {
  if (!isRecord(value) || typeof value.url !== "string") return null
  return { url: value.url }
}

export function parseExtensionMonitorSubscribeRequest(
  value: unknown,
): ExtensionMonitorSubscribeRequest | null {
  if (!isRecord(value) || typeof value.url !== "string") return null
  const frequency = value.frequency
  return {
    url: value.url,
    ...(typeof value.title === "string" ? { title: value.title } : {}),
    ...(frequency === "daily" || frequency === "weekly" || frequency === "monthly" ? { frequency } : {}),
  }
}

export function parseExtensionMonitorUnsubscribeRequest(
  value: unknown,
): ExtensionMonitorUnsubscribeRequest | null {
  if (!isRecord(value) || typeof value.subscriptionId !== "string") return null
  return { subscriptionId: value.subscriptionId }
}

export function parseExtensionProfileUpdateRequest(value: unknown): ExtensionProfileUpdateRequest {
  if (!isRecord(value)) return {}
  return {
    ...(typeof value.country === "string" ? { country: value.country } : {}),
    ...(typeof value.state === "string" ? { state: value.state } : {}),
    ...(Array.isArray(value.targetClauses) ? { targetClauses: value.targetClauses.filter((item): item is string => typeof item === "string") } : {}),
    ...(typeof value.strictMode === "boolean" ? { strictMode: value.strictMode } : {}),
    ...(typeof value.playbookId === "string" ? { playbookId: value.playbookId } : {}),
  }
}
