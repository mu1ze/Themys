export const SCAN_DECISIONS = ["open", "sign", "negotiate", "walk_away"] as const
export type ScanDecision = (typeof SCAN_DECISIONS)[number]

export const SCAN_DECISION_LABELS: Record<ScanDecision, string> = {
  open: "Open",
  sign: "Sign",
  negotiate: "Negotiate",
  walk_away: "Walk away",
}

export function formatScanDecisionLabel(decision: ScanDecision): string {
  return SCAN_DECISION_LABELS[decision]
}

export function isScanDecision(value: unknown): value is ScanDecision {
  return typeof value === "string" && (SCAN_DECISIONS as readonly string[]).includes(value)
}
