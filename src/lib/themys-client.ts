export const THEMYS_CLIENT_HEADER = "x-themys-client"

export const THEMYS_PRODUCT_CLIENTS = ["web", "extension", "safari-ios"] as const

export type ThemysProductClient = (typeof THEMYS_PRODUCT_CLIENTS)[number]

export type ThemysUsageClient = ThemysProductClient | "api_key" | "cron"

/** Overlay capture clients share scan source `extension` — not a new product type. */
export function isOverlayCaptureClient(client: ThemysUsageClient): boolean {
  return client === "extension" || client === "safari-ios"
}

export function parseThemysClientHeader(value: string | null | undefined): ThemysProductClient {
  const normalized = value?.trim().toLowerCase()
  if (normalized === "extension") return "extension"
  if (normalized === "safari-ios") return "safari-ios"
  return "web"
}

export function themysClientFromRequest(request: Request, options?: { apiKey?: boolean }): ThemysUsageClient {
  if (options?.apiKey) return "api_key"
  return parseThemysClientHeader(request.headers.get(THEMYS_CLIENT_HEADER))
}
