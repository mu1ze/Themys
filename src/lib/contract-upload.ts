import type { Plan } from "./entitlements.ts"
import { getPlanEntitlements } from "./entitlements.ts"

export type ScanSource = "web" | "paste" | "extension" | "upload"

export function shouldUsePublicScanCache(source: ScanSource): boolean {
  return source === "web"
}

export function assertContractUploadAllowed(
  plan: Plan,
  used: number,
): { ok: true } | { ok: false; code: "upgrade_founder" } {
  const { contractUploads } = getPlanEntitlements(plan)
  if (contractUploads < 0) return { ok: true }
  if (contractUploads === 0) return { ok: false, code: "upgrade_founder" }
  return used < contractUploads ? { ok: true } : { ok: false, code: "upgrade_founder" }
}
