---
title: "API Overview"
description: "Use the experimental Themys API to extract and analyze legal documents."
order: 7
---

> **Experimental API:** The service is experimental, but its machine-readable response contract is versioned. Breaking response changes require a new schema version.

## Base URL

`https://themys.ca/api`

## Authentication

Create an API key in the [Developer Portal](https://themys.ca/dashboard/developer), then send it with each programmatic request:

```http
Authorization: Bearer YOUR_API_KEY
Accept: application/vnd.themys.v1+json
```

Keep API keys private. Create a new key and revoke the old one if you believe a key has been exposed.

The key must have the scope required by the endpoint. `extract` is required
for `/api/extract`; `analyze` is required for `/api/analyze` and
`/api/analyze/batch`. The batch endpoint uses the `analyze` scope for every
item.

## Available endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /api/extract` | Retrieve readable text from a public legal-document URL |
| `POST /api/analyze` | Analyze a public URL or supplied document text |
| `POST /api/analyze/batch` | Analyze up to five items in one request |

See the endpoint pages for request and response examples.

## Responses and limits

Every API-key response uses the same discriminated JSON envelope. Read `data` only when `ok` is `true`. When `ok` is `false`, branch on the stable `error.code`; `error.message` is for humans. Retain `requestId` when reporting a problem.

```json
{
  "schemaVersion": "2026-09-20",
  "requestId": "req_...",
  "ok": true,
  "data": {}
}
```

```json
{
  "schemaVersion": "2026-09-20",
  "requestId": "req_...",
  "ok": false,
  "error": {
    "code": "invalid_request",
    "message": "Provide exactly one of URL or pasted terms text",
    "status": 400
  }
}
```

The complete OpenAPI 3.1 document is available at [`/api/developer/openapi`](https://themys.ca/api/developer/openapi). Success responses use `application/vnd.themys.v1+json` and also include `X-Themys-API-Version` and `X-Request-Id` headers.

The same media type and envelope are used for errors. Treat `ok` as the
discriminator; do not infer success from the HTTP status alone. Stable error
codes include `authentication_required`, `insufficient_scope`,
`invalid_request`, `payload_too_large`, `rate_limit_exceeded`, and
`upstream_unavailable`. Keep `requestId` with application logs and support
reports.

Requests may include an `Idempotency-Key` header. Reuse it when safely retrying
the same operation, and generate a new value for a new scan. Account plan,
rate limits, and provider availability can affect the result; the response's
`usage` data and the Developer Portal show the allowance available to the
authenticated account.

### LLM and typed-client rule

For an LLM tool or SDK, use this sequence:

1. Parse JSON and verify `schemaVersion`.
2. If `ok` is `true`, consume only `data`.
3. If `ok` is `false`, branch on `error.code`, preserve `error.status`, and
   return `requestId` to the caller.
4. Never treat an empty `flags` or `fullExtraction` array as a guarantee that
   the source is risk-free.

API availability and plan allowances depend on your account. Review your current allowance in the Developer Portal or your Themys settings.

## Example

```bash
curl -X POST https://themys.ca/api/analyze \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Accept: application/vnd.themys.v1+json" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/terms"}'
```

Themys analysis is informational only and is not legal advice. Review the original document before making a decision.
