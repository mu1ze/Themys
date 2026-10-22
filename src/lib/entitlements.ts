/**
 * The single product entitlement contract.
 *
 * Keep this module dependency-free: it is imported by server routes, client
 * pricing UI, tests, and documentation tooling. A plan value stored in the
 * database is normalized through getPlanEntitlements before use.
 */
export type Plan = "free" | "base" | "advanced" | "lifetime"
export type PlanDisplayName = "Free" | "Personal" | "Founder" | "Lifetime"

export const CREDIT_EXPIRY_MONTHS = 12

export const PLAN_DISPLAY_NAME: Record<Plan, PlanDisplayName> = {
  free: "Free",
  base: "Personal",
  advanced: "Founder",
  lifetime: "Lifetime",
}

export const PLAN_ENTITLEMENTS = {
  free: {
    monthlyReviews: 15,
    monthlyAiExplanations: 15,
    dailyExtracts: 30,
    monitorLimit: 1,
    emailAlerts: false,
    exportReports: false,
    contractUploads: 1, // lifetime trial; 0 = none; -1 = unlimited
    historyLimit: 10,
  },
  base: {
    monthlyReviews: 30,
    monthlyAiExplanations: 30,
    dailyExtracts: 150,
    monitorLimit: 10,
    emailAlerts: true,
    exportReports: true,
    contractUploads: 0,
    historyLimit: null,
  },
  advanced: {
    monthlyReviews: 50,
    monthlyAiExplanations: 50,
    dailyExtracts: 600,
    monitorLimit: 25,
    emailAlerts: true,
    exportReports: true,
    contractUploads: -1,
    historyLimit: null,
  },
  lifetime: {
    monthlyReviews: 50,
    monthlyAiExplanations: 50,
    dailyExtracts: 600,
    monitorLimit: 25,
    emailAlerts: true,
    exportReports: true,
    contractUploads: -1,
    historyLimit: null,
  },
} as const satisfies Record<Plan, {
  monthlyReviews: number
  monthlyAiExplanations: number
  dailyExtracts: number
  monitorLimit: number
  emailAlerts: boolean
  exportReports: boolean
  contractUploads: number
  historyLimit: number | null
}>

export function getPlanEntitlements(plan: string | null | undefined) {
  return PLAN_ENTITLEMENTS[plan as Plan] ?? PLAN_ENTITLEMENTS.free
}

export function isPlan(value: string | null | undefined): value is Plan {
  return value === "free" || value === "base" || value === "advanced" || value === "lifetime"
}

export function isUnlimitedContractUpload(plan: Plan): boolean {
  return getPlanEntitlements(plan).contractUploads < 0
}

export function planDisplayName(plan: string): string {
  return isPlan(plan) ? PLAN_DISPLAY_NAME[plan] : PLAN_DISPLAY_NAME.free
}
