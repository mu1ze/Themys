# Developer API implementation notes

This is the internal implementation reference for the experimental Themys
Developer API. The public integration guide lives in `docs/src/app/content/`.

## Contract ownership

The response contract is owned by `src/contracts/developer-api.ts` and
`src/contracts/developer-openapi.ts`:

```ts
DEVELOPER_API_VERSION = "2026-09-20"
DEVELOPER_API_MEDIA_TYPE = "application/vnd.themys.v1+json"
```

Every API-key response from the supported developer endpoints is a discriminated
envelope:

- success: `{ schemaVersion, requestId, ok: true, data }`
- failure: `{ schemaVersion, requestId, ok: false, error: { code, message, status, details? } }`

Consumers branch on `ok`, use `error.code` for program logic, and retain
`requestId` for support. `message` is human-readable and is not a stable
machine interface. A breaking change requires a new schema version and media
type contract.

The OpenAPI 3.1 document is served at `/api/developer/openapi`. Update the
contract, OpenAPI schemas, and tests together.

## HTTP adapter

`src/features/developer-api/server/response.ts` is the response adapter for the
developer envelope. It adds:

- `Content-Type: application/vnd.themys.v1+json; charset=utf-8`
- `X-Themys-API-Version: 2026-09-20`
- `X-Request-Id`, matching the JSON `requestId`

Routes identify developer requests with a `Bearer tmys_...` authorization
header. Clerk and extension callers keep their existing response contracts;
do not wrap those responses accidentally.

## Supported routes

| Route | Required scope | Notes |
| --- | --- | --- |
| `POST /api/extract` | `extract` | Fetches a public URL and returns readable text. |
| `POST /api/analyze` | `analyze` | Analyzes one URL or supplied text and persists a scan. |
| `POST /api/analyze/batch` | `analyze` | Processes one to five items and preserves input order. |

Authentication and scope checks are performed by `src/lib/request-auth.ts` and
`src/lib/api-keys.ts`. Failed API-key requests still record API-key usage when
the key has been identified. Revoked or malformed keys return
`authentication_required`; a valid key missing a route scope returns
`insufficient_scope`.

Stable error-code mapping:

| HTTP status | Code |
| --- | --- |
| 400 | `invalid_request` |
| 401 | `authentication_required` |
| 403 | `forbidden` or `insufficient_scope` |
| 402 | `upgrade_required` |
| 413 | `payload_too_large` |
| 422 | `unprocessable_document` |
| 429 | `rate_limit_exceeded` |
| 502 | `upstream_unavailable` |
| 5xx | `internal_error` |

## Analysis policy and strict mode

`developerAnalysisPolicy()` is added to successful analysis data. It exposes
the account configuration actually used by the scan:

- `mode`: `standard` or `strict_targets_only`
- `targetClauses`: configured target phrases
- `playbookId`: selected playbook
- `jurisdiction`: configured country and state/province
- `complianceEvidence`: currently `source_grounded`
- `notice`: currently `informational_not_legal_advice`

Strict mode is active only when both `strictMode` is enabled and at least one
target clause exists. The analysis pipeline receives the same profile,
playbook, target, jurisdiction, and compliance configuration as signed-in web
scans. The strict scanner rejects findings that are not grounded in the source
text or do not match a configured target. This policy metadata is descriptive;
it is not a client-controlled request override.

Do not claim that an empty `flags` array proves a document is safe. Source
coverage can be incomplete, and the original document should be reviewed for
consequential decisions.

## Batch semantics

The batch route returns an outer success envelope when the batch request itself
is valid. Each item independently returns either:

```json
{ "ok": true, "index": 0, "cached": false, "result": {} }
```

or:

```json
{
  "ok": false,
  "index": 1,
  "error": {
    "code": "invalid_request",
    "message": "Provide exactly one of text or url",
    "status": 400
  }
}
```

An invalid item must not hide successful sibling items. Keep the submitted
index when adapting results for SDKs or LLM tools.

## Key management and portal

The portal implementation is `src/app/dashboard/developer/developer-client.tsx`.
Keys are created through the authenticated portal, displayed once, scoped to
`extract` and/or `analyze`, and revoked through
`src/app/api/developer/keys/[keyId]/route.ts`. The portal displays request
volume, success/error rates, last-use time, and the response contract. Key
management endpoints are Clerk-session endpoints and are not part of the
public API-key envelope.

Use the smallest scope set for each integration. Never log, persist, or return
the raw secret after key creation. Tests must assert prefixes and identifiers,
not secret values.

## Verification gates

Contract-level tests:

```bash
pnpm exec tsx --test src/contracts/developer-api.test.ts src/contracts/developer-openapi.test.ts
```

The authenticated provider acceptance test is `e2e/api-key-live.spec.ts`. It
verifies extraction, strict-target analysis, false-positive exclusion, usage
accounting, revocation, and standardized rejection after revocation. It
temporarily changes the disposable test profile and restores it in `finally`.

When changing this surface, run at minimum:

```bash
pnpm typecheck
pnpm lint
pnpm test:unit
pnpm docs:build
pnpm build
git diff --check
```

For live authenticated checks, label local browser evidence separately from
deployed production evidence. Provider-backed scans consume quota and create
persisted scan records, so use unique markers and clean up only explicitly
authorized test data.
