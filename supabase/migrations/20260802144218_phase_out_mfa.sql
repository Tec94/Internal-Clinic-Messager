create or replace function private.session_satisfies_mfa()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null;
$$;

comment on function private.session_satisfies_mfa() is
  'Compatibility authorization gate. MFA is phased out, so any authenticated session satisfies it.';

revoke all on function private.session_satisfies_mfa() from public;
grant execute on function private.session_satisfies_mfa()
  to authenticated, service_role;

drop function if exists public.begin_development_mfa_bypass();
drop function if exists private.begin_development_mfa_bypass();
drop function if exists public.configure_development_mfa_bypass(
  uuid,
  text,
  timestamptz
);

comment on table private.development_mfa_bypasses is
  'Inactive historical development allowlist retained while MFA is phased out.';
comment on table private.development_mfa_bypass_events is
  'Inactive historical bypass event ledger retained while MFA is phased out.';

do $$
declare
  target record;
  next_policy_name text;
begin
  for target in
    select
      namespace.nspname as schema_name,
      relation.relname as table_name,
      policy.polname as policy_name
    from pg_policy as policy
    join pg_class as relation on relation.oid = policy.polrelid
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    where policy.polname like 'aal2 required for %'
  loop
    next_policy_name := replace(
      target.policy_name,
      'aal2 required for ',
      'authenticated required for '
    );
    execute format(
      'alter policy %I on %I.%I rename to %I',
      target.policy_name,
      target.schema_name,
      target.table_name,
      next_policy_name
    );
  end loop;
end;
$$;
