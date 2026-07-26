# Production database, authentication, onboarding, and PWA roadmap

This roadmap replaces the preview's in-memory state with a production system
without creating separate web and mobile products. The current product boundary
remains operational coordination only: it is not approved for patient details
or clinical records.

## Recommended release shape

Ship an authenticated PWA to staff first, while keeping the existing Capacitor
iOS and Android projects release-ready. Both surfaces should use the same React
application, API contracts, authorization policies, and deployment pipeline.

Use a managed Postgres backend for the first production release. Supabase is the
fastest fit for this codebase because it combines Postgres, Auth, Storage, and
Realtime and can enforce authorization with Postgres row-level security (RLS).
Treat this as a recommendation, not a procurement decision: clinic leadership,
IT, privacy, and legal still need to approve the data region, contract/DPA,
retention, backups, incident response, and the no-patient-data boundary.

Do not put a database password, service-role key, storage secret, push private
key, or third-party token in a `VITE_` variable. The browser receives only the
backend URL and a publishable client key. Privileged actions belong in a trusted
server function or API.

## Current implementation status

As of July 26, 2026, the local Phase 0 backend spike, the first protected
Phase 1 flows, and the authenticated Chat, Inbox, and private message
attachment slices of Phase 2 are implemented. The user-designated hosted
development backend now has the same six tracked migrations as the
repository. Authenticated Chat and Inbox use the Supabase repositories;
unfinished modules still use synthetic `ClinicProvider` data only in the
preview path.

The completed repository and development-backend slice includes:

- Six tracked imperative migrations for identity, assignments, scoped roles,
  onboarding, channels, messages, attachment metadata and linkage, audit
  events, Realtime publication, composite foreign-key indexes, and an
  expiring development MFA test exception.
- Tenant-consistent composite foreign keys, server-controlled update
  timestamps, explicit Data API grants, AAL2 restrictions, and RLS for active,
  suspended, expired, scoped-manager, channel-member, view-only, outsider, and
  audit-reader cases.
- Protected routes for signed-out, MFA, onboarding, active, suspended, expired,
  and authorization-error states. Production mode removes the persona selector.
- A transactional onboarding function that updates the signed-in member's
  profile and preferences, stamps policy acceptance in the database, and
  appends metadata-only audit evidence.
- A production messaging repository and `MessagingProvider` for scoped channel
  discovery, member profiles, keyset-paginated reads, idempotent sends, and
  RLS-protected Realtime cache updates. The authenticated Chat and Inbox routes
  use this boundary; preview routes retain the in-memory repository.
- Two private 10 MiB Storage buckets with the approved document and image MIME
  allowlist. TUS uploads enter quarantine, while a trusted Edge Function owns
  development promotion into the available bucket.
- An atomic message-and-attachment RPC, 60-second signed downloads, resumable
  six MiB chunks, upload progress and cancellation, and explicit
  “Unscanned — development only” labeling.
- Fifty-three Vitest tests, one hundred pgTAP assertions, database lint, local
  security and performance advisors, and repeatable Realtime and attachment
  integration tests. The attachment test uploads seven MiB, promotes it,
  links it atomically, downloads it through a signed URL, and removes all test
  data.
- A hosted development deployment with 20 empty public tables, RLS on all 20,
  47 public-schema policies, 20 restrictive AAL2 policies, no anonymous
  attachment grants, and the `messages` table in the Realtime publication.
- Two active hosted Edge Functions with JWT verification enabled. They remain
  fail-closed until the development-only scan-mode secret is configured.
- An expiring, per-user hosted MFA bypass for the sole existing test identity.
  It expires on August 2, 2026 at 09:50 UTC, logs first use per Auth session,
  and leaves every non-allowlisted AAL1 identity denied.
- A rolled-back hosted RLS smoke test covering authorized sends, author-spoof
  denial, idempotency, view-only denial, cross-organization isolation, and AAL1
  denial. It left no synthetic public or Auth rows.
- Hosted performance advisors with no missing foreign-key indexes. The
  remaining unused-index notices are expected while every public table is
  empty.
- A hosted security-advisor warning that leaked-password protection is
  disabled. This is an accepted Free-plan development limitation, not a
  blocker for synthetic development identities. Revisit it before production
  if the selected plan supports the feature.

