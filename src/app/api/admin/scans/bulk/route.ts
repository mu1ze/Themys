import { NextResponse } from "next/server"
import { currentUser } from "@clerk/nextjs/server"
import { isAdmin } from "@/lib/admin"
import { isJsonRecord } from "@/lib/json-value"
import { deleteScanAdmin } from "@/features/admin/server/queries"

export async function POST(request: Request) {
  const user = await currentUser()
  if (!user?.id || !isAdmin(user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let ids: unknown
  try {
    const body: unknown = await request.json()
    ids = isJsonRecord(body) ? body.ids : undefined
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "Missing ids" }, { status: 400 })
  }

  let deleted = 0
  let failed = 0

  for (const scanId of ids) {
    if (typeof scanId !== "string") {
      failed++
      continue
    }
    try {
      const ok = await deleteScanAdmin(scanId)
      if (ok) {
        deleted++
      } else {
        failed++
      }
    } catch {
      failed++
    }
  }

  if (deleted === 0 && failed > 0) {
    return NextResponse.json(
      { error: "No scans could be deleted" },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, deleted, failed })
}
