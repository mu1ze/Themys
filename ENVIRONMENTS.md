# Application environments

`https://themys.ca` is the canonical production origin. `https://www.themys.ca`
redirects permanently to the apex domain in `custom-worker.ts`. Deprecated
`.com` and `.ai` origins are not supported or advertised.

## Origin configuration

`APP_URL` is a server-only absolute origin. Production builds reject a missing,
non-HTTPS, path-bearing, or loopback value. It drives metadata, Open Graph URLs,
robots, sitemap, and Stripe Checkout return URLs. Do not expose it with a
`NEXT_PUBLIC_` prefix.

| Environment | Required value |
| --- | --- |
| Local development | Optional; defaults to `http://localhost:3000` |
| Preview | The preview deployment's HTTPS origin |
| Staging | The staging deployment's HTTPS origin |
| Production | `https://themys.ca` |

The normal `pnpm build` defaults to the canonical production origin. Override
it without editing source when building a preview or staging artifact:

```sh
APP_URL=https://staging.example.com pnpm build
THEMYS_STAGING_ORIGIN=https://staging.example.com pnpm extension:build:staging
```

The build script uses a 3 GiB Node heap ceiling because Next's integrated
TypeScript pass exceeds Node's default heap for this repository. Set
`NODE_OPTIONS` explicitly to override it in a larger CI runner.

The app temporarily retains `src/middleware.ts` with the Edge runtime because
OpenNext Cloudflare does not yet support Next's Node-runtime `proxy.ts` path.
The release build verifies that this compatibility entrypoint is discovered;
migrate it when the adapter documents Node Proxy support.

The public API is intentionally unversioned today. Supported contracts are
documented under `/docs/api-overview` and validated by
`pnpm verify:release-config`; `/api/v1/scan` is not a supported route.

## Analysis providers

Set `JEV_API_KEY` or `TYPESAFE_API_KEY` as a server-side runtime secret to use
TypeSafe Jev for clause detection when a scan has no custom target clauses.
The key and document text are never sent to the browser. Without a TypeSafe
key, or when Jev fails validation, analysis uses the OpenRouter fallback.

`OPENROUTER_API_KEY` is also a server-side runtime secret. It is used for
structured extraction even when Jev handles clause detection, and for analysis
of custom target clauses or TypeSafe failures. OpenRouter requests set its
zero-data-retention provider routing flag. That flag applies to OpenRouter
requests; it is not a statement about TypeSafe's separate processing terms.

## Anonymous documentation feedback

Set both variables to enable Cloudflare Turnstile after three successful
anonymous feedback submissions per IP/device/hour:

- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (public widget key)
- `TURNSTILE_SECRET_KEY` (encrypted Worker secret)

The endpoint always enforces a ten-per-hour ceiling, a 4 KiB request-body cap,
known documentation slugs, and a 1,000-character comment limit. It writes to
Cloudflare D1 through the server-only binding; no database credential is
exposed to the browser. Raw feedback is deleted after 180 days by the hourly
Worker cron job.

Set `USAGE_FINGERPRINT_SECRET` as an encrypted Worker secret for first-party
anonymous page-view intake. Use a random value of at least 32 bytes. The
endpoint keys visitor fingerprints with this value, accepts only Cloudflare's
verified client-IP header, caps requests at 4 KiB, and throttles writes per IP.
The production Worker must also retain the `RATE_LIMIT_KV` binding declared in
`wrangler.jsonc`; the in-memory fallback is for local and degraded execution and
does not provide a durable cross-isolate production limit.

`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is required in two separate Cloudflare
surfaces: as a Worker runtime secret and as a Workers Builds variable. The build
variable lets Next.js compile the Clerk client, while the runtime binding lets
the deployed Worker serve authenticated routes. Confirm both by name without
printing their values.

## CI secrets

Authenticated Playwright gates require Clerk development-instance `pk_test_`
and `sk_test_` keys plus the remote Cloudflare D1/R2 credentials listed in
`.env.test.example`. Setup idempotently provisions a dedicated reserved test
user, so CI never needs manual sign-in. Add credentials as repository Actions
secrets; never commit their values.
