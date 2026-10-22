import { NextResponse } from "next/server"

import { getFullExtractionByClerkId } from "@/lib/persistence"
import { resolveRequestAuth } from "@/lib/request-auth"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await resolveRequestAuth(request, { allowApiKey: false })
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  if (!id) return NextResponse.json({ error: "Missing scan id" }, { status: 400 })

  try {
    const fullExtraction = await getFullExtractionByClerkId(auth.identity.clerkId, id)
    if (fullExtraction === null) {
      return NextResponse.json({ error: "Scan not found" }, { status: 404 })
    }
    return NextResponse.json({ fullExtraction })
  } catch (error) {
    console.error(
      "[scan-extraction] Request failed",
      error instanceof Error ? error.name : "UnknownError",
    )
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
