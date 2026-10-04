# Deployment runbook

This runbook takes the tested `develop` branch to hosted development, staging,
production, and store packaging. Do not use real staff data until the clinic
approves the operational-only boundary, vendors, region, retention, backups,
and incident response.

## Environment order

Use separate Supabase and Vercel projects for development, staging, and
production. Never copy synthetic accounts or
`ATTACHMENT_SCAN_MODE=dev_bypass` into staging or production. Historical MFA
bypass rows are inactive and must not be promoted.

Promote one reviewed commit through these environments:

1. Hosted development with synthetic accounts.
2. Staging with production controls and no real messages.
3. Production after approval and recovery evidence.

## Supabase

Apply all tracked migrations. Deploy both attachment functions and
`send-operational-notification` with JWT verification enabled. Create both
private 10 MiB buckets from `supabase/config.toml`.

Apply `20260802144218_phase_out_mfa.sql` before deploying the matching client.
Disable TOTP enrollment and verification in the target Supabase Auth settings
for this release. Do not delete existing user factors; they remain available
if the clinic restores MFA later.

Set these server-only finalizer secrets in development:

```text
ATTACHMENT_SCAN_MODE=dev_bypass
```

Set these server-only secrets in staging and production:

```text
ATTACHMENT_SCAN_MODE=clamav
ATTACHMENT_SCANNER_URL=https://SCANNER_HOST/scan
ATTACHMENT_SCANNER_SECRET=RANDOM_256_BIT_VALUE
VAPID_PUBLIC_KEY=PUBLIC_WEB_PUSH_KEY
VAPID_PRIVATE_KEY=SERVER_ONLY_WEB_PUSH_KEY
VAPID_SUBJECT=mailto:APP_OWNER_ADDRESS
```

The scanner URL and secret must never use a `VITE_` name. Rotate the shared
secret after staff changes, suspected exposure, or a scanner access incident.

## Test accounts and employees

The hosted development project contains the full 14-account matrix. The stable
account identifiers retain historical AAL-related names, but every account now
uses the same email-and-password flow. Re-run the hosted authorization matrix
after applying the phase-out migration.

The provisioner uses the Supabase Auth Admin API. Set the URL and service-role
key only for the command process. Do not save the service-role key in a browser
environment file. Use the following command only to rebuild another approved
development environment.

Create the 14-account development matrix:

```powershell
$env:SUPABASE_URL = "https://PROJECT.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "SERVER_ONLY_VALUE"
$env:PROVISIONING_ENVIRONMENT = "development"
npm run provision:test-accounts
Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY
```

The generated credential file is ignored by Git. It contains account email
addresses and passwords. Store it in the approved development password manager
after the test run.

Copy `scripts/employee-accounts.example.json` to the ignored
`.employee-accounts.local.json` file. Add only existing employees, then run:

```powershell
$env:ALLOW_PRODUCTION_PROVISIONING = "true"
npm run provision:employees
```

Review every role, location, department, expiry, and email before production.
The command is idempotent, but it is privileged.

## Attachment scanner

The `scanner/` image contains ClamAV and a small authenticated scan API. Build
and test it with:

```powershell
npm run scanner:build
```

Publish the image by digest to the approved registry. Deploy it with 2 GiB or
more memory, a startup probe on `/health`, the shared secret from a secret
manager, and no browser CORS access. The current Supabase integration uses an
application bearer secret, so restrict ingress further with an approved
gateway when the platform design supports service identity.

Enable `ATTACHMENT_SCAN_MODE=clamav` only after the EICAR rejection test and a
clean 7 MiB resumable upload both pass.

## Vercel PWA

Create a Vercel project from this repository and use:

```text
Build command: npm run build
Output directory: dist
Node.js: 22
```

Set these public production variables:

```text
VITE_REQUIRE_AUTH=true
VITE_ENABLE_ATTACHMENTS=true
VITE_ENABLE_ZALO_LAUNCHER=true
VITE_SUPABASE_URL=https://PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=PUBLIC_KEY
VITE_VAPID_PUBLIC_KEY=PUBLIC_WEB_PUSH_KEY
```

`vercel.json` supplies SPA fallback and security headers. Verify the content
security policy, deep links, `sw.js` cache policy, install prompt, update
prompt, session expiry, and network-only Supabase requests on the deployed
HTTPS URL.

The Zalo control opens the personal Zalo inbox in a managed side-panel popup.
Verify the panel opens beside the workspace on the deployed HTTPS URL, that a
second click re-focuses the existing panel, and that pop-up blocking surfaces
the localized guidance. Do not add a Zalo password or user token to Vercel or
Supabase. Use the
[Zalo integration decision](ZALO_INTEGRATION.md) for the tested product
boundary.

