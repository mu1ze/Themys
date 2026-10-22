import { NextResponse } from "next/server"
import { currentUser } from "@clerk/nextjs/server"

import {
  listApiKeys,
  getApiKeyRateStatus,
} from "@/lib/api-keys"
import { getUserProfileByClerkId } from "@/lib/persistence"

export async function GET() {
  try {
    const user = await currentUser()
    const clerkId = user?.id
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const [profile, keys] = await Promise.all([
      getUserProfileByClerkId(clerkId),
      listApiKeys(clerkId),
    ])
    if (!profile) return NextResponse.json({ error: "User not found" }, { status: 404 })
    const tier = profile.plan

    const perKey = await Promise.all(
      keys.map(async (key) => {
        const rate = await getApiKeyRateStatus(clerkId, tier, key.id)
        return {
          keyId: key.id,
          keyPrefix: key.keyPrefix,
          name: key.name,
          scopes: key.scopes,
          status: { scans: rate.scans, ai: rate.ai },
        }
      })
    )

    return NextResponse.json({
      keys: perKey,
      tier,
    })
  } catch (err) {
    console.error("[developer/usage/per-key GET] Error:", err instanceof Error ? err.name : "UnknownError")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
