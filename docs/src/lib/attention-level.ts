export function getAttentionLevel(score: number | null | undefined) {
  const value = score ?? 0
  if (value >= 7) return { label: "Needs attention" }
  if (value >= 4) return { label: "Worth reviewing" }
  return { label: "Standard" }
}
