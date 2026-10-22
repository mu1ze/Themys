# Monitoring implementation

This document describes the internal monitoring contract. It complements the
release and production procedures in `DEPLOYMENT.md`.

## Contract boundary

Monitoring is a scheduler and change-detection feature, not a second analysis
engine. The canonical analysis boundary is
`src/features/scans/server/analyze.ts` (`analyzeItem`), which is also used by
the web scan and Developer API paths. Monitoring owns subscription cadence,
document identity verification, text hashing, snapshots, alert creation, and
email delivery.

The alert API intentionally keeps an alert-shaped envelope:

```json
{
  "alerts": [
    {
      "id": "...",
      "new_snapshot_id": "...",
      "change_type": "risk_increase",
      "risk_delta": 1.2,
      "summary": "...",
      "scan_id": "..."
    }
  ],
  "unreadCount": 1
}
```

`scan_id` is the link to the canonical persisted scan. Consumers should load
that scan through the normal scan-results route/API rather than relying on a
duplicated alert-specific analysis payload. This keeps clauses, compliance
tags, structured extraction, and the full document on the same result contract
used by regular scans.

## Change-check flow

`src/lib/monitoring-job.ts` processes due active subscriptions in this order:

1. Resolve the public URL and normalize the extracted text. The resolved text
   is cached on a best-effort basis; a cache write failure does not invalidate
   the check.
2. Identify the document type and canonical identity. A first unknown document
   is stored as a baseline and the subscription is upgraded to `active` once
   identity is established. A later identity mismatch or low-confidence result
   marks the subscription `mismatch`/`needs_review` and skips alerting.
3. Compare the new normalized text hash with the latest subscription snapshot.
   A missing snapshot creates a baseline without an alert.
4. For a changed document, call `analyzeItem` with the already-resolved text,
   `bypassCache: true`, `scanSource: "web"`, and the owning user's target
   clauses, strict-mode setting, jurisdiction, and plan context. Reusing the
   resolved text ensures hash comparison and analysis describe the same source
   version and avoids a second fetch.
5. Persist the complete result through `persistAnalysis`. The scan row is marked
   `is_monitoring_scan = true` and `previous_scan_id` points to the prior
   snapshot's scan when one exists. Clauses, compliance tags, Jev diagnostics,
   and `fullExtraction` use the same persistence paths as a regular scan.
6. Create a new snapshot with the canonical scan ID plus risk, flagged-clause,
   and clause counts. Create one alert with the computed change type/summary,
   then enqueue the email delivery path.

If analysis or persistence fails, the job records an unanalysed snapshot so the
same failed source is not repeatedly treated as a new change, but it does not
create a misleading alert. The subscription check continues independently for
other documents.

## Persistence relationships

The relevant D1 relationships are:

```text
monitoring_subscriptions
  -> tos_snapshots (subscription_id)
       -> scans (scan_id)
            -> clauses / clause_compliance_tags / full_extraction_*
  -> monitoring_alerts (new_snapshot_id)
```

`src/lib/persistence.ts` accepts `isMonitoringScan` and `previousScanId` and
writes them to the `scans` row. `src/lib/monitoring.ts#getAlerts` enriches each
alert by resolving `new_snapshot_id -> scan_id` in batches of 100, keeping the
query safe for SQLite/D1 variable limits. Alerts without a linked analysis
(initial baselines or analysis failures) expose `scan_id: null`.

## HTTP and UI surfaces

- `POST /api/monitor` validates a public URL, resolves and identifies the legal
  document, enforces the plan limit, creates the subscription, and records an
  initial snapshot.
- `GET /api/monitor` lists owned active subscriptions.
- `GET /api/monitor/alerts` returns the alert envelope above and the unread
  count. It is Clerk-authenticated and never accepts API keys.
- `PATCH /api/monitor/alerts` marks one owned alert as read.
- `POST /api/monitor/check` is the cron entry point and requires the cron
  secret at the Worker boundary.
- `src/app/monitoring/alert-card.tsx` renders `View full scan` only when
  `scan_id` is present, linking to `/scan/results?id=<scan_id>`.

The scan-results workspace is therefore the single place for the full summary,
flags, compliance view, structured extraction, and source document. Monitoring
does not maintain a parallel report renderer.

## Security and delivery

All subscription, snapshot, alert, and scan writes are scoped to the resolved
Clerk profile. Alert reads and read-state mutations filter by the authenticated
user ID. Email delivery remains behind the private
`MONITORING_EMAIL_WORKER` service binding and uses the existing atomic claim /
idempotency flow; canonical scan persistence does not change email semantics.

## Verification

The source-level contract is covered by
`src/lib/scan-persist.test.ts`. Authenticated browser verification should seed a
uniquely marked local fixture with a snapshot-linked scan, assert the alert
`scan_id` and rendered full-scan link, then delete the alert, snapshot, scan, and
subscription in that order. Production acceptance additionally requires a
controlled document change, one alert/email assertion, retry verification, and
account cleanup. Record that evidence privately for your own deployment.
