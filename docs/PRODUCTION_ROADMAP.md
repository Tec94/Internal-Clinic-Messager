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

## Decisions required before implementation

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
scope relationships instead of storing arrays in production.

| Area | Tables |
| --- | --- |
| Identity | `profiles`, `organizations`, `organization_members`, `invitations`, `onboarding_progress` |
| Structure | `locations`, `departments`, `assignments`, `role_bindings`, `role_binding_locations`, `role_binding_departments` |
| Chat | `channels`, `channel_locations`, `channel_departments`, `channel_memberships`, `messages`, `message_receipts` |
| Work | `tasks`, `task_collaborators`, `task_checklist_items`, `meetings`, `meeting_responses` |
| Files | `attachments` plus private object-storage paths scoped by organization and channel |
| Publishing | `announcements`, `announcement_audiences`, `announcement_acknowledgements` |
| Governance | `access_requests`, `audit_events`, `policy_warning_events`, `notification_preferences`, `push_subscriptions` |

Use append-only audit records for access, membership, role, announcement,
warning, export, and break-glass events. Audit warning metadata, not the flagged
message content. Decide message editing/deletion and retention semantics before
writing those migrations.

### Minimum RLS invariants

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

Write automated database tests for every role in `src/services/permissions.ts`.
The database policies, not the React permission helpers, are the source of
enforcement.

## Application boundary changes

The current `ClinicProvider` owns seed data and mutations in React state. Replace
it incrementally, rather than rewriting screens:

1. Add an `AuthProvider` that exposes loading, signed-out, onboarding, active,
   suspended, and expired states. Remove the production persona selector and
   `clinic-persona` local-storage identity.
2. Define repository interfaces for channels, messages, tasks, meetings,
   announcements, directory data, and memberships. Keep a mock implementation
   for tests and Storybook-style preview work.
3. Implement the production repositories with TanStack Query. Use mutations for
   writes, invalidate or update only affected query keys, and subscribe to
   authorized realtime topics after session establishment.
4. Replace `mockUploadAdapter` with direct-to-private-storage uploads using
   scoped authorization. Validate type and size on both client and server, add
   malware scanning before download, and do not expose permanent public URLs.
5. Put derived membership, invitations, assignment changes, offboarding,
   announcements, and other multi-record workflows in transactional database
   functions or trusted server endpoints.

Create separate backend projects for local development, staging, and
production. Store schema and RLS changes as reviewed migrations; use synthetic
seed data only outside production. CI should apply migrations to an ephemeral
database, run policy tests, then build the web and Capacitor artifacts.

## Authentication and onboarding flows

Disable public self-signup. An administrator or approved directory sync creates
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

## Suggested implementation order

### Phase 0 — governance and backend spike

- Resolve the five decisions above.
- Create local/staging backend projects and the first reviewed migration.
- Prove three RLS cases: active member, scoped manager, and denied outsider.
- Prove session restoration and realtime delivery in one test channel.

### Phase 1 — auth and organization setup

- Add protected routes and the auth state machine.
- Build invite acceptance, MFA/SSO callback, staff onboarding, and the
  organization setup wizard.
- Implement transactional membership derivation and offboarding.

### Phase 2 — durable core messaging

- Move directory, channels, memberships, messages, tasks, and audit events to
  Postgres.
- Add authorized realtime updates, pagination, idempotent send operations, and
  private attachments.
- Keep meetings and announcements behind feature flags until their policies and
  transaction paths are tested.

### Phase 3 — PWA pilot

- Add the service worker, install education, web push, update UX, monitoring,
  backups, recovery drills, and staging-to-production promotion.
- Pilot with one department at one location before organization-wide rollout.

### Phase 4 — store packaging

- Add native security/push integrations, signing and store records, privacy
  disclosures, reviewer access, device tests, and staged release channels.
- Continue deploying the same built web application to PWA and Capacitor; do not
  create a separate React Native fork unless a future requirement genuinely
  cannot be met by Capacitor.

## Production exit criteria

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

- [Supabase Postgres and database operations](https://supabase.com/docs/guides/database/overview)
- [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase production checklist](https://supabase.com/docs/guides/deployment/going-into-prod)
- [Supabase Auth](https://supabase.com/docs/guides/auth),
  [MFA](https://supabase.com/docs/guides/auth/auth-mfa), and
  [SAML SSO](https://supabase.com/docs/guides/auth/enterprise-sso)
- [MDN PWA installability](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)
- [WebKit web push for Home Screen apps](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
- [Capacitor web/native runtime](https://capacitorjs.com/docs)
- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