The local browser suite isn't fully green. Its latest desktop run passed nine
functional and accessibility tests, skipped two phone-only tests, and failed
three stale visual snapshots with 2% text-rendering differences. Review the
rendered change before updating those baselines.

The next implementation boundary is:

- Set `ATTACHMENT_SCAN_MODE=dev_bypass` only in the hosted development Edge
  Function secrets, run the hosted attachment flow, and then enable
  `VITE_ENABLE_ATTACHMENTS=true` for that development client.
- Create approved synthetic development identities through the Auth Admin API.
- Run real hosted sign-in, TOTP AAL2, onboarding, suspension, expiry,
  Realtime, resumable upload, promotion, and signed-download scenarios. The
  SQL-level authorization smoke test doesn't replace real-session checks.
- Move the People directory and Tasks module behind database contracts and RLS
  before enabling them in authenticated production mode.
- Integrate an approved malware scanner before staging or production. Any mode
  other than explicit `dev_bypass` must keep promotion and bypassed downloads
  disabled.
- Complete the governance decisions below before production configuration,
  real data migration, or staff rollout.

## Implementation evidence

Use these repository artifacts to review the claims in the status section:

- [Identity and access migration](../supabase/migrations/20260726030746_create_identity_and_access.sql)
- [Core messaging migration](../supabase/migrations/20260726041002_create_core_messaging.sql)
- [Foreign-key index migration](../supabase/migrations/20260726081637_add_foreign_key_indexes.sql)
- [Private attachment migration](../supabase/migrations/20260726092300_create_private_attachments.sql)
- [Development MFA bypass migration](../supabase/migrations/20260726094939_add_development_mfa_bypass.sql)
- [Development MFA bypass index migration](../supabase/migrations/20260726095217_index_development_mfa_bypass_creator.sql)
- [Database policy tests](../supabase/tests/database)
- [AAL2 and Realtime integration test](../supabase/tests/integration/realtime.mjs)
- [Private attachment integration test](../supabase/tests/integration/attachments.mjs)
- [Authentication state machine](../src/state/AuthContext.tsx)
- [Supabase messaging repository](../src/services/supabaseMessagingRepository.ts)
- [Supabase attachment repository](../src/services/attachmentRepository.ts)
- [Attachment Edge Functions](../supabase/functions)
- [Messaging query and Realtime boundary](../src/state/MessagingContext.tsx)
- [Messaging boundary tests](../src/test/messaging-context.test.tsx)

## Decisions required before staged rollout

Local implementation can continue while these decisions are open, but no
hosted production configuration, real staff data, or pilot rollout can proceed
until the accountable clinic stakeholders resolve them.

1. Confirm that production remains operational-only and define the escalation
   process when patient information is posted accidentally.
2. Select the primary identity provider: Microsoft Entra ID or Google Workspace
   SSO is preferred; invitation-only email magic links plus mandatory MFA are a
   workable initial fallback.
3. Select the hosting region and approve the vendor DPA, retention schedule,
   backup/PITR tier, recovery objectives, log retention, and support-access
   process.
4. Name the systems of record for staff identity, assignments, scheduling, and
   offboarding.
5. Define whether mobile distribution is public App Store/Play Store, private
   organization distribution, or PWA-only for the first release.

## Target data model

Use UUID primary keys and include `organization_id`, `created_at`, `updated_at`,
and where appropriate `archived_at` on every tenant-owned record. Normalize
scope relationships instead of storing arrays in production. The status column
distinguishes the local database implementation from the remaining target.

| Area | Tables | Status |
| --- | --- | --- |
| Identity | `profiles`, `organizations`, `organization_members`, `invitations`, `onboarding_progress` | Local and hosted development |
| Structure | `locations`, `departments`, `assignments`, `role_bindings`, `role_binding_locations`, `role_binding_departments` | Local and hosted development |
| Chat | `channels`, `channel_locations`, `channel_departments`, `channel_memberships`, `messages`, `message_receipts` | Local and hosted development |
| Work | `tasks`, `task_collaborators`, `task_checklist_items`, `meetings`, `meeting_responses` | Planned |
| Files | `attachments`, `message_attachments`, and private channel-scoped object paths | Local and hosted development; client gated |
| Publishing | `announcements`, `announcement_audiences`, `announcement_acknowledgements` | Planned |
| Governance | `access_requests`, `audit_events`, `policy_warning_events`, `notification_preferences`, `push_subscriptions` | `audit_events` in local and hosted development; remaining tables planned |

