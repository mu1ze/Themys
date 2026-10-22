/** Escape one spreadsheet cell and neutralize formula-like user input. */
export function escapeCsvCell(value: unknown): string {
  if (value == null) return ""

  const raw = String(value)
  const neutralized = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw
  if (!/[",\n\r]/.test(neutralized)) return neutralized

  return `"${neutralized.replace(/"/g, '""')}"`
}
