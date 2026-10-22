import { NextResponse } from "next/server"

import { EXTENSION_API_VERSION } from "@/contracts/extension"

/** Marks extension-facing responses with the versioned compatibility contract. */
export function extensionJson(body: unknown, init?: ResponseInit): NextResponse {
  const response = NextResponse.json(body, init)
  response.headers.set("X-Themys-Extension-Contract", EXTENSION_API_VERSION)
  return response
}
