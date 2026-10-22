import { NextResponse } from "next/server"
import { currentUser } from "@clerk/nextjs/server"

import { ApiKeyValidationError, createApiKey, listApiKeys } from "@/lib/api-keys"
import { readRequestText, RequestBodyTooLargeError } from "@/lib/request-body"

const MAX_REQUEST_BYTES = 64 * 1024

export async function GET() {
  try {
    const user = await currentUser()
    const clerkId = user?.id

    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const keys = await listApiKeys(clerkId)
    return NextResponse.json({ keys })
  } catch (err) {
    console.error("[developer/keys GET] Error", err instanceof Error ? err.name : "UnknownError")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await currentUser()
    const clerkId = user?.id

    if (!clerkId) {
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
    const body = parsedBody as {
      name?: string
      scopes?: string[]
    }

    const { rawKey, keyPrefix, id } = await createApiKey(
      clerkId,
      body.name,
      body.scopes
    )

    return NextResponse.json({ ok: true, key: rawKey, keyPrefix, id })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error"
    console.error("[developer/keys POST] Error", err instanceof Error ? err.name : "UnknownError")
    return NextResponse.json(
      { error: err instanceof ApiKeyValidationError ? message : "Internal server error" },
      { status: err instanceof ApiKeyValidationError ? 400 : 500 },
    )
  }
}
