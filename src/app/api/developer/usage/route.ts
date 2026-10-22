import { NextResponse } from "next/server"
import { currentUser } from "@clerk/nextjs/server"

import { getApiUsageStats } from "@/lib/api-keys"

export async function GET(request: Request) {
  try {
    const user = await currentUser()
    const clerkId = user?.id

    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const daysParam = searchParams.get("days")
    const days = daysParam ? Math.min(Math.max(parseInt(daysParam, 10) || 30, 1), 90) : 30

    const stats = await getApiUsageStats(clerkId, days)
    return NextResponse.json({ stats })
  } catch (err) {
    console.error("[developer/usage GET] Error", err instanceof Error ? err.name : "UnknownError")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
