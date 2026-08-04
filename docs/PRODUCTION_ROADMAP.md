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

As of August 2, 2026, the durable application foundation is implemented on the
`develop` branch. The repository has fourteen tracked migrations; the hosted
development backend has the first thirteen and three JWT-protected Edge
Functions. Apply the MFA phase-out migration before deploying the matching
frontend. Authenticated Chat, Inbox, directory, Tasks, Meetings,
announcements, account settings, and supported administration paths use
Supabase. Synthetic data and the floating role panel remain available only
when `VITE_REQUIRE_AUTH=false`.

The completed repository and development-backend slice includes:

- Fourteen tracked imperative migrations for identity, assignments, scoped
  roles, onboarding, channels, messages, attachment metadata and linkage,
  audit events, Realtime publication, composite foreign-key indexes, and the
  current MFA phase-out.
- Tenant-consistent composite foreign keys, server-controlled update
  timestamps, explicit Data API grants, authenticated-session restrictions,
  and RLS for active, suspended, expired, scoped-manager, channel-member,
  view-only, outsider, and audit-reader cases.
- Protected routes for signed-out, onboarding, active, suspended, expired, and
  authorization-error states. Production mode removes the persona selector.
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
- A localized chat composer that submits with Enter, adds a line with
  Shift+Enter, and ignores Enter during input method editor (IME) composition.
  It keeps the existing privacy, meeting, attachment, and send guards.
- A localized whole-application context menu for Inbox, Chat, Tasks, and
  Documents, plus message-specific Copy message and Assign task actions.
  Editable fields retain their native browser menu. The menu supports keyboard
  access, touch long-press, managed focus, and viewport collision handling.
- A responsive message content track with a 24 px desktop inset, a 12 px
  mobile inset, an aligned date divider, and vertically centered composer
  text in English and Vietnamese.
- Durable account preferences that save language, default location,
  notifications, quiet hours, and time zone across sessions and devices.
- A signed-in password change form that requires the current password, checks
  confirmation, and shows strength against the 12-character password policy.
- Durable Tasks, Meetings, directory, announcements, access requests, policy
  warnings, organization settings, locations, and scoped member assignments.
- An idempotent manual employee provisioner and a 14-account development test
  matrix covering scoped roles, view-only access, suspension, expiry, and
  outsider denial without enrolling TOTP factors.
- Fourteen confirmed hosted Auth identities. Existing TOTP factors remain
  attached to historical test users, but the current client and database path
  no longer challenges or requires them.
- A versioned service worker, real PNG and maskable icons, install and update
  UX, offline status, safe shell precaching, self-hosted fonts, and per-device
  Web Push subscription storage. Supabase and attachment traffic is
  network-only.
- A fail-closed ClamAV promotion path and a container image that passed a local
  startup and health check. Production requires a deployed scanner and
  `ATTACHMENT_SCAN_MODE=clamav`; `dev_bypass` remains development-only.
- Vercel SPA routing and security headers. The personal Zalo launcher opens
  Zalo Web Chat in a separate Zalo-controlled window when
  `VITE_ENABLE_ZALO_LAUNCHER=true`. It does not import chats or store Zalo
  credentials.
- Fifty-seven Vitest tests and 107 pgTAP assertions pass after the phase-out.
  Database lint and local security and performance advisors report no issues.
  The updated integrations restore a password session, prove Realtime, upload
  seven MiB, promote it, link it atomically, download it through a signed URL,
  and remove all test data.
- A hosted development deployment with 36 public tables, RLS on all 36,
  85 public-schema policies, no anonymous attachment grants, and the
  `messages` table in the Realtime publication. The phase-out migration still
  needs hosted verification.
- Three active hosted Edge Functions with JWT verification enabled. Attachment
  promotion and Web Push remain fail-closed until their server secrets are
  configured.
- Real hosted sessions previously proved active role access, location and
  department scope boundaries, view-only behavior, suspension, expiry,
  outsider isolation, and stored locale and time-zone preferences. Repeat this
  matrix with email-and-password sessions after deploying the phase-out.
- Hosted performance advisors with no missing foreign-key indexes. The
  remaining unused-index notices are expected with the small synthetic
  development dataset.
- A hosted security-advisor warning that leaked-password protection is
  disabled. This is an accepted Free-plan development limitation, not a
  blocker for synthetic development identities. Revisit it before production
  if the selected plan supports the feature.
- `npm audit --omit=dev` reports the React Router RSC-mode CSRF advisory for
  version 7.18.1. This Vite application uses only browser SPA routing and has
  no React Server Components, server actions, or React Router server runtime.
  Do not add those modes until an unaffected upstream release is available.