Use append-only audit records for access, membership, role, announcement,
warning, export, and break-glass events. Audit warning metadata, not the flagged
message content. Decide message editing/deletion and retention semantics before
writing those migrations.

### Minimum RLS invariants

Every implemented tenant-owned table must preserve these authorization rules.

- A user can read an organization row only while their organization membership
  is active.
- A user can read channel content only while an unexpired channel membership or
  approved policy-derived membership exists.
- A user can insert a message only with `author_id = auth.uid()` and active send
  access to that channel.
- Location managers and department leads can mutate only records inside their
  active scopes. Organization authority is explicit, not inferred in the UI.
- Storage object paths and metadata use the same channel membership checks.
- Realtime subscriptions expose only rows the subscriber can select.
- Service-role credentials never reach a browser or Capacitor bundle.

The current pgTAP suites cover the implemented identity and messaging roles,
including negative authorization cases. Add database tests with each remaining
role or scope before connecting its UI workflow. The database policies, not the
React permission helpers, are the source of enforcement.

## Application boundary changes

`ClinicProvider` still owns preview data and unfinished module mutations in
React state. Replace it incrementally, rather than rewriting screens. The
boundary work now has the following status:

1. **Completed:** Use `AuthProvider` for loading, signed-out, MFA, onboarding,
   active, suspended, expired, and authorization-error states. Production mode
   hides the preview persona selector.
2. **Completed for core messaging:** Use repository interfaces plus TanStack
   Query for channels, member profiles, keyset pagination, idempotent sends,
   and Realtime cache updates. Authenticated Chat and Inbox use this path after
   session establishment, while the preview path retains seed data.
3. **Completed for development message attachments:** Use a production
   attachment repository for TUS quarantine uploads, trusted development
   promotion, atomic message linkage, and short-lived downloads. The client
   feature stays disabled until hosted secrets and real-session tests pass.
   Task attachments remain preview-only.
4. **Next:** Add durable directory and task repositories, RLS policies, query
   keys, and UI boundaries. Keep People and Tasks synthetic until those
   contracts are tested.
5. **Partially completed:** Keep onboarding completion transactional in the
   database. Add trusted workflows for derived memberships, invitations,
   assignment changes, offboarding, and announcements before enabling their
   production UI.

Create separate backend projects for local development, staging, and
production. Store schema and RLS changes as reviewed migrations; use synthetic
seed data only outside production. CI should apply migrations to an ephemeral
database, run policy tests, then build the web and Capacitor artifacts.

## Authentication and onboarding flows

Public self-signup is disabled in the local configuration and the configured
hosted project. The current UI supports administrator-created email/password
accounts, TOTP MFA, session restoration, and onboarding. Invitation acceptance,
SSO or Auth0 token bridging, organization setup, and automated offboarding are
not implemented.

### Development-only MFA bypass

The connected development project has a temporary test exception. It doesn't
modify or forge the Supabase `aal` JWT claim. Instead, the shared database MFA
gate accepts an AAL1 session only when the signed-in user has an unexpired row
in `private.development_mfa_bypasses`.

The exception is fail-closed:

- The migration creates no allowlist entries.
- Each entry is user-specific and limited to seven days.
- Authenticated clients can't read or write the allowlist or event ledger.
- The frontend requires `VITE_ENABLE_MFA_BYPASS=true` before requesting the
  bypass and displays its expiry while active.
- Tenant, membership, channel, sender, suspension, and expiry rules still
  apply.

Remove the allowlist row and keep the client flag false before any staging or
production deployment.

The target flow starts when an administrator or approved directory sync creates
an invitation with organization, role, location, department, employment type,
start time, and optional expiry.

The staff flow is:

1. Open invitation and authenticate with SSO, or verify an invitation-only
   magic link.
2. Enroll and verify MFA if the identity provider does not already enforce an
   approved second factor.
