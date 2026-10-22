import { NextResponse } from "next/server"
import { deleteScanByClerkId, getScanWithClauses } from "@/lib/persistence"
import { resolveRequestAuth } from "@/lib/request-auth"
import { getComplianceTagsForScan } from "@/lib/compliance"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: "Missing scan id" }, { status: 400 })
    }

    const auth = await resolveRequestAuth(request, { allowApiKey: false })
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const result = await getScanWithClauses(auth.identity.clerkId, id, true, true)
    if (!result) {
      return NextResponse.json({ error: "Scan not found" }, { status: 404 })
    }

    if (request.headers.get("x-themys-client") !== "extension") {
      return NextResponse.json(result)
    }

    const complianceTags = await getComplianceTagsForScan(
      id,
      result.clauses.map((clause) => clause.id),
    ).catch(() => [])
    return NextResponse.json({ ...result, complianceTags })
  } catch (err) {
    console.error("[scans] Read failed", err instanceof Error ? err.name : "UnknownError")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
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

    const deleted = await deleteScanByClerkId(auth.identity.clerkId, id)
    if (!deleted) {
      return NextResponse.json({ error: "Scan not found" }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[scans] Delete failed", err instanceof Error ? err.name : "UnknownError")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