The current frontend checks pass the unit test, type-check, lint, production
build, React Doctor, whitespace, and six-viewport Playwright gates. The
accepted visual baselines cover 1280 × 1024, 1024 × 768, 768 × 1024,
390 × 844, 320 × 568, and 844 × 390. They verify composer and date-divider
alignment, mobile overflow, Enter-to-send, English and Vietnamese labels,
context-menu collision handling, settings persistence, and editable-field
native menus.

The next implementation boundary is:

- Set `ATTACHMENT_SCAN_MODE=dev_bypass` only in the hosted development Edge
  Function secrets, run the hosted attachment flow, and then enable
  `VITE_ENABLE_ATTACHMENTS=true` for that development client.
- Run the remaining hosted Realtime, resumable upload, promotion, and
  signed-download scenarios with the provisioned development identities.
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
- [Account preferences migration](../supabase/migrations/20260728090000_add_account_preferences.sql)
- [Tasks and meetings migration](../supabase/migrations/20260728100000_add_tasks_and_meetings.sql)
- [Governance and administration migration](../supabase/migrations/20260728110000_add_governance_and_admin.sql)
- [Clean attachment completion migration](../supabase/migrations/20260728120000_add_clean_attachment_completion.sql)
- [Function privilege hardening migration](../supabase/migrations/20260728130000_harden_function_privileges.sql)
- [Notification authorization migration](../supabase/migrations/20260728140000_add_notification_authorization.sql)
- [Notification authorization repair](../supabase/migrations/20260728150000_fix_notification_authorization.sql)
- [MFA phase-out migration](../supabase/migrations/20260802144218_phase_out_mfa.sql)
- [Database policy tests](../supabase/tests/database)
- [Password session and Realtime integration test](../supabase/tests/integration/realtime.mjs)
- [Private attachment integration test](../supabase/tests/integration/attachments.mjs)
- [Authentication state machine](../src/state/AuthContext.tsx)
- [Supabase messaging repository](../src/services/supabaseMessagingRepository.ts)
- [Supabase attachment repository](../src/services/attachmentRepository.ts)
- [Attachment Edge Functions](../supabase/functions)
- [Messaging query and Realtime boundary](../src/state/MessagingContext.tsx)
- [Messaging boundary tests](../src/test/messaging-context.test.tsx)
- [Application context menu](../src/components/AppShell.tsx)
- [Message context menu](../src/components/MessageThread.tsx)
- [Chat composer behavior](../src/pages/ChannelPage.tsx)
- [Frontend interaction tests](../src/test/app.test.tsx)
- [Zalo personal chat integration decision](ZALO_INTEGRATION.md)

## Decisions required before staged rollout

Local implementation can continue while these decisions are open, but no
hosted production configuration, real staff data, or pilot rollout can proceed
until the accountable clinic stakeholders resolve them.

1. Confirm that production remains operational-only and define the escalation
   process when patient information is posted accidentally.
2. Select the primary identity provider: Microsoft Entra ID or Google Workspace
   SSO is preferred. The current release uses administrator-created
   email-and-password accounts, and the clinic must decide when to restore MFA.
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
| Work | `tasks`, `task_collaborators`, `task_checklist_items`, `meetings`, `meeting_responses` | Local and hosted development |
| Files | `attachments`, `message_attachments`, and private channel-scoped object paths | Local and hosted development; client gated |
| Publishing | `announcements`, scoped audiences, `announcement_acknowledgements` | Local and hosted development |
| Governance | `access_requests`, `audit_events`, `policy_warning_events`, `account_preferences`, `push_subscriptions` | Local and hosted development |

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

1. **Completed:** Use `AuthProvider` for loading, signed-out, onboarding,
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
4. **Completed for chat interactions:** Use the existing form for safe
   Enter-to-send behavior, keep Shift+Enter and IME input intact, provide
   localized application and message context menus, and preserve native
   editable-field menus. These changes add no backend or data-model boundary.
5. **Completed:** Use durable directory, task, meeting, announcement, access,
   and administration contracts in authenticated mode.
6. **Current release boundary:** Staff onboarding is deferred. Administrators
   create existing employee accounts with the manual provisioner, which marks
   their setup complete. Invitation, SSO, and automated offboarding remain
   later organization-lifecycle work.

Create separate backend projects for local development, staging, and
production. Store schema and RLS changes as reviewed migrations; use synthetic
seed data only outside production. CI should apply migrations to an ephemeral
database, run policy tests, then build the web and Capacitor artifacts.

## Authentication and onboarding flows

Public self-signup is disabled in the local configuration and the configured
hosted project. The current UI supports administrator-created email/password
accounts, session restoration, and onboarding without a second-factor
challenge. Invitation acceptance, SSO or Auth0 token bridging, organization
setup, and automated offboarding are not implemented.