3. Confirm name and work contact details; identity and assignment fields owned
   by HR/IT stay read-only.
4. Accept acceptable-use, privacy, notification, and “no patient details”
   guidance with policy-version timestamps.
5. Choose language, primary location when more than one assignment exists,
   quiet hours, and notification preferences.
6. Create policy-derived memberships transactionally, show the user's initial
   channels, and offer PWA installation. Ask for notification permission only
   after an explicit user action.

The organization setup wizard is separate from staff onboarding:

1. Organization identity, locale, time zone, and owner recovery account.
2. Locations and departments.
3. Identity provider, allowed email domains, session policy, and MFA policy.
4. Role and scope mapping with a permission-preview screen.
5. Default channels, owners, archive rules, retention, and safety guidance.
6. Storage limits, notification defaults, integrations, and support access.
7. Invite a small pilot cohort and run a readiness check before enabling all
   staff.

Offboarding must revoke the identity immediately, end assignments and role
bindings, remove active channel access, revoke sessions and push subscriptions,
transfer owned work, and preserve the audit trail.

## PWA and native release plan

The repository now includes an initial web app manifest and standalone/mobile
metadata. Before calling the PWA production-ready:

1. Generate reviewed 192px and 512px PNG icons plus an Apple touch icon from the
   source logo; keep the SVG as a scalable fallback.
2. Serve the production site over HTTPS with SPA route fallback, strict security
   headers, a tested content-security policy, and no third-party widget on
   authenticated conversation routes unless privacy approves it.
3. Add a versioned service worker. Cache only the fingerprinted application
   shell and safe static assets at first. Keep authenticated API calls,
   attachments, and message bodies network-only until an explicit encrypted
   offline-data threat model and remote-wipe design are approved.
4. Add an in-app update prompt so a waiting service worker cannot leave staff on
   an incompatible frontend.
5. Add standards-based Web Push with per-device subscriptions, quiet hours,
   generic notification text, revocation, and server-side authorization. Do not
   include message content in lock-screen notifications by default.
6. Test install, update, session expiry, notification, keyboard, safe-area, and
   poor-network behavior on current Android and iOS devices.

For the first internal rollout, the PWA is the better delivery channel: it is
faster to update, avoids store-review lead time, and is sufficient for this
web-first application. Do not abandon the app stores. The tracked Capacitor
projects already let the same codebase add native push, secure credential
storage, biometrics, managed distribution, and a store presence later.

Before submitting the Capacitor wrapper to Apple, add useful native integration
instead of shipping a bare website wrapper. Native push settings, biometric
unlock, secure storage, document handling, and a clear offline/network state are
appropriate additions for this product.

## Implementation progress

The phases remain ordered by dependency. Checkboxes report repository status,
not production approval or hosted deployment status.

### Phase 0 — governance and backend spike

This phase establishes the approval boundary and proves the backend assumptions.

- [ ] Resolve the five governance decisions above.
- [x] Create the local backend configuration and six tracked migrations.
- [x] Connect the Supabase MCP and compare hosted tables, migration history,
  logs, and advisors without changing the project.
- [x] Classify the configured hosted project as development, deploy the six
  repository migrations, and preserve the local migration timestamps.
- [x] Verify hosted RLS, grants, Realtime publication, foreign-key indexes, and
  transactional sender, view-only, outsider, and AAL1 cases.
- [x] Prove active-member, scoped-manager, denied-outsider, suspended, expired,
  AAL2, view-only, and audit-reader RLS cases locally.
- [x] Prove AAL2 session restoration, RLS insertion, and Realtime delivery in a
  local integration test.

### Phase 1 — auth and organization setup

This phase establishes trusted staff identity and organization lifecycle flows.

- [x] Add protected routes and the auth state machine.
- [x] Add TOTP MFA enrollment and verification, session restoration, and
  transactional staff onboarding.
- [x] Add an expiring, per-user MFA bypass for development testing with a
  visible warning and private session-use ledger.
- [ ] Build invitation acceptance, the selected SSO callback or Auth0 token
  bridge, and the organization setup wizard.
- [ ] Implement transactional membership derivation, assignment changes, and
  offboarding.

### Phase 2 — durable core messaging

This phase replaces synthetic messaging state with authorized durable data.

