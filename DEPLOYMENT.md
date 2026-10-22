# Themys production deployment

This runbook covers the Cloudflare Worker deployments and deployed acceptance
for the application, docs, monitoring email Worker, and extension artifact. Do not put secret
values in this file, shell history, Wrangler configuration, or committed env
files.

## 1. Build and package

```sh
pnpm verify:release-config
pnpm audit --prod --json
pnpm build:workers
pnpm exec wrangler deploy --dry-run --var CRON_SECRET:local-dry-run-placeholder
pnpm extension:validate:prod
```

The dry-run placeholder is local to packaging and must never be used for the
deployed Worker.

### Cloudflare Workers Builds

Workers Builds runs its build and deploy commands independently. Configure the
project in the Cloudflare dashboard with exactly these commands:

| Setting | Value |
| --- | --- |
| Build command | `pnpm build:workers` |
| Deploy command | `pnpm exec opennextjs-cloudflare deploy` |

Do **not** use `pnpm build` as the Workers Builds command: it produces the
Next.js `.next` directory but not the required OpenNext `.open-next` Worker
bundle. The deploy command must run only after `build:workers` in the same
deployment job. The project-level `pnpm deploy` command remains suitable for a
local or external CI deploy because it runs both steps in sequence.

### Independent documentation deployment

The documentation site is built and deployed separately from `docs/`. A docs-only
change does not trigger the main application CI or Workers build.

```sh
pnpm --dir docs install --frozen-lockfile
pnpm docs:build
pnpm --dir docs verify:export
pnpm --dir docs exec wrangler deploy
```

The `themysdocs` Worker owns the custom domain `docs.themys.ca`. The static
export is rooted at `/`, so its pages and assets are served from
`https://docs.themys.ca/` and `https://docs.themys.ca/_next/...`. The docs Worker
is already independent. For a release that changes both runtime behavior and
its disclosure, deploy the main app first and the docs immediately afterward.
The currently deployed policy remains the more conservative wording during that
short interval.

