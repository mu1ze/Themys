# Themys

Themys analyzes terms of service and privacy
policies, highlights clauses with source references, and keeps a history of
documents you review. It includes a web app, developer API, document monitoring,
and browser/Safari clients. Analysis is informational and is not legal advice.

This public repository starts from a reviewed source snapshot with fresh Git
history. The hosted service is deployed separately; merging a contribution here
does not automatically release it to production.

## Start contributing without credentials

Use Node.js 24 and pnpm 10.33.0 (the version pinned in `package.json`).

```sh
git clone https://github.com/mu1ze/Themys.git
cd Themys
pnpm install --frozen-lockfile
pnpm test
pnpm test:repo
pnpm ios:test
```

These tests use local fixtures and fakes. They do not require maintainer
credentials. This checkout has separate package installs in `docs/` and `admin/`;
it is not a pnpm workspace.

## Run the web app

1. Copy `.env.example` to `.env.local`.
2. Add the publishable and secret keys from **your own Clerk development
   instance**. Configure its local application origin for your dev server.
3. Initialize the local database and start Next.js:

```sh
pnpm d1:migrate:local
pnpm dev
```

Open `http://localhost:3000`. D1, R2, and KV run locally through Wrangler; local
Next.js development disables remote bindings, including in the admin app.
Clerk authentication still uses your development instance. There is currently
no complete offline UI/demo mode. Real analysis requires your own
`OPENROUTER_API_KEY` and can incur provider costs. Optional features and their
keys are described in `.env.example` and [ENVIRONMENTS.md](ENVIRONMENTS.md).

Billing is optional for ordinary development. `pnpm dev:stripe` explicitly
starts Stripe CLI webhook forwarding for billing work. Use test-mode credentials.

Deployment configuration describes the maintainer's hosted installation.
Cloudflare resource IDs and public widget keys are identifiers, not access
credentials. Before deploying a fork, replace domains, resource IDs, bucket and
service names, public keys, and origin settings with your own resources. Use
[DEPLOYMENT.md](DEPLOYMENT.md); local setup does not authorize access to the
hosted service or its data.

## Repository map

| Path | Purpose |
| --- | --- |
| `src/app/`, `src/lib/` | Web routes, API routes, and shared server logic |
| `src/contracts/` | Developer API contract tests |
| `d1/migrations/` | Current Cloudflare D1 schema and reference seeds |
| `supabase/migrations/` | Historical schema for legacy migration tooling |
| `custom-worker.ts`, `wrangler.jsonc` | OpenNext/Cloudflare runtime and bindings |
| `docs/` | Documentation app, with its own install and lockfile |
| `admin/` | Separate admin app, with its own install and lockfile |
| `extension/`, `artifacts/extension/` | Extension tooling and canonical reviewed bundles |
| `packages/tos-detection/` | Shared browser document detection |
| `ios/`, `macos/` | Native apps and Safari extension hosts |
| `email-worker/` | Monitoring email Worker |
| `e2e/` | Browser tests; authenticated suites require dedicated test services |

The unpacked bundles in `artifacts/extension/` are deliberately tracked; do not
delete them as generic build output. See [extension/README.md](extension/README.md)
and [ios/README.md](ios/README.md) before changing shared extension resources.

## Checks and contribution guides

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm test:repo
pnpm verify:release-config
pnpm secrets:scan
```

`secrets:scan` requires [Gitleaks 8.30.1](https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1).
It scans tracked and non-ignored files without reading ignored local credentials.
`pnpm secrets:history` additionally scans all locally available Git refs.
Both checks run in CI without maintainer credentials.

Read [CONTRIBUTING.md](CONTRIBUTING.md) for scope, tests, and pull requests,
[SECURITY.md](SECURITY.md) for private vulnerability reporting, and
[ARCHITECTURE.md](ARCHITECTURE.md) for runtime details. Code is licensed under
the [MIT license](LICENSE).
