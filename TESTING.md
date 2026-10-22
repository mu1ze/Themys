# Test strategy

The release gates intentionally separate destructive test-mode journeys from safe production checks.

## Coverage matrix

| User capability | Automated coverage | Gate |
| --- | --- | --- |
| Main public navigation, legal pages, responsive layouts, auth boundaries | `responsive-public.spec.ts`, `responsive-authenticated.spec.ts` | Main-app pull requests |
| Documentation custom domain and static export | docs static build, Worker verification, and `production-smoke.spec.ts` | Docs pull requests and production smoke |
| Sign in and protected session provisioning | `global.setup.ts` | Every authenticated Playwright run |
| Profile name, location, target clauses, strict mode | `mutable-user-journeys.spec.ts` | Pull requests |
| Create, reveal, list, scope, and revoke API keys | `mutable-user-journeys.spec.ts` | Pull requests |
| API-key extraction, analysis, usage accounting, revoked-key rejection | `api-key-live.spec.ts` | Main-branch provider acceptance |
| Versioned developer envelopes, OpenAPI schemas, error codes, strict policy metadata | `src/contracts/developer-api.test.ts`, `src/contracts/developer-openapi.test.ts` | Every main-app pull request |
| Text and URL scans from the web UI | `scan-workflow-live.spec.ts` | Main-branch provider acceptance |
| Batch text and URL analysis | `urgent-batch.spec.ts` | Main-branch provider acceptance |
| Scan history, owned detail, ownership isolation, deletion | `mutable-user-journeys.spec.ts` | Pull requests |
| Results layouts, sidecar, tabs, mobile sheet | `scan-results.spec.ts` | Pull requests |
| Monitoring subscribe, list, alert read, unsubscribe, ownership isolation | `urgent-monitoring.spec.ts` | Pull requests |
| Monitoring uses canonical analysis, persists full extraction, links snapshots to scans, and returns alert `scan_id` | `src/lib/scan-persist.test.ts` plus authenticated linked-scan browser fixture | Every main-app pull request |
| Documentation feedback UI and persistence | `mutable-user-journeys.spec.ts` | Pull requests |
| Checkout creation in Stripe test mode | `stripe-webhook-mutations.spec.ts` | Pull requests |
| Subscription events, failed/paid invoices, scheduled cancellation, final downgrade | `stripe-webhook-mutations.spec.ts` | Pull requests |
| Credit purchase fulfilment and webhook idempotency | `stripe-webhook-mutations.spec.ts` | Pull requests |
| Permanent account deletion across Clerk, D1, and R2 | `account-deletion.spec.ts` | Pull requests |
| Admin plan changes and scan deletion | `admin-mutations.spec.ts` | Pull requests |
| Extension external auth channel, forged-origin rejection, expiry, popup, history, profile, monitoring, and sign-out | `extension-auth.spec.ts`, `scripts/verify-extension-runtime.mjs` | Pull requests and extension release |
| Extension packaging and production configuration | `.github/workflows/extension.yml` | Extension changes |
| Live production routes, security headers, and anonymous API boundaries | `production-smoke.spec.ts`, `scripts/verify-security-runtime.mjs` | Scheduled production smoke |
| Product-truth claims and legal processor disclosures | `src/lib/product-truth.test.ts` | Main-app pull requests |

## Safety boundaries

- Mutable browser tests refuse live Clerk or Stripe keys. They run against a local production build, a Clerk development instance, Stripe test mode, and disposable database fixtures.
- Destructive fixtures use unique markers and cleanup in `finally` blocks. Account deletion uses its own temporary Clerk user.
- Production smoke is read-only. It does not create scans, customers, keys, feedback, monitoring subscriptions, or accounts.
- Record production monitoring acceptance against a disposable test account in your own private release evidence; local tests do not establish deployed behavior.
- Monitoring alert tests must assert both sides of the result contract: the alert envelope remains alert-specific, while a changed-document alert links to the canonical persisted scan and its normal results workspace through `scan_id`.
- Provider-backed tests are isolated because they spend provider quota. They run after changes reach `main` and can also be started manually.
- Extension provider scanning remains opt-in through `RUN_LIVE_PROVIDER_E2E=1`; the normal extension gate verifies every non-provider journey.
- Extension auth acceptance must use a freshly built artifact from the same
  revision as `/extension-auth`; legacy page-message artifacts are not
  compatible with the external messaging protocol.

## Required CI secrets

Authenticated release tests require the development Clerk keys, a reserved test user/email and Clerk ID, Cloudflare D1/R2 credentials, Stripe test keys and test price IDs, plus the provider keys used by the application. See `.env.test.example` for local names. GitHub uses the corresponding `*_TEST_*` secret names shown in the workflow files.

The `ADMIN_E2E_CLERK_ID` secret must be the Clerk ID of `CLERK_TEST_USER_EMAIL`. Never put a production administrator ID or live billing credential in these gates.