The documentation workflow deploys only after a push to `main` that changes
`docs/**` or its workflow. It requires the repository secrets
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` (or an authenticated Wrangler
session), then verifies the deployed
home page, quick-start page, prefixed assets, and security policy.

In the Cloudflare dashboard, configure the main `themys` Worker under
**Settings > Build > Build watch paths** with include `*` and exclude `docs/*`, `ios/*`,
`scripts/sync-ios-safari-extension.mjs`, and `.github/workflows/ios.yml`.
Cloudflare's Git integration otherwise builds on every repository change, even
though GitHub Actions already ignores docs-only and native-only changes.
These dashboard watch paths are external configuration: editing this repository
does not apply them. Keep shared API and detection-package paths included. The docs Worker is
deployed by its dedicated GitHub workflow, so it does not need a second
Cloudflare Builds connection.

## 2. Production Worker deployment

The `themys` Worker and its hourly `0 * * * *` trigger already exist. Normal
releases inherit the encrypted secrets declared in `wrangler.jsonc`; do not use
a bulk secrets file for a routine deployment because it can unintentionally
replace the remote secret set.

Before the next release, confirm authentication and inspect secret **names**
without printing values:

```sh
pnpm exec wrangler whoami
pnpm exec wrangler secret list --name themys
```

The August 10, 2026 read-only preflight found the required
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` binding absent from the main Worker. Add it
interactively before deploying:

```sh
pnpm exec wrangler secret put NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
```

Use the Clerk production publishable key and do not place its value in shell
history or a committed file. Wrangler will reject the deploy while any declared
required secret is missing.

### TypeSafe analysis configuration

The TypeSafe Jev path is optional and activates only when the main Worker has
`JEV_API_KEY` or `TYPESAFE_API_KEY` at runtime. Neither name is in Wrangler's
required-secret list, so a successful deploy does not establish that TypeSafe
is active. To enable it, set one encrypted runtime secret and confirm its
**name** appears in `pnpm exec wrangler secret list --name themys`; do not print
the value. Scans with custom target clauses still use OpenRouter analysis.
OpenRouter also remains necessary for structured extraction and fallback
analysis. See `ENVIRONMENTS.md` and the docs privacy disclosure for this
provider split.

If the main app is deployed by Cloudflare Workers Builds, add the same value as
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` under **Settings > Build > Build Variables
and Secrets** before pushing. Cloudflare build variables are build-only and do
not become runtime bindings, so this does not replace the `wrangler secret put`
step above. A local `pnpm deploy` instead receives the build-time value from the
developer's ignored `.env` file.

For this release, deploy the private email Worker first, then the main app, then
the separately hosted docs:

```sh
pnpm email-worker:deploy:production
pnpm deploy
pnpm docs:deploy
```

The extension remains “coming soon”; `pnpm extension:build:prod` only creates
the Chrome Web Store ZIP and does not publish it.

This release changes extension authentication from a page-wide message relay to
the browser's allowlisted external messaging channel. The deployed
`/extension-auth` route and an extension artifact must come from the same
revision. Because the Chrome extension is not yet public, deploy the website
without publishing an older artifact, then use this revision or newer for Web
Store submission. If any Safari or private extension build has already been
distributed, update and verify that build before or with the website rollout;
legacy builds cannot receive the new auth response.

### Stripe production configuration

Checkout reads its credentials and Price IDs from the Worker request-time
environment; they must not be supplied only to the build command or baked into
the client bundle. Before deploying, configure these encrypted Worker secrets
with the matching **live** Stripe account and Price objects:

| Required secret |
| --- |
| `STRIPE_SECRET_KEY` |
| `STRIPE_WEBHOOK_SECRET` |
| `STRIPE_PRICE_BASE_MONTHLY` |
| `STRIPE_PRICE_BASE_ANNUAL` |
| `STRIPE_PRICE_ADVANCED_MONTHLY` |
| `STRIPE_PRICE_ADVANCED_ANNUAL` |
| `STRIPE_PRICE_CREDITS_10` |
| `STRIPE_PRICE_CREDITS_50` |
| `STRIPE_PRICE_CREDITS_200` |

Set them individually with `pnpm exec wrangler secret put <NAME>` or use the
Cloudflare Worker dashboard. Confirm names, without values, using
`pnpm exec wrangler secret list --name themys`. Avoid a routine bulk-secret
upload because it is easier to replace or omit an unrelated production secret.
The deployment is intentionally rejected when any required Stripe binding is
absent.

USD is the base currency for all seven configured Stripe Prices. Keep each
existing Price ID, add a manually set CAD amount with the same numeric value as
its USD amount, and enable Adaptive Pricing for other currencies. A configured
CAD amount takes precedence over Adaptive Pricing for Canadian customers;
Stripe Checkout can convert the USD base for other supported currencies. Keep
the USD default consistent across all seven Prices, and leave `currency`
unset when creating Checkout Sessions. The pricing page intentionally shows
only `$` and the amount; Checkout shows the currency and total Stripe selects.
Keeping the existing Price IDs preserves current subscription and webhook
mappings. Confirm multi-currency Prices and Adaptive Pricing support in the
Stripe Dashboard before launch; this repository change does not update the
Stripe catalog. See [Stripe's manual currency pricing guide](https://docs.stripe.com/payments/checkout/localize-prices/manual-currency-prices) and [local currency overview](https://docs.stripe.com/payments/checkout/localize-prices).

First-party anonymous page-view intake additionally requires
`USAGE_FINGERPRINT_SECRET` as an encrypted Worker secret. Generate at least 32
random bytes; do not reuse a Clerk, Stripe, or cron secret. Confirm the
production `RATE_LIMIT_KV` binding still points to the declared namespace so the
limit is shared across Worker isolates.

The September 22, 2026 secret-name preflight confirmed
`USAGE_FINGERPRINT_SECRET` is present and
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is still absent from the `themys` Worker.
The missing Clerk binding blocks this release. Add it interactively and repeat
the name-only inventory before deployment; also confirm the same variable is
present in Workers Builds as described above.

The same preflight found a Clerk **test** publishable key in the ignored `.env`
file and a **live** publishable key in the ignored `.dev.vars` file. Do not run
the local `pnpm deploy` path with the current `.env`: Next.js would compile the
test key into the production client. Source the live key from the approved
secret store into the build environment, confirm only its `pk_live_` class, and
then rebuild from a clean output directory. Do not copy a value between ignored
files automatically or record it in release evidence.

Before public feedback launch, create a managed Turnstile widget for
`themys.ca`, set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` during the build, and store
`TURNSTILE_SECRET_KEY` as an encrypted Worker secret. See `ENVIRONMENTS.md` for
the complete environment contract.

### Monitoring analysis contract

The monitoring scheduler analyzes changed documents through the canonical scan
pipeline and persists a full scan before creating an alert. Verify the linked
`scan_id` and the normal scan-results workspace during acceptance; do not treat
an alert summary alone as proof that clauses, compliance, or extraction were
stored. See `MONITORING_IMPLEMENTATION.md` for the data flow and failure rules.

### Monitoring email Worker

Monitoring email delivery is a separate Cloudflare Worker under
`email-worker/`. Authenticate Wrangler with `npx wrangler login`, or export
`CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`, verify the
`alerts@themys.ca` sender domain. No email HMAC secret is required; the main
app calls this Worker through the private `MONITORING_EMAIL_WORKER` service
binding.
Deploy staging first with:

```sh
pnpm email-worker:deploy:staging
```

The deploy command fails closed when Wrangler is not authenticated or the
Durable Object migration is missing. Token values are consumed by Wrangler
only and are not written to the repository.

The main app uses the private `MONITORING_EMAIL_WORKER` service binding; do not
configure a public email Worker URL or shared HMAC secret. Deploy production
only after a disposable authenticated account receives one controlled alert and
the unsubscribe path is verified:

```sh
pnpm email-worker:deploy:production
```

The production email Worker has `workers_dev: false` and is reachable by the
main app only through its service binding. Keep provider credentials out of
`NEXT_PUBLIC_*` variables, extension artifacts, and logs. See
`email-worker/README.md` for the complete configuration checklist.

## 3. Deployed API and security acceptance

Set `DEPLOYED_ORIGIN` to the HTTPS Worker/custom-domain origin returned by the
deployment.

```sh
PLAYWRIGHT_BASE_URL="$DEPLOYED_ORIGIN" EXPECT_CRON_CONFIGURED=1 node --env-file=.env scripts/verify-urgent-runtime.mjs
PLAYWRIGHT_BASE_URL="$DEPLOYED_ORIGIN" EXPECT_PRODUCTION_HEADERS=1 node scripts/verify-security-runtime.mjs
PLAYWRIGHT_SKIP_WEBSERVER=1 PLAYWRIGHT_BASE_URL="$DEPLOYED_ORIGIN" RUN_LIVE_PROVIDER_E2E=1 pnpm exec playwright test e2e/urgent-batch.spec.ts e2e/urgent-monitoring.spec.ts --project=chromium --no-deps
PLAYWRIGHT_BASE_URL="$DEPLOYED_ORIGIN" pnpm verify:monitoring-cron
gh workflow run provider-acceptance.yml --ref main
```

Verify the Worker deployment lists one hourly cron trigger. After propagation,
confirm a scheduled invocation completes without an exception in Worker logs.
Run live provider acceptance only after the deployed revision is confirmed; it is
manual so a Git push cannot accidentally test the previous production revision.

For this release, also run the public application/docs smoke checks:

```sh
PLAYWRIGHT_BASE_URL=https://themys.ca PLAYWRIGHT_SKIP_WEBSERVER=1 \
  pnpm exec playwright test e2e/production-smoke.spec.ts --project=chromium --no-deps
pnpm --dir docs verify:production
```

Then use the signed-in disposable account to open the remaining email-disabled
monitoring alert, confirm the deep link selects and marks only that owned alert
as read, remove its subscription, and verify the alert disappears. Do not run a
second email-delivery test unless the existing evidence is invalidated.

## 4. Staging extension acceptance

Build an artifact whose canonical origin exactly matches the deployed HTTPS
origin, then load that artifact in the real-auth verifier.

```sh
THEMYS_STAGING_ORIGIN="$DEPLOYED_ORIGIN" pnpm extension:build:staging
PLAYWRIGHT_BASE_URL="$DEPLOYED_ORIGIN" THEMYS_EXTENSION_ENVIRONMENT=staging ALLOW_REMOTE_CLERK_COOKIE_REMAP=1 RUN_LIVE_PROVIDER_E2E=1 node --env-file=.env scripts/verify-extension-auth.mjs
```

`ALLOW_REMOTE_CLERK_COOKIE_REMAP=1` is an explicit authorization boundary: it
permits the saved test session to be sent only to the configured HTTPS app
origin for this run.

## 5. Final evidence and cleanup

- Confirm no uniquely tagged E2E users, subscriptions, snapshots, scans, usage
  reservations, or counters remain in Cloudflare D1, and no corresponding
  private R2 objects remain.
- Run an external header/CSP scanner against the deployed HTTPS origin.
- Exercise Clerk sign-in/sign-out and Stripe checkout under the deployed CSP.
- Confirm `/api/events/anon` does not return `503` for a valid controlled event,
  then verify the request is throttled by `RATE_LIMIT_KV` rather than relying on
  an isolate-local counter. Record only status and binding evidence, never the
  visitor fingerprint or secret.
- Attach results to the relevant Linear issues and move only fully accepted
  issues to Done.
- Record `sha256sum pnpm-lock.yaml` with the release evidence. Moderate-or-higher
  production dependency advisories block release. A temporary exception must
  name an owner, rationale, and expiry date in a reviewed pull request; there
  are no standing exceptions.

Keep a private acceptance record for your own deployment, distinguishing local
checks from production evidence. Record sanitized timestamps and rollback notes
before releasing. Internal operating and business records are not distributed
with this source repository.
