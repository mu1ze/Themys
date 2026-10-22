# Admin measurement contract

The admin is a decision workspace: Overview identifies the next action; Growth measures activation and repeat use; Revenue reports recorded collections and billing follow-up; Reliability distinguishes processing failures from product limits; Usage compares delivery channels. Users, Scans, and Cache & limits retain their existing operational controls.

## Reporting rules

Choose 7, 30, or 90 **complete UTC days**. Today is excluded. Comparisons use the immediately preceding interval of equal length. Account and subscription status cards are explicitly current snapshots. Empty denominators produce a dash; query failures produce a visible unavailable notice, never a successful zero. All metric reads require the existing admin allowlist guard. Aggregation happens in D1 without downloading a capped event list.

| Measure | Definition | Decision |
| --- | --- | --- |
| Active reviewers | Distinct owners of saved, non-deleted, non-monitoring reviews in the interval | Is adoption expanding? |
| 7-day activation | Accounts in the reporting window shifted back seven days, with a saved review in their first seven days / all such accounts | Improve first-review onboarding |
| Repeat reviewers | Reviewers present in both adjacent periods / reviewers in prior period | Understand recurring value; this is period retention, not subscription churn |
| Decision uptake | Reviews created in the interval currently marked sign, negotiate, or walk away / saved reviews | Is analysis helping users act? |
| Paywall to checkout | Distinct actors starting checkout after a paywall event within seven days, both events inside interval / paywall actors | Identify purchase friction; recent viewers have shorter follow-up |
| Recorded collections | Sum of paid invoice amounts by currency, using payment date | Understand recorded cash collection without conflating currencies |
| Subscription state | Current active, trialing, and past_due local accounts | Follow up billing issues |
| Recorded success rate | Successful analyze and batch_item events / success plus failed events | Investigate processing reliability |
| Quota blocks | Recorded quota_rejected attempts, separate from failures | Tune allowances and conversion experience |
| p95 backend duration | Nearest-rank percentile of successful analyze duration_ms | Detect slow successful processing; historical untimed events excluded |
| Cache reuse | Cached successful analyze/batch_item events / successful events | Evaluate delivery efficiency |
| Credits | Recorded product credits consumed | Understand allowances; these are not provider costs |

Activity metrics reflect retained records, not immutable historical analytics. Persisted user profiles are not every Clerk registration. Telemetry delivery is best effort; requests rejected before recording and telemetry outages are outside success-rate coverage. A successful attempt need not produce a new saved scan. Safari and iOS currently share a channel identifier, so the UI does not invent a platform split.

## Recording priorities

1. **Implemented now:** add duration_ms to successful and failed single-analyze events. Keep hashed actor attribution, no raw document text or URLs in metrics. Display sample size for timed successes.
2. **Product value:** record result_viewed, decision_recorded, classification_corrected, extraction_feedback, and extension_onboarding_completed at authoritative completion points. Use event IDs for deduplication, timestamp, channel, and pseudonymous actor. Define feedback denominator as reviews shown, not all accounts. Do not equate risk flags with accuracy.
3. **Billing:** persist live/test mode, subscription items, quantity, currency, interval and interval count, discounts, cancellations, refund amounts, and invoice linkage before introducing MRR, churn, net revenue, or payment conversion. Reconcile against Stripe. Current invoices lack these dimensions.
4. **Unit economics:** record provider/model, input/output tokens, billed cost/currency and pricing version for every model invocation, including retries and failures. Then compute cost per completed review and contribution margin. Product credits cannot substitute for dollars.
5. **Reliability coverage:** instrument early rejection paths and event delivery failures separately; introduce browser end-to-end latency and external availability probes before claiming uptime or customer-perceived speed.

Do not add MRR, LTV, CAC, gross margin, legal accuracy, or visitor-to-paid conversion until their inputs and attribution are dependable. These measures are intentionally absent rather than approximated from unrelated counts.

## Implementation and validation

SQL and date contracts: `src/features/admin/metrics/queries.ts`. Authorized D1 reader: `server.ts` in the same folder. Server-rendered presentation: `src/components/admin/founder-dashboard.tsx`. The dedicated admin imports these pages without adding chart libraries or client-side analytics fetches.

Run `pnpm --dir admin test:metrics` on Node 22.18+ or Node 24 (built-in TypeScript stripping and SQLite), `pnpm --dir admin typecheck`, and `pnpm --dir admin build`. The tests exercise the actual SQL on SQLite, including mature cohorts, deleted/monitoring exclusions, actor linkage, currency grouping beyond pagination limits, and p95 sampling. Production validation still requires authenticated D1-backed pages and reconciliation with source records.
