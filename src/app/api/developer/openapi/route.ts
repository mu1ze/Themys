import { DEVELOPER_OPENAPI_DOCUMENT } from "@/contracts/developer-openapi"

export const dynamic = "force-static"

export function GET() {
  return Response.json(DEVELOPER_OPENAPI_DOCUMENT, {
    headers: {
      "cache-control": "public, max-age=3600",
      "content-type": "application/vnd.oai.openapi+json;version=3.1",
    },
  })
}
