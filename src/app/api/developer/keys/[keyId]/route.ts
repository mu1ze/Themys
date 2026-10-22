import { NextResponse } from "next/server"
import { currentUser } from "@clerk/nextjs/server"

import { revokeApiKey } from "@/lib/api-keys"

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ keyId: string }> }
) {
  try {
    const user = await currentUser()
    const clerkId = user?.id

    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { keyId } = await params
    await revokeApiKey(clerkId, keyId)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[developer/keys DELETE] Error", err instanceof Error ? err.name : "UnknownError")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
