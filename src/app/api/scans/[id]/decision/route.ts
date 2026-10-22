import { NextResponse } from "next/server"

import { isScanDecision } from "@/lib/decisions"
import { updateScanDecision } from "@/lib/persistence"
import { resolveRequestAuth } from "@/lib/request-auth"
import { recordUsageEvent } from "@/lib/usage-accounting"
import { parseThemysClientHeader } from "@/lib/themys-client"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await resolveRequestAuth(request, { allowApiKey: false })
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: "Missing scan id" }, { status: 400 })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const decision =
      body && typeof body === "object" && !Array.isArray(body)
        ? (body as { decision?: unknown }).decision
        : undefined

    if (!isScanDecision(decision)) {
      return NextResponse.json({ error: "Invalid decision" }, { status: 400 })
    }

    const updated = await updateScanDecision(id, auth.identity.clerkId, decision)
    if (!updated) {
      return NextResponse.json({ error: "Scan not found" }, { status: 404 })
    }

    const client = parseThemysClientHeader(request.headers.get("x-themys-client"))

    await recordUsageEvent({
      actor: auth.identity.clerkId,
      client,
      operation: "decision_set",
      outcome: "set",
      metadata: { decision },
    }).catch(() => undefined)

    return NextResponse.json({ ok: true, decision })
  } catch (err) {
    console.error("[scans] Decision update failed", err instanceof Error ? err.name : "UnknownError")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