- [x] Add local Postgres schemas for directory foundations, channels,
  memberships, messages, receipts, and metadata-only audit events.
- [x] Add a tested production repository for authorized Realtime updates,
  keyset pagination, and idempotent message sends.
- [x] Replace authenticated Chat and Inbox channel/message state with the
  production repositories while keeping preview mocks for isolated UI tests.
- [x] Add composite indexes for every hosted foreign-key coverage warning.
- [ ] Move directory queries and tasks to Postgres.
- [x] Add private message attachments with scoped Storage policies, resumable
  uploads, trusted development promotion, and signed downloads.
- [ ] Replace the explicit development bypass with approved malware scanning
  before staging or production.
- [ ] Keep meetings and announcements behind feature flags until their policies
  and transaction paths are tested.

### Phase 3 — PWA pilot

This phase prepares one controlled department for a hosted PWA pilot.

- [ ] Add the service worker, install education, web push, update UX,
  monitoring, backups, recovery drills, and staging-to-production promotion.
- [ ] Pilot with one department at one location before organization-wide
  rollout.

### Phase 4 — store packaging

This phase adds the native capabilities and evidence required for distribution.

- [ ] Add native security and push integrations, signing and store records,
  privacy disclosures, reviewer access, device tests, and staged release
  channels.
- [ ] Continue deploying the same built web application to PWA and Capacitor.
  Don't create a separate React Native fork unless a future requirement
  genuinely cannot be met by Capacitor.

## Immediate next milestone

The next milestone is a real-session hosted development messaging path.
Complete these steps in order:

1. Set `ATTACHMENT_SCAN_MODE=dev_bypass` in hosted development Edge Function
   secrets. Never set it in staging or production.
2. Provision synthetic organization and membership data for approved
   development identities. Verify both the temporary AAL1 bypass and real TOTP
   AAL2, plus onboarding, suspended access, expired access, and outsider denial.
   Treat leaked-password protection as a deferred Free-plan limitation.
3. Exercise Chat, Inbox, Realtime, a file larger than six MiB, development
   promotion, atomic message linkage, and signed download against hosted
   development.
4. After that flow passes, set `VITE_ENABLE_ATTACHMENTS=true` only for the
   development client.
5. Move directory reads and Tasks behind tested repository and RLS boundaries.
6. Review the three desktop visual diffs before accepting new baselines; keep
   the functional, accessibility, unit, database, integration, and build gates
   green.

## Production exit criteria

The local and hosted development slices provide evidence for portions of the
first, second, and fourth criteria, but no criterion is complete until it
passes in staging and the named stakeholders approve the release.

- Authorization/RLS tests pass for every role and scope, including expired and
  offboarded users.
- No privileged credential appears in the browser bundle, repository, logs, or
  CI artifacts.
- Backups and restoration are tested; alerting, audit review, incident response,
  and vendor contacts have named owners.
- Message pagination, reconnect, duplicate-send prevention, upload failure, and
  session expiry are tested on weak networks.
- PWA install/update/push and Capacitor deep-link/session behavior are tested on
  supported iOS and Android versions.
- Privacy, security, and clinic leadership sign off on the operational-only
  launch scope and staff training.

## Implementation references

These sources define the current platform and release practices used by this
roadmap.

- [Supabase Postgres and database operations](https://supabase.com/docs/guides/database/overview)
- [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase production checklist](https://supabase.com/docs/guides/deployment/going-into-prod)
- [Supabase local development workflow](https://supabase.com/docs/guides/local-development/cli-workflows)
- [Supabase database migrations](https://supabase.com/docs/guides/deployment/database-migrations)
- [Supabase database testing](https://supabase.com/docs/guides/local-development/testing/overview)
- [Supabase password security](https://supabase.com/docs/guides/auth/password-security)
- [Supabase Auth](https://supabase.com/docs/guides/auth),
  [MFA](https://supabase.com/docs/guides/auth/auth-mfa), and
  [SAML SSO](https://supabase.com/docs/guides/auth/enterprise-sso)
- [MDN PWA installability](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)
- [WebKit web push for Home Screen apps](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
- [Capacitor web/native runtime](https://capacitorjs.com/docs)
- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
