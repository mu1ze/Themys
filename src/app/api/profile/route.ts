import { currentUser } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

import { upsertUserProfile, getUserProfileByClerkId, updateUserTargetClauses } from "@/lib/persistence"
import { readRequestText, RequestBodyTooLargeError } from "@/lib/request-body"
import { parseExtensionProfileUpdateRequest } from "@/contracts/extension"
import { extensionJson } from "@/features/extension-api/server/response"
import { isPlaybookId, mergePlaybookTopics, type PlaybookId } from "@/lib/playbooks"
import { recordUsageEvent } from "@/lib/usage-accounting"
import { parseThemysClientHeader } from "@/lib/themys-client"

const MAX_REQUEST_BYTES = 64 * 1024

function normalizeInput(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function GET() {
  try {
    const user = await currentUser()
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const profile = await getUserProfileByClerkId(user.id)
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 })
    }

    return extensionJson({ profile })
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await currentUser()
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let rawBody: string
    try {
      rawBody = await readRequestText(request, MAX_REQUEST_BYTES)
    } catch (error) {
      if (error instanceof RequestBodyTooLargeError) {
        return NextResponse.json({ error: "Request body is too large" }, { status: 413 })
      }
      throw error
    }
    let parsedBody: unknown = {}
    try {
      parsedBody = JSON.parse(rawBody)
    } catch {
      parsedBody = {}
    }
    const body = parseExtensionProfileUpdateRequest(parsedBody)

    const email =
      user.primaryEmailAddress?.emailAddress ??
      user.emailAddresses[0]?.emailAddress ??
      "unknown@example.com"

    const profile = await upsertUserProfile(user.id, {
      email,
      ...(body.country !== undefined ? { country: normalizeInput(body.country) } : {}),
      ...(body.state !== undefined ? { state: normalizeInput(body.state) } : {}),
    })

    if (
      body.targetClauses !== undefined ||
      body.strictMode !== undefined ||
      body.playbookId !== undefined
    ) {
      const previousPlaybookId = profile.playbookId
      let playbookId: PlaybookId = profile.playbookId

      if (body.playbookId !== undefined) {
        if (!isPlaybookId(body.playbookId)) {
          return NextResponse.json({ error: "Invalid playbook" }, { status: 400 })
        }
        playbookId = body.playbookId
      }

      let targetClauses = body.targetClauses ?? profile.targetClauses

      if (
        body.playbookId !== undefined &&
        body.targetClauses === undefined &&
        body.playbookId !== previousPlaybookId
      ) {
        targetClauses = mergePlaybookTopics(playbookId, profile.targetClauses)
      }

      const strictMode =
        typeof body.strictMode === "boolean" ? body.strictMode : profile.strictMode

      await updateUserTargetClauses(user.id, targetClauses, strictMode, playbookId)
      profile.targetClauses = targetClauses
      profile.strictMode = strictMode
      profile.playbookId = playbookId

      if (body.playbookId !== undefined && playbookId !== previousPlaybookId) {
        await recordUsageEvent({
          actor: user.id,
          client: parseThemysClientHeader(request.headers.get("x-themys-client")),
          operation: "playbook_used",
          outcome: "select",
          metadata: { playbookId },
        }).catch(() => undefined)
      }
    }

    return extensionJson({ profile })
  } catch (err) {
    console.error("[profile] Update failed", err instanceof Error ? err.name : "UnknownError")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
