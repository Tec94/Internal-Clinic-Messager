---
status: accepted
---

# Password-only authentication for the current release

Members sign in with administrator-created email and password accounts, and the database accepts Supabase AAL1 sessions without a second factor. TOTP MFA and the development MFA bypass were removed to reduce onboarding friction until the clinic selects an SSO provider (Microsoft Entra ID or Google Workspace preferred). Existing TOTP factors and the old bypass tables were deliberately kept but are inactive, so MFA can return without lost data. Revisit this decision when SSO is selected. Authorization still fails closed in RLS on Membership, Scope, suspension, and expiry.
