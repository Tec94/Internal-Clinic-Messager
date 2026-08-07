# YKSG messaging workspace architecture

This document defines the information architecture for messaging and
coordination across two YKSG locations. It also defines the administrative
control plane for locations, people, roles, channel lifecycle, announcements,
staffing snapshots, safety warnings, and audit metadata.

## Assumptions stated upfront

The preview workspace uses synthetic data so the architecture can be validated
without connecting to clinic systems. Local and hosted development Supabase
slices implement identity, assignments, scoped roles, onboarding, core
messaging, private message attachments, tasks, meetings, directory,
announcements, account settings, supported administration, audit metadata,
RLS, and Realtime. Authenticated routes consume these boundaries. Preview mode
keeps synthetic data for isolated user-interface work.

- YKSG is the short name for Phòng Khám Y Khoa Sài Gòn.
- Both synthetic locations use `Asia/Ho_Chi_Minh`.
- Each location has 20–40 staff, with some people working at both locations.
- Front Desk, Nursing, Providers, Billing, and Facilities/IT operate at both
  locations. People Operations supports the organization centrally.
- This product handles messaging, tasks, documents, meetings, staffing
  snapshots, logistics, policies, and announcements.
- The product doesn't monitor live intake capacity, diversion, or throughput.
- The product does not handle patient health information or clinical exchange.
- An external scheduler remains the system of record for shifts.
- The frontend permission model describes presentation behavior. The
  implemented database policies enforce the current identity and core
  messaging rules independently; every future module must do the same before
  its production UI is enabled.

## Current implementation boundary

The architecture is split between a tested local production path and the
synthetic preview path. This distinction prevents preview behavior from being
mistaken for durable or hosted behavior.

- The backend includes organizations, profiles, memberships, locations,
  departments, assignments, scoped roles, invitations, onboarding, channels,
  channel memberships, messages, receipts, tasks, meetings, announcements,
  access requests, account settings, and metadata-only audit events.
- The authentication shell accepts email-and-password sessions, checks active,
  suspended, and expired membership states, and completes onboarding
  transactionally.
- The Supabase messaging repository supports scoped channel discovery,
  keyset-paginated reads, idempotent sends, and authorized Realtime updates.
- The attachment repository initializes opaque metadata, uploads resumable
  files to a private quarantine bucket, invokes trusted promotion, links only
  available attachments, and requests short-lived signed downloads.
- `MessagingProvider` joins authorized channels and member profiles, drives
  Chat and Inbox through TanStack Query, and deduplicates sent and Realtime
  messages in the query cache.
- Authenticated Chat, Inbox, directory, Tasks, Meetings, announcements,
  settings, and supported administration use production repositories. Preview
  mode retains `ClinicProvider` data for interface tests.
- The Zalo sidebar control opens the personal Zalo inbox in a managed
  side-panel popup beside the workspace shell. It does not import a personal
  inbox or put Zalo data inside the YKSG authorization and retention boundary.
- A production malware scanner, push delivery secrets, selected SSO bridge,
  automated offboarding, monitoring, and recovery operations remain external
  release requirements. The
  [production roadmap](PRODUCTION_ROADMAP.md) records their current status.

## Attachment security boundary

Private message attachments use a two-bucket pipeline so unverified uploads
never share the same access path as available files.

- Both buckets are private, limited to 10 MiB, and restricted to PDF, Word,
  Excel, PNG, and JPEG MIME types.
- Active authenticated senders can upload only the opaque quarantine path
  issued by the database. Clients cannot read quarantine or write to the
  available bucket.
- A JWT-verifying Edge Function rechecks authorization and stored object
  metadata before moving a file between buckets.
- `dev_bypass` is explicit development configuration. It records an audit
  event and labels the file “Unscanned — development only.”
- Any other scan mode fails closed. Staging and production require an approved
  malware scanner before promotion or download.
- Downloads require current channel read access and use a 60-second signed URL.
- The database never stores a permanent public URL.

## Password authentication boundary

The current release uses administrator-created email-and-password accounts.
Supabase password sign-in creates an authenticated AAL1 session, which the
database accepts without a second-factor challenge.

- RLS still enforces tenant membership, channel access, role scope,
  suspension, expiry, and sender identity.
