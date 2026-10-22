export function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function getStringProperty(value: unknown, key: string): string | undefined {
  if (!isJsonRecord(value)) return undefined
  const property = value[key]
  return typeof property === "string" ? property : undefined
}

export function getErrorMessage(value: unknown, fallback: string): string {
  return getStringProperty(value, "error") ?? fallback
}
