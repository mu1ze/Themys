---
title: "POST /api/analyze/batch"
description: "Analyze up to five public legal documents in one request."
order: 11
---

## Request

```http
POST https://themys.ca/api/analyze/batch
Authorization: Bearer YOUR_API_KEY
Accept: application/vnd.themys.v1+json
Content-Type: application/json
```

```json
{
  "items": [
    { "url": "https://example.com/terms" },
    { "url": "https://example.org/privacy" }
  ]
}
```

Send between one and five items. Each item may include a public URL or supplied legal-document text.

Each item must provide exactly one of `url` or `text`. Optional `sourceUrl` and
`domain` fields follow the single-analysis request contract. Results stay in
input order, so `index` is the authoritative item mapping.

## Response

The response returns results in the same order as the submitted items. One item failing does not prevent the other items from returning their results.

```json
{
  "schemaVersion": "2026-09-20",
  "requestId": "req_...",
  "ok": true,
  "data": {
    "results": [
      { "ok": true, "index": 0, "result": {} },
      {
        "ok": false,
        "index": 1,
        "error": {
          "code": "upstream_unavailable",
          "message": "Unable to analyze this item",
          "status": 502
        }
      }
    ],
    "summary": { "total": 2, "succeeded": 1, "failed": 1 },
    "usage": {}
  }
}
```

Review each item independently and verify important findings against the original document.

The outer response can be successful even when individual items fail. For
item-level failures, branch on `results[i].ok` and then use the nested
`error.code`; do not discard successful sibling results. A malformed batch
request (for example, zero or more than five items) fails at the outer level.
