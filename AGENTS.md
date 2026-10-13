# YKSG Workspace

Internal, operational-only messaging for Phòng Khám Y Khoa Sài Gòn staff. Never add patient information to code, fixtures, or tests.

- `src/`, `supabase/`: the Workspace (React web/PWA/Capacitor app and its Supabase backend). Run checks listed in `README.md`.
- `yksg-miniapp/`: the Zalo Mini App, a separate ZMP project with its own `package.json` and tests.
- `CONTEXT.md`: domain glossary. `docs/adr/`: architecture decisions. `docs/`: deployment, mobile testing, roadmap, Zalo.

## Agent skills

### Issue tracker

Issues live in GitHub Issues for `Tec94/Internal-Clinic-Messager`, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `CONTEXT.md` plus `docs/adr/`. See `docs/agents/domain.md`.