Deploy `send-operational-notification` with JWT verification. Enable
notifications only after its VAPID secrets are set and a real device proves
generic delivery, quiet hours, and invalid-subscription revocation.

Set `PUSH_ALLOWED_ORIGINS` for the notification function to the comma-separated,
exact HTTPS origins of the push services used by the supported desktop browsers.
Use canonical origins without paths, trailing slashes, credentials or wildcards;
verify each origin against the provider's documentation and actual subscription.
No provider is enabled by default. Missing or invalid configuration disables
dispatch, and queued deliveries outside those origins are cancelled.
This prevents member-editable subscriptions from directing backend requests to
arbitrary destinations.

Apply the durable notification queue migration before deploying the enqueue
function and `deliver-operational-notifications` worker. The worker disables
gateway JWT verification because it authenticates a dedicated server-only
`PUSH_WORKER_SECRET` from the `x-notification-worker-secret` header before
creating a privileged client. Keep the user-facing enqueue function's JWT
verification enabled. All queue RPCs are service-role-only; recipients and
membership validity are rechecked when work is claimed.

Set `PUSH_WORKER_SECRET`, `PUSH_DELIVERY_LEASE_SECONDS`, and
`PUSH_DELIVERY_RETRY_SECONDS` alongside the existing VAPID and origin settings.
The owner delegated the timing choice: configure a 60-second retry and a
once-per-minute worker schedule to balance prompt alerts with polling cost.
Configure the lease to 400 seconds, matching the documented maximum paid worker
wall lifetime (free workers have a 150-second lifetime), so an ordinary overlapping
invocation cannot reclaim a live worker's delivery. See
[Supabase Edge Function limits](https://supabase.com/docs/guides/functions/limits).
These values are explicit in `.env.example`; the function still rejects missing
configuration. Lease duration must fit the Node socket timeout representation
(signed 32-bit milliseconds); retry duration must fit the PostgreSQL integer RPC
parameter. Invoke the worker from a trusted scheduler;
never ship its secret to either client. Deployment and scheduling are separate
release steps; no hosted scheduler is configured by editing these files.

The queue records one recipient snapshot per message and one delivery per
subscription. Transient failures retry at the configured interval or the
provider's longer `Retry-After`; quiet hours suppress delivery without retry,
preserving the existing notification preference behavior. Provider 404/410
revokes the subscription, lost access cancels delivery, and invalid destinations
or preferences and provider 400 cancel that delivery. Provider 401/403 persists
a retry and stops that invocation's drain to avoid repeating configuration failures
across every subscriber. Each invocation drains only work due at its start, so
new arrivals and retries belong to a later invocation. No attempt cap, delivery-age cutoff, or
retention deletion is introduced. Crashed workers release work when leases
expire; fencing tokens prevent stale acknowledgements. A provider may accept a
push before the worker crashes, so retry delivery can duplicate that notification.
The existing channel tag remains, but is not an exactly-once guarantee.

The public `send_message_with_attachments` RPC saves the message and enqueues
notifications in one transaction. An enqueue failure rolls back the send; a
client retry preserves the message and queue idempotency. The browser no longer
makes a second Edge Function request for each message. Internal task/meeting
helpers still call the unchanged private send helper, so the queue does not
silently start notifying those message types. The enqueue Edge Function remains
an authenticated, idempotent compatibility endpoint.

## PWABuilder and stores

After the production HTTPS URL passes the PWA checks, enter it in
[PWABuilder](https://www.pwabuilder.com/). Review manifest and service-worker
warnings, then create the required store packages. Keep the package identity
`com.yksg.messenger`.

Use PWABuilder for the Android and Windows packages. Use the tracked Capacitor
iOS project for Apple signing and native review. Store submission still needs
organization accounts, signing keys, privacy disclosures, screenshots,
reviewer access, supported-device tests, and an approved distribution method.

No source-code change can complete those account and approval gates.

## Release evidence

Record the scoped React Router audit exception with each release:
`npm audit --omit=dev` reports the RSC-mode CSRF advisory, but this application
does not ship React Server Components, server actions, or the React Router
server runtime. Re-evaluate the exception whenever React Router changes.

Attach these results to the release:

- Frontend tests, type-check, lint, and production build.
- pgTAP, Realtime, resumable upload, promotion, signed download, and DB lint.
- Hosted email-and-password tests for every allowed and denied test account.
- Scanner clean-file and EICAR evidence.
- Backup restoration and incident-response drill evidence.
- PWA install, update, offline, and notification evidence on Android and iOS.
- Store signing, privacy, and reviewer records.
