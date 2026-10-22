export type ChargingOutcome = "invalid" | "failed" | "cached_success" | "uncached_success"

export const CHARGING_MATRIX = {
  invalid: { scanSlots: 0, aiSlots: 0, refundCredits: true },
  failed: { scanSlots: 0, aiSlots: 0, refundCredits: true },
  cached_success: { scanSlots: 1, aiSlots: 0, refundCredits: false },
  uncached_success: { scanSlots: 1, aiSlots: 1, refundCredits: false },
} as const satisfies Record<ChargingOutcome, {
  scanSlots: number
  aiSlots: number
  refundCredits: boolean
}>

export function chargingPolicy(outcome: ChargingOutcome) {
  return CHARGING_MATRIX[outcome]
}