- The frontend does not enroll, challenge, verify, or route users through MFA.
- The account provisioner creates passwords but does not enroll TOTP factors.
- Existing enrolled factors remain attached to their users so MFA can return
  later without deleting factor records during this phase-out.
- The historical private bypass tables remain inactive and are not part of the
  current authentication path.

## Department and location taxonomy

The taxonomy uses location-scoped operational channels where work differs by
site and organization-wide channels where work is genuinely shared.

| Department | Cơ sở Trung tâm | Cơ sở phía Đông | Cross-location space |
| --- | --- | --- | --- |
| Front Desk / Reception | `front-desk-a-home`, `front-desk-a-coverage` | `front-desk-b-home`, `front-desk-b-coverage` | A temporary interface channel for shared coverage |
| Clinical / Nursing | `nursing-a-operations`, `nursing-a-coverage` | `nursing-b-operations`, `nursing-b-coverage` | `nursing-standards` for non-clinical operational policy |
| Providers | `providers-a-operations` | `providers-b-operations` | `provider-operations` for shared administrative work |
| Billing / Administration | `billing-a-operations` | `billing-b-operations` | `billing-operations` for organization-wide process changes |
| Facilities / IT | `facilities-it-a` | `facilities-it-b` | `systems-status` for shared service notices |
| People Operations | Location-specific working channels only when needed | Location-specific working channels only when needed | `people-operations` as the private home channel |
| Leadership | `management-location-a` | `management-location-b` | `executive-briefing` and `clinic-leadership` |

Departments with two or three people receive one home channel, not an empty
hierarchy of subchannels. Additional channels require a distinct workflow,
audience, or lifecycle.

## Channel type definitions

Each channel type has a named owner and explicit visibility, creation, joining,
and archive rules.

| Type | Visibility | Who creates it | Membership | Example |
| --- | --- | --- | --- | --- |
| Department | Private to assigned department and location | Manager or department lead | Policy-derived from active assignments | `front-desk-a-home` |
| Interface | Discoverable to named departments | Manager, lead, or authorized staff | Invited group members or approved access requests | `same-day-scheduling-a` |
| Project | Discoverable with purpose and owner | Manager or project owner | Invitation or approved request | `ehr-rollout` |
| Location | Visible to active staff at one site | Location manager | Policy-derived from location assignment | `location-a-operations` |
| Announcement | Readable by its target audience | Scoped announcement authority | Derived from audience at publication time | `clinic-announcements` |
| Leadership | Hidden from nonmembers | Owner or organization admin | Explicit role policy | `executive-briefing` |
| Incident | Hidden until a person is added or requests access | Owner or location manager | Explicit, time-boxed membership | `incident-triage-staffing-a` |
| Direct message | Visible only to participants | Any active member | Explicit participants | Two-person or small-group conversation |

Channel names must describe operational work. Names such as `patient-cases`,
medical record numbers, and patient names trigger an advisory warning.

## Structural model comparison

Three models were evaluated on a five-point scale, where five is the strongest
fit.

| Model | Onboarding | Cross-department work | Maintenance | Third-location growth | Shell/channel fit |
| --- | ---: | ---: | ---: | ---: | ---: |
| Flat channel list | 4 | 2 | 2 | 1 | 3 |
| Nested department workspaces | 2 | 1 | 3 | 3 | 2 |
| Hybrid hub-and-spoke | 4 | 5 | 4 | 5 | 5 |

The product uses the hybrid hub-and-spoke model. Organization and location hubs
provide predictable entry points, while department, interface, project, and
incident channels contain specialized work. The accepted trade-off is that
channel metadata and lifecycle rules require disciplined administration.

## Cross-department communication design

Cross-department work uses the narrowest space that can complete the job.

- Standing interface channels handle frequent workflows, such as Front Desk
  and Nursing coordination for same-day scheduling.
- Temporary project channels require a purpose, owner, audience, and archive
  default.
- Direct messages handle brief questions that do not need a shared record.
- Access requests add a person to one channel without adding that person to a
  department home channel.
- Incident channels provide explicit urgency, leadership visibility, and a
  resolution state without making ordinary channels permanently urgent.

For example, a Front Desk lead creates a 24-hour interface channel for a
same-day scheduling conflict. The lead selects Front Desk and Nursing, chooses
Cơ sở Trung tâm, states the operational purpose, and avoids patient details. A
task captures the schedule update, while the channel retains the coordination
record and archives after resolution.

