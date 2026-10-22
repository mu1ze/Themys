import { NextResponse } from "next/server"
import { currentUser } from "@clerk/nextjs/server"
import { isAdmin } from "@/lib/admin"
import { readRequestText, RequestBodyTooLargeError } from "@/lib/request-body"
import { updateUserPlan } from "@/features/admin/server/queries"

const MAX_REQUEST_BYTES = 64 * 1024

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const user = await currentUser()
  if (!user?.id || !isAdmin(user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { userId } = await params
  let rawBody: string
  try {
    rawBody = await readRequestText(request, MAX_REQUEST_BYTES)
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: "Request body is too large" }, { status: 413 })
    }
    throw error
  }
  let body: { plan?: unknown } = {}
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 })
  }
  const plan = body?.plan
  const VALID_PLANS = ["free", "base", "advanced", "lifetime"] as const
  type ValidPlan = (typeof VALID_PLANS)[number]

  if (typeof plan !== "string" || !(VALID_PLANS as readonly string[]).includes(plan)) {
    return NextResponse.json(
      { error: "Invalid plan. Must be free, base, advanced, or lifetime." },
      { status: 400 }
    )
  }

  try {
    await updateUserPlan(userId, plan as ValidPlan)
    return NextResponse.json({ ok: true, plan })
  } catch (err) {
    console.error("[admin] Plan update failed", err instanceof Error ? err.name : "UnknownError")
    return NextResponse.json({ error: "Failed to update plan" }, { status: 500 })
  }
}
