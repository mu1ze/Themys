export function isSafeEmail(value: unknown): value is string {
  return typeof value === "string" && value.length <= 320 && /^[^\r\n\s@]+@[^\r\n\s@]+\.[^\r\n\s@]+$/.test(value)
}

export function safeHeader(value: unknown, maxLength = 300): string | null {
  if (typeof value !== "string") return null
  const sanitized = value.replace(/[\r\n]/g, " ").trim()
  return sanitized && sanitized.length <= maxLength ? sanitized : null
}