## Roles, access, and lifecycle rules

Business responsibility and access scope are separate. A person can hold more
than one location or department assignment while retaining one primary
assignment for defaults.

| Role | Default scope | Administrative authority |
| --- | --- | --- |
| Owner | Organization | Ownership, every location, people, channels, announcements, incidents, and policy defaults |
| Organization admin | Organization | Every operational control except ownership transfer |
| Location manager | Assigned locations | Location profile, people assignments, channels, staffing status, incidents, and location announcements |
| Department lead | Assigned departments and locations | Department assignments, channels, staffing status, and department announcements |
| Staff | Active assignments | Messaging, tasks, documents, and authorized channel creation |
| Contractor / locum | Explicit, expiring assignments | Invited channels only; no administrative access |
| IT support | Organization metadata | Channel metadata and safety audit access; no ambient message-content access |

The target lifecycle automation must prevent membership drift. The current
database enforces assignment expiry during access checks, but it doesn't yet
derive every membership or complete transfers and offboarding automatically:

1. Onboarding creates assignments and role bindings, then derives department
   and location memberships.
2. A transfer schedules the new assignment, removes policy memberships from the
   old assignment, and retains task ownership until reassigned.
3. A float assignment adds secondary scopes without changing the primary
   location default.
4. Temporary staff receive start and expiration timestamps. Expiration removes
   access even if a channel invitation remains.
5. Offboarding immediately disables the identity, removes access, transfers
   owned channels and tasks, and preserves audit history.

## Navigation and module workspaces

The primary rail keeps the same order for every role: Inbox, Chat, Tasks,
Documents, Meetings, People, and Admin. Admin appears last only when the role
has administrative access.

The middle sidebar changes with the selected module. Chat shows channels,
Tasks and Documents show searchable cross-chat indexes, Meetings shows a mini
calendar and invitations, People shows the directory, and Admin shows scoped
governance routes. This preserves the three-pane mental model without leaving
an unrelated channel list visible.

Within chat, Tasks and Documents open a contextual sheet from buttons beside
channel search. Tasks from the current chat appear before other assigned or
collaborating work. Documents in the sheet are limited to the current chat.

## Design system and component policy

The preview uses one visual system so operational controls look consistent
across chat, modules, drawers, and dialogs.

- Graphite + Indigo is the fixed theme. The app writes
  `data-theme="graphite-indigo"` at startup and overwrites stale local theme
  preferences.
- Shared BEUI and shadcn components live under `src/components/ui/motion`.
  Product-specific wrappers and flows stay in `src/components`.
- Component color must come from design tokens in `src/styles.css`, not from
  one-off inline values.
- Checkbox selection uses explicit selected background, border, and mark
  tokens. The checkmark stays light against the Graphite selected surface in
  checked and indeterminate states.
- Lucide icons remain the default for product actions. Generated BEUI
  components keep their motion behavior, but their color and spacing must
  follow the Graphite workspace tokens.

## Administrative governance and control plane

The Admin Center uses the same shell as messaging so managers retain location
context and do not move into a disconnected product. These controls remain
synthetic preview workflows except for the underlying identity, scoped-role,
channel, and audit foundations described above.

- **Overview** surfaces timestamped staffing snapshots, pending access
  requests, channel governance items, and current announcements.
- **Locations** manages site identity, active departments, status, and default
  operational settings.
- **People & roles** manages invitations, assignments, transfers, secondary
  locations, temporary access, and offboarding.
- **Channel governance** manages owners, purpose, visibility, requests,
  archive dates, and orphaned spaces.
- **Announcements** supports drafts, scoped audiences, urgency, acknowledgement,
  publication history, and expiration.
- **Staffing status** displays imported coverage and links to the external
  scheduler without editing shifts locally.
- **Audit & safety** exposes metadata-only access, policy, membership, and
  warning events.
- **Incident command** opens, scopes, resolves, and archives urgent operational
  rooms.
- **Organization settings** remains owner-only and contains ownership and
  policy defaults.

Organization announcements belong to owners and organization admins. Location
managers can publish to assigned locations, and department leads can publish to
assigned departments. Urgent announcements require confirmation and
acknowledgement but do not require a second approver in this version.

