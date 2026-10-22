import assert from "node:assert/strict"
import test from "node:test"

import {
  DEVELOPER_API_VERSION,
  developerAnalysisPolicy,
  developerFailure,
  developerItemFailure,
  developerSuccess,
  isDeveloperApiRequest,
} from "./developer-api.ts"

test("developer success and errors use one versioned, discriminated envelope", () => {
  assert.deepEqual(developerSuccess("req-1", { value: 7 }), {
    schemaVersion: DEVELOPER_API_VERSION,
    requestId: "req-1",
    ok: true,
    data: { value: 7 },
  })
  assert.deepEqual(developerFailure("req-2", 403, "API key missing required scope", { requiredScope: "analyze" }), {
    schemaVersion: DEVELOPER_API_VERSION,
    requestId: "req-2",
    ok: false,
    error: {
      code: "insufficient_scope",
      message: "API key missing required scope",
      status: 403,
      details: { requiredScope: "analyze" },
    },
  })
})

test("batch item failures reuse the same structured error vocabulary", () => {
  assert.deepEqual(developerItemFailure(2, 502, "Analysis provider unavailable"), {
    ok: false,
    index: 2,
    error: {
      code: "upstream_unavailable",
      message: "Analysis provider unavailable",
      status: 502,
    },
  })
})

test("only Themys bearer credentials select the developer contract", () => {
  assert.equal(isDeveloperApiRequest(new Request("https://themys.ca/api/analyze", {
    headers: { Authorization: "Bearer tmys_example" },
  })), true)
  assert.equal(isDeveloperApiRequest(new Request("https://themys.ca/api/analyze", {
    headers: { Authorization: "Bearer clerk-token" },
  })), false)
})

test("analysis policy makes strict targets, jurisdiction, and evidence rules explicit", () => {
  assert.deepEqual(developerAnalysisPolicy({
    strictMode: true,
    targetClauses: ["automatic renewal"],
    playbookId: "consumer_app",
    country: "CA",
    state: "ON",
  }), {
    mode: "strict_targets_only",
    targetClauses: ["automatic renewal"],
    playbookId: "consumer_app",
    jurisdiction: { country: "CA", state: "ON" },
    complianceEvidence: "source_grounded",
    notice: "informational_not_legal_advice",
  })
  assert.equal(developerAnalysisPolicy({ strictMode: true, targetClauses: [] }).mode, "standard")
})
