# YKSG messaging workspace

YKSG is a role-aware communication frontend for Phòng Khám Y Khoa Sài Gòn. It
combines a low-noise, three-pane workspace with chat, tasks, documents,
meetings, people, announcements, and scoped administration.

> **Note:** This remains a preview application. The repository now includes a
> local Supabase identity, onboarding, core messaging, private message
> attachments, RLS, and Realtime slice. Authenticated Chat and Inbox use those
> repository boundaries. Unfinished modules and the non-authenticated preview
> still use synthetic data. The six tracked migrations are deployed to the
> user-designated development backend, but real hosted staff-session testing
> is incomplete. This is not production clinical messaging or a regulatory
> compliance control.

## Run the application

Use Node.js 22 or later. On Windows, run the npm commands through `cmd` when
PowerShell script execution is restricted.

1. Install dependencies with `cmd /c npm install`.
2. Start the development server with
   `cmd /c npm run dev -- --host 127.0.0.1 --port 5173`.
3. Open `http://127.0.0.1:5173`.

## Explore the product

The primary navigation rail opens module-specific sidebars for Chat, Tasks,
Documents, Meetings, and People. Use the persona selector at the bottom of the
workspace sidebar to test each permission scope.

- **Phạm Ngọc Linh** represents a regular employee.
- **Võ Thành Nam** represents staff assigned to both locations.
- **Lê Hoàng Anh** represents a department lead.
- **Trần Thu Hà** represents a location manager.
- **Nguyễn Minh Khang** represents the organization owner.
- **Đỗ Minh Quân** represents a time-boxed contractor.

Vietnamese is the first-run locale. The **EN** and **VI** controls switch
between complete interface catalogs. The workspace uses the fixed
Graphite + Indigo theme so the visual system stays consistent across the
preview.

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
operational-only data boundary. The original Stitch exports remain unchanged
under `stitch_clinic_messenger_design_system/` as visual source material.

Read [the production roadmap](docs/PRODUCTION_ROADMAP.md) for the recommended
database schema, RLS authorization boundary, auth and onboarding flows, PWA
pilot, and the path from the existing Capacitor wrappers to store releases.

## Operational-only boundary

The message and channel flows warn when text resembles patient-identifying
information. The user can return to edit or confirm that they reviewed the
content. This behavior intentionally warns rather than blocks.

> **Warning:** The detection logic is deterministic preview logic. It is not a
> validated de-identification service and must not be treated as a compliance
> safeguard.

Staffing screens display imported snapshots with capture times. The product
doesn't monitor live intake capacity, throughput, or diversion status.

## Zalo chat widget

The bottom-right Zalo entry point is ready for the supported Zalo Official
Account chat widget. Copy `.env.example` to `.env.local` and set the public
`VITE_ZALO_OA_ID` value from the Official Account configuration. Restart the
Vite server after changing the value. You can also set the optional
`VITE_ZALO_WELCOME_MESSAGE`.

The browser receives only the OA ID and welcome message. Never add an OA access
token, app secret, or webhook credential to a `VITE_` variable. Keep those on a
future server-side integration.

Zalo's widget supports conversations between a website visitor and the clinic's
Official Account. It does not expose private Zalo inbox chats or messages from a
personal Zalo account to this workspace. Read the
[Zalo Chat Widget documentation](https://developers.zalo.me/docs/social/zalo-chat-widget)
before connecting the account.

## Development MFA bypass

The development auth path supports an expiring, per-user MFA bypass. The
browser uses it only when `VITE_ENABLE_MFA_BYPASS=true`, and the database
authorizes it only when that user has an unexpired row in the private bypass
allowlist. The app displays a persistent development warning while the bypass
is active.

The repository keeps the client flag off by default. This checkout enables it
in the ignored `.env.local` file. The connected development backend currently
allowlists its sole test identity until August 2, 2026 at 09:50 UTC. Bypass
entries can't last longer than seven days, record first use per Auth session,
and don't grant access to suspended, expired, outsider, or cross-tenant users.

> **Warning:** Never add a bypass row or enable
> `VITE_ENABLE_MFA_BYPASS` in staging or production. Delete the private
> allowlist row to revoke the exception immediately.

## Private development attachments

Authenticated message attachments use private quarantine and available
Storage buckets. Keep `VITE_ENABLE_ATTACHMENTS=false` until the target backend
has both buckets, the attachment migration, and both Edge Functions.

For the disposable hosted development project, set the server-only Edge
Function secret `ATTACHMENT_SCAN_MODE=dev_bypass`, complete a real AAL2 upload
and download test, and then set `VITE_ENABLE_ATTACHMENTS=true` in that
development client. Never use `dev_bypass` in staging or production. Those
environments require an approved malware scanner.

## Test native builds

The tracked Capacitor projects use the app name `YKSG Messenger`, the app ID
`com.yksg.messenger`, and the production `dist` directory. Read the
[mobile testing guide](docs/mobile-testing.md) for Android Studio setup, the
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
AAL2 session, verifies Realtime delivery, starts the local Edge Functions, and
proves a resumable seven MiB quarantine upload, development promotion, atomic
message linkage, signed download, and cleanup.

The Playwright suite covers 1280×1024 desktop, 1024×768 compact desktop,
768×1024 tablet, 390×844 phone, 320×568 small phone, and 844×390 touch
landscape viewports using the fixed Graphite + Indigo theme.

## Next steps

Configure the development-only attachment scan-mode secret, create approved
synthetic development users through the Auth Admin API, and run hosted sign-in,
TOTP AAL2, onboarding, Realtime, and attachment checks. Leaked-password
protection remains a deferred Free-plan limitation. Durable Tasks,
staff-directory sync, malware scanning, calendar integrations, and the external
scheduling integration remain after that boundary. Every backend must
independently enforce the frontend permission
matrix.
