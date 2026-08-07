# YKSG messaging workspace

YKSG is a role-aware communication frontend for Phòng Khám Y Khoa Sài Gòn. It
combines a low-noise, three-pane workspace with chat, tasks, documents,
meetings, people, announcements, and scoped administration.

> **Note:** The `develop` branch contains the durable Supabase application and
> the non-authenticated preview. Authenticated Chat, Inbox, Tasks, Meetings,
> directory, announcements, settings, and supported administration use
> database repositories. Thirteen migrations are deployed to the hosted
> development backend, and the tracked fourteenth migration phases out MFA.
> Apply that migration before deploying this frontend. The 14-account hosted
> authorization matrix is provisioned and verified. Store approval, production
> secrets, scanner deployment, backup evidence, and device acceptance remain
> release gates.
> This is not a regulatory compliance control.

## Run the application

Use Node.js 22 or later. On Windows, run the npm commands through `cmd` when
PowerShell script execution is restricted.

1. Install dependencies with `cmd /c npm install`.
2. Start the development server with
   `cmd /c npm run dev -- --host 127.0.0.1 --port 5173`.
3. Open `http://127.0.0.1:5173`.

## Explore the product

The primary navigation rail opens module-specific sidebars for Chat, Tasks,
Documents, Meetings, and People. In preview mode, use the floating development
panel to test each permission scope.

- **Phạm Ngọc Linh** represents a regular employee.
- **Võ Thành Nam** represents staff assigned to both locations.
- **Lê Hoàng Anh** represents a department lead.
- **Trần Thu Hà** represents a location manager.
- **Nguyễn Minh Khang** represents the organization owner.
- **Đỗ Minh Quân** represents a time-boxed contractor.

Vietnamese is the first-run locale. Change language in Settings. Authenticated
preferences follow the account across supported devices. The workspace uses
the fixed Graphite + Indigo theme.

Meeting links from Google Meet and Zoom open a confirmation dialog before the
app posts an invitation. Accepted invitations appear in the internal Meetings
agenda. The preview doesn't connect to external calendars or meeting services.

## Architecture

The frontend uses React, TypeScript, Vite, React Router, Tailwind CSS, Radix
primitives, Lucide icons, TanStack Query, React Hook Form, Zod, and
`react-i18next`. Capacitor 8 packages the same React application for native
Android and iOS test builds, so no React Native rewrite is required. The
authenticated shell uses Supabase session and membership state. Authenticated
Chat and Inbox use a tested TanStack Query boundary for authorized channels,
member profiles, paginated messages, sends, Realtime updates, resumable private
attachments, and short-lived downloads. Preview and unfinished modules retain
`ClinicProvider` data.

Read [the product architecture](docs/PRODUCT_ARCHITECTURE.md) for channel
taxonomy, scoped roles, lifecycle rules, administrative governance, and the
operational-only data boundary.

Read [the production roadmap](docs/PRODUCTION_ROADMAP.md) for the recommended
database schema, RLS authorization boundary, auth and onboarding flows, PWA
pilot, and the path from the existing Capacitor wrappers to store releases.
Use [the deployment runbook](docs/DEPLOYMENT.md) for environment promotion and
[the mobile testing guide](docs/MOBILE_TESTING.md) for Capacitor checks.

## Operational-only boundary

The message and channel flows warn when text resembles patient-identifying
information. The user can return to edit or confirm that they reviewed the
content. This behavior intentionally warns rather than blocks.

> **Warning:** The detection logic is deterministic preview logic. It is not a
> validated de-identification service and must not be treated as a compliance
> safeguard.

Staffing screens display imported snapshots with capture times. The product
doesn't monitor live intake capacity, throughput, or diversion status.

## Zalo side panel

The sidebar `Zalo` control opens the employee's personal Zalo inbox in a
managed side-panel popup that stays beside the workspace; clicking it again
re-focuses the existing panel instead of navigating away. Zalo keeps its own
sign-in in the browser profile, so employees stay signed in across days and
YKSG logouts until they sign out of Zalo. YKSG does not store a Zalo
password, token, contact, or message.

Set `VITE_ENABLE_ZALO_LAUNCHER=true` to show the control on authenticated
routes. The current Zalo APIs do not expose a personal inbox or existing chat
history to another application, and Zalo withholds its login UI inside
iframes, so embedding is not possible. Read the
[Zalo integration decision](docs/ZALO_INTEGRATION.md) for the capability
review, security boundary, and acceptance checks.

## Private development attachments

Authenticated message attachments use private quarantine and available
Storage buckets. Keep `VITE_ENABLE_ATTACHMENTS=false` until the target backend
has both buckets, the attachment migration, and both attachment Edge
Functions.

For the disposable hosted development project, the server-only Edge Function
secret can use `ATTACHMENT_SCAN_MODE=dev_bypass`. Never use that value in
staging or production. The repository includes a fail-closed ClamAV path and a
tested scanner container; deploy and approve it before enabling production
attachments.

## Test native builds

The tracked Capacitor projects use the app name `YKSG Messenger`, the app ID
`com.yksg.messenger`, and the production `dist` directory. Read the
[mobile testing guide](docs/MOBILE_TESTING.md) for Android Studio setup, the
Mac and Xcode handoff, emulator and device workflows, debug builds, native
smoke tests, and troubleshooting.

Run `cmd /c npm run mobile:sync` after changing React code. The Android project
can be opened with `cmd /c npm run mobile:android`; the iOS project must be
opened on a Mac with `npm run mobile:ios`.

## Verify the application

Run the local quality checks with these commands:

- `cmd /c npm run type-check`
- `cmd /c npm run lint`
- `cmd /c npm test`
- `cmd /c npm run test:supabase`
- `cmd /c npm run build`
- `cmd /c npm run test:e2e`

The Supabase test command requires Docker and the local stack from
`cmd /c npx supabase start`. It runs pgTAP RLS tests, restores a real local
email-and-password session, verifies Realtime delivery, starts the local Edge
Functions, and proves a resumable seven MiB quarantine upload, development
promotion, atomic message linkage, signed download, and cleanup.

The Playwright suite covers 1280×1024 desktop, 1024×768 compact desktop,
768×1024 tablet, 390×844 phone, 320×568 small phone, and 844×390 touch
landscape viewports using the fixed Graphite + Indigo theme.

## Deployment

Use [the deployment runbook](docs/DEPLOYMENT.md) for Supabase promotion,
employee and test-account provisioning, scanner deployment, Vercel settings,
PWABuilder packaging, and release evidence. Leaked-password protection remains
an accepted Free-plan development limitation and a production-plan revisit.
