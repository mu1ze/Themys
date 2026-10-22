import { NextResponse } from "next/server"

import { getCreditBalanceByClerkId, getUserProfileByClerkId } from "@/lib/persistence"
import { getRateLimitStatus } from "@/lib/rate-limit"
import { resolveRequestAuth } from "@/lib/request-auth"
import { extensionJson } from "@/features/extension-api/server/response"

/**
 * Read-only usage snapshot. Expensive operations reserve their own quota.
 * Clients include web, extension, and safari-ios (`X-Themys-Client`).
 */
export async function POST(request: Request) {
  try {
    const auth = await resolveRequestAuth(request, { allowApiKey: false })
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const clerkId = auth.identity.clerkId
    const profile = await getUserProfileByClerkId(clerkId)
    const tier = profile?.plan ?? "free"
    const [scans, ai, creditBalance] = await Promise.all([
      getRateLimitStatus(clerkId, tier, "scans"),
      getRateLimitStatus(clerkId, tier, "ai"),
      getCreditBalanceByClerkId(clerkId),
    ])

    return extensionJson({
      ok: scans.allowed || creditBalance > 0,
      creditConsumed: false,
      upgradeRequired: !scans.allowed && creditBalance <= 0,
      usage: { tier, scans, ai, creditBalance },
    }, { status: !scans.allowed && creditBalance <= 0 ? 402 : 200 })
  } catch (error) {
    console.error("[limit-check] Error", error instanceof Error ? error.name : "UnknownError")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
