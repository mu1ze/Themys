import assert from "node:assert/strict"
import test from "node:test"

import { DEVELOPER_API_MEDIA_TYPE, DEVELOPER_API_VERSION } from "./developer-api.ts"
import { DEVELOPER_OPENAPI_DOCUMENT } from "./developer-openapi.ts"

test("developer OpenAPI document publishes every supported operation and the standard envelope", () => {
  assert.equal(DEVELOPER_OPENAPI_DOCUMENT.openapi, "3.1.0")
  assert.equal(DEVELOPER_OPENAPI_DOCUMENT.info.version, DEVELOPER_API_VERSION)
  assert.deepEqual(Object.keys(DEVELOPER_OPENAPI_DOCUMENT.paths), [
    "/api/extract",
    "/api/analyze",
    "/api/analyze/batch",
  ])
  assert.equal(
    DEVELOPER_OPENAPI_DOCUMENT.paths["/api/analyze"].post.responses["200"].content[DEVELOPER_API_MEDIA_TYPE].schema.$ref,
    "#/components/schemas/AnalyzeEnvelope",
  )
  assert.equal(DEVELOPER_OPENAPI_DOCUMENT.components.schemas.ErrorEnvelope.properties.ok.const, false)
  assert.equal(DEVELOPER_OPENAPI_DOCUMENT.components.schemas.AnalysisPolicy.properties.complianceEvidence.const, "source_grounded")
})
