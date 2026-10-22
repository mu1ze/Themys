---
title: "API Keys"
description: "Create and manage API keys for experimental Themys integrations."
order: 8
---

> **Experimental API:** API keys provide access to the experimental Themys Developer API. The response schema is versioned; breaking changes require a new schema version.

## Create a key

1. Sign in to [Themys](https://themys.ca).
2. Open the [Developer Portal](https://themys.ca/dashboard/developer).
3. Select **Create API Key**.
4. Copy the key when it is shown and store it securely.

The full key is shown only once.

## Use a key

Send the key as a Bearer token:

```http
Authorization: Bearer YOUR_API_KEY
Accept: application/vnd.themys.v1+json
```

Keys can be scoped for extraction and analysis. Use the smallest set of scopes that your integration needs.

| Scope | Grants access to |
| --- | --- |
| `extract` | `POST /api/extract` |
| `analyze` | `POST /api/analyze` and `POST /api/analyze/batch` |

You can select either scope or both when creating a key. A key with no matching
scope receives a `403` response with `error.code` set to
`insufficient_scope`.

## Keep keys safe

- Do not share a key in chat, email, screenshots, or source code.
- Store keys in your deployment platform's secret settings.
- Create separate keys for separate integrations where practical.
- Revoke a key immediately if it may have been exposed.

The full secret is returned only once. The portal stores only a verifier and a
display prefix, so a lost secret cannot be recovered; create a replacement
key instead.

## Revoke a key

Open the Developer Portal, find the key, and choose **Revoke**. Revoked keys stop working immediately. Create a replacement key before revoking one used by a live integration.
