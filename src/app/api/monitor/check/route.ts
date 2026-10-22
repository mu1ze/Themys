import { NextResponse } from "next/server"

import { verifyCronAuthorization } from "@/lib/cron-auth"
import { runMonitoringJob } from "@/features/monitoring/server/job"
import { getRuntimeEnvironment } from "@/lib/runtime-env"

// ── POST: Run monitoring check (cron) ───────────────────────────────────────

export async function POST(request: Request) {
  try {
    // Auth: verify CRON_SECRET
    const cronSecret = getRuntimeEnvironment().CRON_SECRET
    const cronAuthorization = verifyCronAuthorization(request, cronSecret)
    if (cronAuthorization === "misconfigured") {
      return NextResponse.json(
        { error: "CRON_SECRET not configured" },
        { status: 500 },
      )
    }

    if (cronAuthorization === "unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    return NextResponse.json(await runMonitoringJob())
  } catch (err) {
    console.error("[monitor/check] Cron failed", err instanceof Error ? err.name : "UnknownError")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
