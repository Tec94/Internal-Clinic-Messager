# YKSG messaging workspace

YKSG is a role-aware communication frontend for Phòng Khám Y Khoa Sài Gòn. It
combines a low-noise, three-pane workspace with chat, tasks, documents,
meetings, people, announcements, and scoped administration.

> **Note:** This is a preview frontend with synthetic data. It does not provide
> authentication, durable storage, realtime transport, clinical messaging, or
> a regulatory compliance control.

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
application keeps data access behind typed mock services and an injectable
context boundary.

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
- `cmd /c npm run build`
- `cmd /c npm run test:e2e`

The Playwright suite covers 1280×1024 desktop, 1024×768 compact desktop,
768×1024 tablet, 390×844 phone, 320×568 small phone, and 844×390 touch
landscape viewports using the fixed Graphite + Indigo theme.

## Next steps

The next implementation phase can replace the mock services with authenticated
backend adapters, realtime messaging, managed object storage, staff-directory
sync, calendar integrations, and an external scheduling integration. Every
backend must independently enforce the frontend permission matrix.
