---
title: "POST /api/analyze"
description: "Analyze a public legal document and receive review guidance."
order: 10
---

## Request

```http
POST https://themys.ca/api/analyze
Authorization: Bearer YOUR_API_KEY
Accept: application/vnd.themys.v1+json
Content-Type: application/json
```

Provide exactly one of `url` or `text`. Use `url` to have Themys fetch and analyze a public terms page; use `text` only when you already have the document content.

Optional `sourceUrl` preserves the source page when you submit text, and
`domain` associates the scan with a host. Both are useful for audit trails but
do not change the account's configured analysis policy.

Send an `Idempotency-Key` when retrying a request after a timeout. The key
should identify one logical operation and must not be reused for unrelated
documents.

### Scan a target URL

```json
{
  "url": "https://example.com/terms"
}
```

### Analyze supplied text

```json
{
  "text": "Terms of Service ...",
  "domain": "example.com"
}
```

## Response

The response `data` includes an attention score, a summary, flagged clauses, and structured extraction when available. It also includes the persisted `scanId`, actionable suggestions (`pushback`), document identity data, usage information, and `analysisPolicy`. Client applications should treat empty `flags` and empty `fullExtraction` as separate outcomes.

`analysisPolicy` makes the applied account configuration explicit: standard versus strict-target-only mode, target clauses, playbook, jurisdiction, source-grounded compliance evidence, and the informational-not-legal-advice notice. API scans therefore use the same target, strict-mode, playbook, jurisdiction, and compliance pipeline as signed-in scans.

When strict mode is enabled and target clauses are configured, the policy mode
is `strict_targets_only`. Findings must be grounded in the submitted source and
match a configured target; unrelated clauses are intentionally omitted. This
is useful for integrations that need a narrow, deterministic review surface,
but it is not a claim that the rest of the document is safe.

```json
{
  "schemaVersion": "2026-09-20",
  "requestId": "req_...",
  "ok": true,
  "data": {
    "summary": "A plain-language overview of the document.",
    "flags": [],
    "fullExtraction": [],
    "analysisPolicy": {
      "mode": "strict_targets_only",
      "targetClauses": ["automatic renewal"],
      "playbookId": "consumer_app",
      "jurisdiction": { "country": "CA", "state": "ON" },
      "complianceEvidence": "source_grounded",
      "notice": "informational_not_legal_advice"
    }
  }
}
```

When TypeSafe Jev is configured and no custom target clauses are set, the analysis path uses typed judgments to detect configured risks and available user rights in the source text. Custom target clauses, unavailable TypeSafe service, or invalid TypeSafe responses use the OpenRouter analysis path. Structured extraction runs separately through OpenRouter; it can be empty even when clause analysis succeeds. Do not infer that an empty extraction means the document contained no terms.

Automated analysis can be incomplete or inaccurate. It is informational only and not legal advice.
