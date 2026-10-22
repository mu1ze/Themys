import { NextResponse } from "next/server"
import { listRecentScansByClerkId } from "@/lib/persistence"
import { readRequestText, RequestBodyTooLargeError } from "@/lib/request-body"
import { resolveRequestAuth } from "@/lib/request-auth"
import { parseExtensionHistoryRequest } from "@/contracts/extension"
import { extensionJson } from "@/features/extension-api/server/response"

/** History for overlay clients (Chrome `extension` and iOS `safari-ios`). */

const MAX_REQUEST_BYTES = 64 * 1024

export async function POST(request: Request) {
  try {
    const auth = await resolveRequestAuth(request, { allowApiKey: false })
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
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
    const body = parseExtensionHistoryRequest(parsedBody)

    const requestedLimit = typeof body.limit === "number" ? body.limit : 20
    const limit = Math.min(Math.max(Math.trunc(requestedLimit), 1), 50)
    const scans = await listRecentScansByClerkId(auth.identity.clerkId, limit)

    return extensionJson({ scans })
  } catch (err) {
    console.error("[scans/history] Request failed")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
