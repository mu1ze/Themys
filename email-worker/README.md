# Themys monitoring email Worker

This Worker is the only component allowed to call Cloudflare Email Sending.
The main app invokes it through a private Cloudflare service binding; the
Worker validates the payload and uses a Durable Object keyed by the delivery
idempotency key to serialize sends before calling `SEND_EMAIL`. The production
Worker has no public `workers.dev` endpoint.

## Configure and deploy

1. Authenticate Wrangler with `npx wrangler login`, or provide a scoped API
   token and account ID in the deployment environment. The token is used only
   by Wrangler and is never stored in this repository (`CLOUDFLARE_ACCOUNT_ID`
   and `CLOUDFLARE_API_TOKEN`).
2. Configure an Email Sending destination and verify the
   `alerts@themys.ca` sender domain in Cloudflare.
3. Deploy staging with `pnpm email-worker:deploy:staging`. The command fails
   closed if Wrangler is not authenticated or the Durable Object migration is
   missing.
4. Deploy production with `pnpm email-worker:deploy:production`. The root
   Worker's `MONITORING_EMAIL_WORKER` service binding connects to this Worker;
   no URL or shared email secret is required.

For the final production smoke, use a disposable authenticated Themys account,
create a monitoring subscription, cause one controlled document change, and
confirm the alert email arrives. Toggle email notifications off for the same
subscription and confirm a subsequent change does not send another message.
The app's database claim and the email Worker's Durable Object together ensure
retries do not create duplicate sends.

## Verification

Run the Worker unit tests and configuration checks before deployment:

```sh
pnpm test:unit
pnpm email-worker:verify:production
```

The production smoke test was completed through the main app's monitoring
queue and private service binding. The alert was marked sent by the database,
and the temporary test subscription, snapshot, and alert were removed after
verification.

The main app supplies `MONITORING_EMAIL_FROM` (defaults to
`alerts@themys.ca`). Provider secrets belong in Worker bindings only; never put
them in `NEXT_PUBLIC_*` variables or extension files.
