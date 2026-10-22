# Security release policy

## Report a vulnerability privately

Do not put credentials, exploitable details, customer content, or browser auth
state in a public issue or pull request. Use the repository's private
[vulnerability reporting form](https://github.com/mu1ze/Themys/security/advisories/new)
when enabled. If that form is unavailable, contact [admin@themys.ca](mailto:admin@themys.ca)
(the hosted site's support contact) and request a private
reporting channel before sharing sensitive details. Do not post the report
publicly as a fallback.

Include the affected commit/version, impact, minimal reproduction using
synthetic data, and any proposed fix. Only the current main branch is supported;
there is no guaranteed response SLA.

If a real credential enters Git history, revoke or rotate it first. Removing
the file or adding an ignore rule does not remove the earlier commit. See
[GitHub's sensitive-data removal guide](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository).
Never test a suspected credential against the hosted service without permission.

## Source credential checks

Run `pnpm secrets:scan` with Gitleaks 8.30.1 to inspect source candidates, and
`pnpm secrets:history` to include all locally available refs. CI fetches full
history and runs both, with fully redacted output and no credential report
uploaded as an artifact. Local ignored environment files are excluded from
the source snapshot. Actual credentials must be removed, not suppressed with
an allowlist. Exact documentation placeholders may be reviewed exceptions.

This repository has fresh Git history. Keep private deployment credentials,
internal records, and unreviewed browser captures outside public source exports.

## Dependency release policy

Production releases are blocked by moderate, high, or critical dependency
advisories. The mandatory OSV Scanner job evaluates the committed pnpm lockfile
on every pull request and main-branch push. Dependabot opens grouped weekly
updates.

## Dependency evidence

### Known upstream blocker (October 22, 2026)

The OSV gate reports [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
in `braces@3.0.3`. No patched release is available. In the root package this
enters through the development-only chain
`eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob` → `micromatch` →
`braces`; it is absent from the production dependency graph. The issue is
stack exhaustion when parsing deeply nested glob patterns. Do not route
untrusted runtime input through this tooling.

This is not an accepted exception: the OSV check remains failing until the
upstream issue is fixed or the dependency is safely removed. Unit tests,
type checks, builds, and credential scans run independently. Contributors do
not need maintainer credentials to run those checks.

The public web, documentation, and admin packages use Next.js 16.4.1, which
patches [GHSA-2464-fhr4-w9xw](https://github.com/advisories/GHSA-2464-fhr4-w9xw)
and [GHSA-p3m5-59mp-jv5r](https://github.com/advisories/GHSA-p3m5-59mp-jv5r).
This source update does not establish that the separately deployed hosted
service has received the same update.

There are no standing vulnerability or audit-transport exceptions. A release
record must include both the OSV lockfile result and a registry-connected
production audit:

```sh
pnpm audit --prod --json
```

The CI `pnpm audit:prod` command surfaces registry errors without replacing the
mandatory OSV job. A registry or DNS error is an unavailable check, not a clean
audit. On September 22, 2026, pnpm 10.33.0 completed the registry-connected
production audit with zero known advisories across 307 production dependencies.

Any future vulnerability exception must be a reviewed change that names the
advisory, owner, rationale, compensating control, and an expiry no more than 30
days away.

## Accepted follow-up hardening

The production Content Security Policy still permits inline scripts and styles
for current Next.js, Clerk, Stripe, and application compatibility. The policy
removes unneeded analytics hosts, blocks object embedding and framing, and keeps
JavaScript `unsafe-eval` development-only. Moving to per-request nonces and
removing both `unsafe-inline` tokens is tracked hardening and requires a full
authenticated browser regression because nonces force dynamic rendering.

The browser extension currently stores a normal short-lived Clerk session JWT.
The web app sends it only through the browser's allowlisted external-extension
channel, and the service worker verifies the exact application origin and
`/extension-auth` path. A one-time exchange for an extension-scoped credential
would reduce token capability further and remains a post-launch hardening item.