### MFA phase-out

The current release accepts Supabase AAL1 password sessions. The phase-out
removes the MFA route, enrollment and verification calls, client bypass flag,
and automatic TOTP enrollment from account provisioning.

The authorization boundary remains fail-closed:

- The database requires `auth.uid()` before the existing tenant and role checks
  run.
- Tenant, membership, channel, sender, suspension, and expiry rules continue to
  apply.
- Historical bypass tables remain private and inactive so the phase-out does
  not destroy prior development records.
- Existing TOTP factors remain attached to users, but the application does not
  challenge them.

Apply the phase-out migration before deploying the frontend. Disable TOTP
enrollment and verification in the target Auth configuration for consistent
behavior across environments.

The target flow starts when an administrator or approved directory sync creates
an invitation with organization, role, location, department, employment type,
start time, and optional expiry.

The staff flow is:

1. Open invitation and authenticate with SSO, or verify an invitation-only
   magic link.
2. Confirm name and work contact details; identity and assignment fields owned
   by HR/IT stay read-only.
3. Accept acceptable-use, privacy, notification, and “no patient details”
   guidance with policy-version timestamps.
4. Choose language, primary location when more than one assignment exists,
   quiet hours, and notification preferences.
5. Create policy-derived memberships transactionally, show the user's initial
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
- [x] Create the local backend configuration and fourteen tracked migrations.
- [x] Connect the Supabase MCP and compare hosted tables, migration history,
  logs, and advisors without changing the project.
- [ ] Apply the MFA phase-out migration to the configured hosted development
  project and repeat the authorization matrix.
- [x] Verify hosted RLS, grants, Realtime publication, foreign-key indexes, and
  transactional sender, view-only, outsider, and AAL1 cases.
- [x] Re-run active-member, scoped-manager, denied-outsider, suspended, expired,
  AAL1, view-only, and audit-reader RLS cases locally.
- [x] Prove password session restoration, RLS insertion, and Realtime delivery
  in the updated local integration test.

### Phase 1 — auth and organization setup

This phase establishes trusted staff identity and organization lifecycle flows.

- [x] Add protected routes and the auth state machine.
- [x] Phase out TOTP enrollment, verification, and routing while retaining
  session restoration and transactional staff onboarding.
- [x] Add manual, idempotent employee provisioning for the onboarding-deferred
  release.
- [x] Add persistent account settings and signed-in password change.
- [ ] Add the selected SSO bridge and automated offboarding after the manual
  employee release.

### Phase 2 — durable core messaging

This phase replaces synthetic messaging state with authorized durable data.

- [x] Add local Postgres schemas for directory foundations, channels,
  memberships, messages, receipts, and metadata-only audit events.
- [x] Add a tested production repository for authorized Realtime updates,
  keyset pagination, and idempotent message sends.
- [x] Replace authenticated Chat and Inbox channel/message state with the
  production repositories while keeping preview mocks for isolated UI tests.
- [x] Add composite indexes for every hosted foreign-key coverage warning.
- [x] Harden chat keyboard input, localized context menus, responsive message
  insets, and editable-field browser-menu behavior.
- [x] Move directory queries, tasks, meetings, announcements, access requests,
  and supported administration to Postgres.
- [x] Add private message attachments with scoped Storage policies, resumable
  uploads, trusted development promotion, and signed downloads.
- [x] Add a fail-closed ClamAV scan contract and container. Deploy and approve
  the scanner before enabling production attachments.
- [x] Add tested meeting and announcement policies and transaction paths.

### Phase 3 — PWA pilot

This phase prepares one controlled department for a hosted PWA pilot.

- [x] Add the service worker, install education, update UX, icons, safe cache
  policy, security headers, and per-device Web Push subscription storage.
- [x] Add an authenticated generic notification delivery worker that honors
  quiet hours and revokes dead subscriptions.
- [x] Replace the Official Account widget with a personal Zalo Web Chat
  launcher and document the no-import boundary.
- [ ] Configure VAPID secrets, monitoring, backups, recovery drills, and
  staging-to-production promotion.
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

The remaining milestone is deployment evidence, not another application data
model:

1. Deploy the scanner container and configure the finalizer secrets.
2. Apply the MFA phase-out migration, deploy the Vercel client with production
   flags, and complete hosted password, upload, download, persistence, install,
   and update smoke tests.
3. Configure the generic Web Push worker's VAPID secrets and prove delivery.
4. Complete clinic approval, backup restoration, device review, signing, and
   store records. These external gates cannot be completed from source code.

Use [the deployment runbook](DEPLOYMENT.md) for the exact handoff.

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
- [Zalo developer documentation](https://developers.zalo.me/docs/)
