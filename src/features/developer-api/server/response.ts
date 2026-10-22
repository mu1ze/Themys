import { NextResponse } from "next/server"

import {
  DEVELOPER_API_MEDIA_TYPE,
  DEVELOPER_API_VERSION,
  developerFailure,
  developerSuccess,
} from "@/contracts/developer-api"

export function developerJson(
  requestId: string,
  body: Record<string, unknown>,
  status = 200,
): NextResponse {
  const message = typeof body.error === "string" ? body.error : "Request failed"
  const payload = status >= 400
    ? developerFailure(
        requestId,
        status,
        message,
        Object.fromEntries(Object.entries(body).filter(([key]) => key !== "error")),
      )
    : developerSuccess(requestId, body)
  const response = NextResponse.json(payload, { status })
  response.headers.set("content-type", `${DEVELOPER_API_MEDIA_TYPE}; charset=utf-8`)
  response.headers.set("x-themys-api-version", DEVELOPER_API_VERSION)
  response.headers.set("x-request-id", requestId)
  return response
}
