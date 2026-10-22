import { NextResponse } from "next/server"
import { currentUser } from "@clerk/nextjs/server"
import { isAdmin } from "@/lib/admin"
import { deleteScanAdmin } from "@/features/admin/server/queries"

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ scanId: string }> }
) {
  const user = await currentUser()
  if (!user?.id || !isAdmin(user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { scanId } = await params

  try {
    const deleted = await deleteScanAdmin(scanId)
    if (!deleted) {
      return NextResponse.json({ error: "Scan not found" }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[admin] Scan deletion failed", err instanceof Error ? err.name : "UnknownError")
    return NextResponse.json({ error: "Failed to delete scan" }, { status: 500 })
  }
}
