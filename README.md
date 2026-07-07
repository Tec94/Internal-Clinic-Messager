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
`react-i18next`. The application keeps data access behind typed mock services
and an injectable context boundary.

Read [the product architecture](docs/PRODUCT_ARCHITECTURE.md) for channel
taxonomy, scoped roles, lifecycle rules, administrative governance, and the
operational-only data boundary. The original Stitch exports remain unchanged
under `stitch_clinic_messenger_design_system/` as visual source material.

## Operational-only boundary

The message and channel flows warn when text resembles patient-identifying
information. The user can return to edit or confirm that they reviewed the
content. This behavior intentionally warns rather than blocks.

> **Warning:** The detection logic is deterministic preview logic. It is not a
> validated de-identification service and must not be treated as a compliance
> safeguard.

Staffing screens display imported snapshots with capture times. The product
doesn't monitor live intake capacity, throughput, or diversion status.

## Verify the application

Run the local quality checks with these commands:

- `cmd /c npm run type-check`
- `cmd /c npm run lint`
- `cmd /c npm test`
- `cmd /c npm run build`
- `cmd /c npm run test:e2e`

The Playwright suite covers 1280×1024 desktop, 1024×768 compact desktop, and
768×1024 tablet viewports using the fixed Graphite + Indigo theme.

## Next steps

The next implementation phase can replace the mock services with authenticated
backend adapters, realtime messaging, managed object storage, staff-directory
sync, calendar integrations, and an external scheduling integration. Every
backend must independently enforce the frontend permission matrix.
