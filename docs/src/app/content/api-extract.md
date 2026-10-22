---
title: "POST /api/extract"
description: "Extract readable text from a public Terms of Service or Privacy Policy URL."
order: 9
---

## Request

```http
POST https://themys.ca/api/extract
Authorization: Bearer YOUR_API_KEY
Accept: application/vnd.themys.v1+json
Content-Type: application/json
```

```json
{
  "url": "https://example.com/terms"
}
```

The URL must point to a public page.

The page must be reachable without a login, CAPTCHA, or private network
access. Use `/api/analyze` with supplied `text` when your integration already
has authorized document text.

## Response

```json
{
  "schemaVersion": "2026-09-20",
  "requestId": "req_...",
  "ok": true,
  "data": {
    "text": "Terms of Service ...",
    "wordCount": 4823
  }
}
```

| Field | Description |
|-------|-------------|
| `data.text` | Readable text extracted from the requested page |
| `data.wordCount` | Number of words in the extracted text |

## Errors

The API returns an error when the URL is invalid, requires sign-in, or cannot be read. Check that the page is public and points directly to the legal document, then try again.

Errors use the standard envelope described in [API Overview](/api-overview).
For example, a valid key without the `extract` scope receives
`insufficient_scope`; an inaccessible source may receive
`unprocessable_document` or `upstream_unavailable`.
