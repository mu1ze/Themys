# Contributing

Bug fixes, documentation corrections, accessibility improvements, and focused
tests are welcome. For a large feature or architectural change, open an issue
describing the problem and proposed behavior before implementing it.

## Local setup

Follow [README.md](README.md). You can run unit, contract, and shared Safari
tests without any credentials. Running the UI requires your own Clerk
development instance; real scans require your own provider key. Never request
or reuse production credentials, customer data, or maintainer accounts.

Use Node 24 (`nvm use` if you use nvm) and the pnpm version in `package.json`.
Keep the relevant lockfile with dependency changes. `docs/` and `admin/` have
separate installs:

```sh
pnpm --dir docs install --frozen-lockfile
pnpm --dir docs dev
# Optional admin work:
pnpm --dir admin install --frozen-lockfile
```

The admin app uses keys from `admin/.env.local` and needs your own Clerk user
ID in `ADMIN_CLERK_IDS`. Its local database state is separate from the root
app's state; initialize it with `pnpm --dir admin d1:migrate:local`.

This repository uses a newer Next.js version. Before changing framework code,
read the relevant guide shipped in that package's `node_modules/next/dist/docs/`
and follow [AGENTS.md](AGENTS.md).

## Before opening a pull request

1. Create a focused branch and preserve unrelated work.
2. Add a regression test when changing behavior. Use synthetic fixtures rather
   than captured user content or signed-in browser state.
3. Run the checks relevant to your change:

| Change | Checks |
| --- | --- |
| Main app or API | `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm verify:release-config` |
| Repository tooling | `pnpm test:repo`, `pnpm secrets:scan` |
| Documentation app | `pnpm --dir docs lint`, `pnpm --dir docs typecheck`, `pnpm docs:build`, `pnpm --dir docs verify:export` |
| Shared detection or Safari resources | `pnpm ios:test`, `pnpm ios:sync`; include synchronized resources |
| Browser extension | `pnpm extension:validate:prod`; follow `EXTENSION_RELEASE_CHECKLIST.md` |
| Admin app | `pnpm --dir admin lint`, `pnpm --dir admin typecheck`, `pnpm --dir admin test:metrics` |

For a main app production build, set `APP_URL` to your own HTTPS origin.
Builds may need network access for fonts and dependencies. A build does not
prove deployed authentication, billing, or provider behavior.

Authenticated E2E tests can create users, spend provider credits, and mutate
remote test data. Follow [TESTING.md](TESTING.md) and `.env.test.example` using
dedicated development/test services. Normal fork PR checks do not receive
maintainer secrets. Live acceptance is a separate maintainer operation.
This repository runs validation workflows without production credentials.
Deployment and live acceptance must be configured deliberately against your
own infrastructure; public contributions do not deploy the hosted service.

4. Describe the concrete problem, resulting behavior, and validation in the
   pull request. Include screenshots for visible UI changes, after checking for
   personal data, tokens, and account identifiers.

## Credentials and security

Only commit empty/example environment templates. `.gitignore` cannot protect
a file that was already tracked. Never commit private keys, `.dev.vars`,
database dumps, Playwright auth state, production exports, or real credentials
inside tests, screenshots, HTML captures, or videos.

Install Gitleaks 8.30.1 and run `pnpm secrets:scan` before submitting changes.
The CI history scan deliberately fails on actual credentials; do not add a
baseline or an exception to hide one. Report accidental credential exposure
privately using [SECURITY.md](SECURITY.md).

Be respectful, give actionable feedback, and explain disagreements with code
or reproducible evidence. Contributions are provided under the repository's
existing [MIT license](LICENSE).