## Urgency, notification, and escalation rules

Urgency is both message-level and incident-channel-level. Routine channels do
not become permanently urgent because one message requires attention.

- A message can be marked urgent and receives a complete tinted treatment,
  icon, label, and outline.
- A manager can promote unresolved urgent work into an incident room.
- Organization-wide emergency broadcasts remain restricted to organization
  authority.
- Location managers can broadcast an emergency only to assigned locations.
- Urgent announcements request acknowledgement and expose recipient status.
- Quiet-hour overrides require explicit urgency rather than an ordinary
  channel mention.

## Task, document, and meeting integration points

Chat contains discussion and decisions. Tasks contain accountable work.

- A message can create or link a task with an owner, due time, checklist, and
  source channel.
- Task completion posts a status event back into the channel.
- Durable message attachments are first-class objects with uploader, timestamp,
  channel, scan state, and message linkage. Task attachment linkage waits for
  durable task tables.
- Google Meet and Zoom links can become structured meeting invitations after
  the sender confirms the title, start, end, and time zone.
- The organizer is accepted automatically. Other channel members can accept or
  decline in chat, and accepted meetings appear in the internal agenda.
- Meeting responses and calendar entries remain in-memory preview data. OAuth,
  external calendar synchronization, recurrence, and reminders remain outside
  this release.
- Shift creation, full project planning, document editing, and clinical
  workflows remain outside this product.

## Compliance and data-boundary guardrails

The product makes the operational-only boundary visible without claiming to
enforce regulatory compliance.

- Channel templates and examples use operational language.
- New channel and message flows display “No patient details” guidance.
- Likely patient names, record numbers, dates of birth, and clinical wording
  produce an advisory warning before send.
- The user can return to edit or confirm after review; the current product does
  not hard-block sending.
- Audit events store the warning rule, actor, time, and scope, not the flagged
  message content.
- Development attachment promotion is visibly unscanned and audit-recorded.
  Malware scanning and content classification remain required integrations
  before staging or production and require legal, privacy, security, and
  compliance review.

## Scalability stress test

The hybrid taxonomy grows by adding scoped metadata rather than another
workspace.

- A third location adds one location hub, location assignments, and only the
  department channels that differ operationally.
- A department split creates new department identities and migrates policy
  memberships while preserving project and interface channels.
- A temporary cross-location task force uses a project channel with explicit
  locations, an owner, and an archive date.
- Headcount doubling changes membership derived from assignments; it does not
  require duplicating the channel hierarchy.

## Edge-case handling

The administrative control plane owns exceptional access and communication.

- An all-staff emergency uses an urgent organization announcement with
  acknowledgement tracking and an optional incident room.
- A reception employee working both sites receives two assignments and sees
  both location scopes without joining unrelated department channels.
- IT support sees channel and audit metadata. Content access requires a named,
  time-boxed support event that is itself audited.
- A department with two or three people receives one home channel until a
  separate audience or workflow justifies another.

## Routes not taken

The selected model avoids several structures that create predictable problems.

- A flat channel list was rejected because location and department meaning
  becomes invisible as the organization grows.
- Separate workspaces per location were rejected because float staff and shared
  departments would constantly switch context.
- Nested department workspaces were rejected because cross-department work
  becomes invitation-heavy and difficult to discover.
- A separate admin application was rejected because it duplicates shell rules
  and hides current location context.
- Built-in shift scheduling was rejected because it would duplicate the
  external system of record.
- Strict automated PHI blocking was rejected for this preview because the
  deterministic detector is not accurate enough to make compliance decisions.

## Open questions for stakeholder validation

The frontend uses safe defaults, but production deployment requires operational
answers from clinic leadership, compliance, IT, and People Operations.

- What are the legal names, time zones, and operating hours of each location?
- Which identity or HR system owns onboarding and offboarding?
- Which scheduling system supplies the timestamped staffing snapshot?
- Which calendar providers require production integrations after the internal
  agenda is validated?
- What message, file, and audit retention periods are required?
- Which emergency broadcasts can a location manager send without owner review?
- Which Vietnamese operational terms require clinic-specific terminology?
- What support-access approval and break-glass process will security approve?
- Which content-warning behaviors require legal and compliance validation?
