import { NextResponse } from "next/server"
import { currentUser } from "@clerk/nextjs/server"

import { isAdmin } from "@/lib/admin"
import { getDatabase } from "@/lib/database"
import { maybeSeedCachedScansForUser } from "@/lib/restore-cached-scans"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const user = await currentUser()
  if (!user?.id || !isAdmin(user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { userId } = await params
  const { data, error } = await getDatabase()
    .from("users")
    .select("clerk_id")
    .eq("id", userId)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: "Failed to load user" }, { status: 500 })
  }
  if (!data?.clerk_id || typeof data.clerk_id !== "string") {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  const summary = await maybeSeedCachedScansForUser(data.clerk_id, { limit: 25 })
  return NextResponse.json({ ok: true, ...summary })
}
