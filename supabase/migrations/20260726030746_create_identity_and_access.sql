create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  default_locale text not null default 'vi-VN',
  timezone text not null default 'Asia/Ho_Chi_Minh',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  work_email text not null,
  locale text not null default 'vi-VN',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profiles_work_email_key
  on public.profiles (lower(work_email));

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'active'
    check (status in ('active', 'suspended', 'offboarded')),
  employment_type text not null default 'employee'
    check (employment_type in ('employee', 'contractor', 'locum', 'vendor')),
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (organization_id, id),
  unique (organization_id, user_id),
  check (expires_at is null or expires_at > starts_at)
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  name text not null,
  short_name text not null,
  timezone text not null default 'Asia/Ho_Chi_Minh',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (organization_id, id),
  unique (organization_id, name),
  unique (organization_id, short_name)
);

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (organization_id, id),
  unique (organization_id, name)
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  member_id uuid not null,
  location_id uuid not null,
  department_id uuid not null,
  is_primary boolean not null default false,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  foreign key (organization_id, member_id)
    references public.organization_members (organization_id, id),
  foreign key (organization_id, location_id)
    references public.locations (organization_id, id),
  foreign key (organization_id, department_id)
    references public.departments (organization_id, id),
  check (ends_at is null or ends_at > starts_at)
);

create table public.role_bindings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  member_id uuid not null,
  role text not null check (
    role in (
      'owner',
      'org_admin',
      'location_manager',
      'department_lead',
      'staff',
      'contractor',
      'it_support'
    )
  ),
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (organization_id, id),
  foreign key (organization_id, member_id)
    references public.organization_members (organization_id, id),
  check (expires_at is null or expires_at > starts_at)
);

create table public.role_binding_locations (
  organization_id uuid not null references public.organizations (id),
  role_binding_id uuid not null,
  location_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (role_binding_id, location_id),
  foreign key (organization_id, role_binding_id)
    references public.role_bindings (organization_id, id) on delete cascade,
  foreign key (organization_id, location_id)
    references public.locations (organization_id, id) on delete cascade
);

create table public.role_binding_departments (
  organization_id uuid not null references public.organizations (id),
  role_binding_id uuid not null,
  department_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (role_binding_id, department_id),
  foreign key (organization_id, role_binding_id)
    references public.role_bindings (organization_id, id) on delete cascade,
  foreign key (organization_id, department_id)
    references public.departments (organization_id, id) on delete cascade
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  email text not null,
  role text not null check (
    role in (
      'owner',
      'org_admin',
      'location_manager',
      'department_lead',
      'staff',
      'contractor',
      'it_support'
    )
  ),
  location_id uuid,
  department_id uuid,
  employment_type text not null default 'employee'
    check (employment_type in ('employee', 'contractor', 'locum', 'vendor')),
  invited_by uuid not null references auth.users (id),
  invited_user_id uuid references auth.users (id),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  foreign key (organization_id, location_id)
    references public.locations (organization_id, id),
  foreign key (organization_id, department_id)
    references public.departments (organization_id, id),
  check (expires_at is null or expires_at > created_at)
);

create unique index invitations_pending_email_key
  on public.invitations (organization_id, lower(email))
  where status = 'pending' and archived_at is null;

create table public.onboarding_progress (
  organization_id uuid not null references public.organizations (id),
  member_id uuid primary key,
  status text not null default 'profile'
    check (status in ('profile', 'mfa', 'policies', 'preferences', 'complete')),
  accepted_policy_version text,
  accepted_policy_at timestamptz,
  locale text not null default 'vi-VN',
  quiet_hours_start time,
  quiet_hours_end time,
  notifications_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, member_id)
    references public.organization_members (organization_id, id) on delete cascade,
  check (
    (quiet_hours_start is null and quiet_hours_end is null)
    or
    (quiet_hours_start is not null and quiet_hours_end is not null)
  ),
  check (
    (accepted_policy_version is null and accepted_policy_at is null)
    or
    (accepted_policy_version is not null and accepted_policy_at is not null)
  )
);

create index organization_members_user_id_idx
  on public.organization_members (user_id);
create index assignments_member_id_idx
  on public.assignments (member_id);
create index assignments_organization_id_idx
  on public.assignments (organization_id);
create index assignments_location_id_idx
  on public.assignments (location_id);
create index assignments_department_id_idx
  on public.assignments (department_id);
create index role_bindings_member_id_idx
  on public.role_bindings (member_id);
create index role_bindings_organization_id_idx
  on public.role_bindings (organization_id);
create index role_binding_locations_organization_id_idx
  on public.role_binding_locations (organization_id);
create index role_binding_locations_location_id_idx
  on public.role_binding_locations (location_id);
create index role_binding_departments_organization_id_idx
  on public.role_binding_departments (organization_id);
create index role_binding_departments_department_id_idx
  on public.role_binding_departments (department_id);
create index invitations_location_id_idx
  on public.invitations (location_id);
create index invitations_department_id_idx
  on public.invitations (department_id);
create index invitations_invited_by_idx
  on public.invitations (invited_by);
create index invitations_invited_user_id_idx
  on public.invitations (invited_user_id);
create index onboarding_progress_organization_id_idx
  on public.onboarding_progress (organization_id);

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public;

create function private.prepare_onboarding_completion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'complete' and new.status <> 'complete' then
    raise exception using
      errcode = '23514',
      message = 'completed onboarding cannot be reopened by the client';
  end if;

  if old.status <> 'complete' and new.status = 'complete' then
    new.accepted_policy_version = 'operational-use-2026-07';
    new.accepted_policy_at = now();
  end if;

  return new;
end;
$$;

revoke all on function private.prepare_onboarding_completion() from public;

create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function private.set_updated_at();
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();
create trigger organization_members_set_updated_at
  before update on public.organization_members
  for each row execute function private.set_updated_at();
create trigger locations_set_updated_at
  before update on public.locations
  for each row execute function private.set_updated_at();
create trigger departments_set_updated_at
  before update on public.departments
  for each row execute function private.set_updated_at();
create trigger assignments_set_updated_at
  before update on public.assignments
  for each row execute function private.set_updated_at();
create trigger role_bindings_set_updated_at
  before update on public.role_bindings
  for each row execute function private.set_updated_at();
create trigger invitations_set_updated_at
  before update on public.invitations
  for each row execute function private.set_updated_at();
create trigger onboarding_progress_set_updated_at
  before update on public.onboarding_progress
  for each row execute function private.set_updated_at();
create trigger onboarding_progress_prepare_completion
  before update on public.onboarding_progress
  for each row execute function private.prepare_onboarding_completion();

create function private.is_active_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members as member
    where member.organization_id = target_organization_id
      and member.user_id = (select auth.uid())
      and member.status = 'active'
      and member.archived_at is null
      and member.starts_at <= now()
      and (member.expires_at is null or member.expires_at > now())
  );
$$;

create function private.shares_active_organization(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members as current_member
    join public.organization_members as target_member
      on target_member.organization_id = current_member.organization_id
    where current_member.user_id = (select auth.uid())
      and target_member.user_id = target_user_id
      and current_member.status = 'active'
      and target_member.status = 'active'
      and current_member.archived_at is null
      and target_member.archived_at is null
      and current_member.starts_at <= now()
      and target_member.starts_at <= now()
      and (current_member.expires_at is null or current_member.expires_at > now())
      and (target_member.expires_at is null or target_member.expires_at > now())
  );
$$;

create function private.has_role(
  target_organization_id uuid,
  required_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members as member
    join public.role_bindings as binding
      on binding.member_id = member.id
      and binding.organization_id = member.organization_id
    where member.organization_id = target_organization_id
      and member.user_id = (select auth.uid())
      and member.status = 'active'
      and member.archived_at is null
      and member.starts_at <= now()
      and (member.expires_at is null or member.expires_at > now())
      and binding.role = any(required_roles)
      and binding.archived_at is null
      and binding.starts_at <= now()
      and (binding.expires_at is null or binding.expires_at > now())
  );
$$;

create function private.can_manage_location(
  target_organization_id uuid,
  target_location_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_role(
    target_organization_id,
    array['owner', 'org_admin']
  )
  or exists (
    select 1
    from public.organization_members as member
    join public.role_bindings as binding
      on binding.member_id = member.id
      and binding.organization_id = member.organization_id
    join public.role_binding_locations as scope
      on scope.role_binding_id = binding.id
      and scope.organization_id = binding.organization_id
    where member.organization_id = target_organization_id
      and member.user_id = (select auth.uid())
      and member.status = 'active'
      and member.archived_at is null
      and member.starts_at <= now()
      and (member.expires_at is null or member.expires_at > now())
      and binding.role = 'location_manager'
      and binding.archived_at is null
      and binding.starts_at <= now()
      and (binding.expires_at is null or binding.expires_at > now())
      and scope.location_id = target_location_id
  );
$$;

create function private.can_manage_department(
  target_organization_id uuid,
  target_department_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_role(
    target_organization_id,
    array['owner', 'org_admin']
  )
  or exists (
    select 1
    from public.organization_members as member
    join public.role_bindings as binding
      on binding.member_id = member.id
      and binding.organization_id = member.organization_id
    join public.role_binding_departments as scope
      on scope.role_binding_id = binding.id
      and scope.organization_id = binding.organization_id
    where member.organization_id = target_organization_id
      and member.user_id = (select auth.uid())
      and member.status = 'active'
      and member.archived_at is null
      and member.starts_at <= now()
      and (member.expires_at is null or member.expires_at > now())
      and binding.role = 'department_lead'
      and binding.archived_at is null
      and binding.starts_at <= now()
      and (binding.expires_at is null or binding.expires_at > now())
      and scope.department_id = target_department_id
  );
$$;

revoke all on function private.is_active_member(uuid) from public;
revoke all on function private.shares_active_organization(uuid) from public;
revoke all on function private.has_role(uuid, text[]) from public;
revoke all on function private.can_manage_location(uuid, uuid) from public;
revoke all on function private.can_manage_department(uuid, uuid) from public;

grant execute on function private.is_active_member(uuid)
  to authenticated, service_role;
grant execute on function private.shares_active_organization(uuid)
  to authenticated, service_role;
grant execute on function private.has_role(uuid, text[])
  to authenticated, service_role;
grant execute on function private.can_manage_location(uuid, uuid)
  to authenticated, service_role;
grant execute on function private.can_manage_department(uuid, uuid)
  to authenticated, service_role;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_members enable row level security;
alter table public.locations enable row level security;
alter table public.departments enable row level security;
alter table public.assignments enable row level security;
alter table public.role_bindings enable row level security;
alter table public.role_binding_locations enable row level security;
alter table public.role_binding_departments enable row level security;
alter table public.invitations enable row level security;
alter table public.onboarding_progress enable row level security;

create policy "members can read their organizations"
  on public.organizations for select
  to authenticated
  using (private.is_active_member(id));

create policy "members can read shared profiles"
  on public.profiles for select
  to authenticated
  using (
    id = (select auth.uid())
    or private.shares_active_organization(id)
  );

create policy "users can update their own profiles"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "members can read organization memberships"
  on public.organization_members for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or private.is_active_member(organization_id)
  );

create policy "members can read locations"
  on public.locations for select
  to authenticated
  using (private.is_active_member(organization_id));

create policy "scoped managers can update locations"
  on public.locations for update
  to authenticated
  using (private.can_manage_location(organization_id, id))
  with check (private.can_manage_location(organization_id, id));

create policy "members can read departments"
  on public.departments for select
  to authenticated
  using (private.is_active_member(organization_id));

create policy "scoped leads can update departments"
  on public.departments for update
  to authenticated
  using (private.can_manage_department(organization_id, id))
  with check (private.can_manage_department(organization_id, id));

create policy "members can read assignments"
  on public.assignments for select
  to authenticated
  using (private.is_active_member(organization_id));

create policy "members can read role bindings"
  on public.role_bindings for select
  to authenticated
  using (private.is_active_member(organization_id));

create policy "members can read role location scopes"
  on public.role_binding_locations for select
  to authenticated
  using (private.is_active_member(organization_id));

create policy "members can read role department scopes"
  on public.role_binding_departments for select
  to authenticated
  using (private.is_active_member(organization_id));

create policy "organization admins can read invitations"
  on public.invitations for select
  to authenticated
  using (private.has_role(organization_id, array['owner', 'org_admin']));

create policy "users can read their onboarding progress"
  on public.onboarding_progress for select
  to authenticated
  using (
    exists (
      select 1
      from public.organization_members as member
      where member.id = onboarding_progress.member_id
        and member.organization_id = onboarding_progress.organization_id
        and member.user_id = (select auth.uid())
        and member.status = 'active'
        and member.archived_at is null
        and member.starts_at <= now()
        and (member.expires_at is null or member.expires_at > now())
    )
  );

create policy "users can update their onboarding progress"
  on public.onboarding_progress for update
  to authenticated
  using (
    exists (
      select 1
      from public.organization_members as member
      where member.id = onboarding_progress.member_id
        and member.organization_id = onboarding_progress.organization_id
        and member.user_id = (select auth.uid())
        and member.status = 'active'
        and member.archived_at is null
        and member.starts_at <= now()
        and (member.expires_at is null or member.expires_at > now())
    )
  )
  with check (
    exists (
      select 1
      from public.organization_members as member
      where member.id = onboarding_progress.member_id
        and member.organization_id = onboarding_progress.organization_id
        and member.user_id = (select auth.uid())
        and member.status = 'active'
        and member.archived_at is null
        and member.starts_at <= now()
        and (member.expires_at is null or member.expires_at > now())
    )
  );

create policy "aal2 required for organizations"
  on public.organizations as restrictive for all
  to authenticated
  using (((select auth.jwt()) ->> 'aal') = 'aal2')
  with check (((select auth.jwt()) ->> 'aal') = 'aal2');
create policy "aal2 required for profiles"
  on public.profiles as restrictive for all
  to authenticated
  using (((select auth.jwt()) ->> 'aal') = 'aal2')
  with check (((select auth.jwt()) ->> 'aal') = 'aal2');
create policy "aal2 required for organization members"
  on public.organization_members as restrictive for all
  to authenticated
  using (((select auth.jwt()) ->> 'aal') = 'aal2')
  with check (((select auth.jwt()) ->> 'aal') = 'aal2');
create policy "aal2 required for locations"
  on public.locations as restrictive for all
  to authenticated
  using (((select auth.jwt()) ->> 'aal') = 'aal2')
  with check (((select auth.jwt()) ->> 'aal') = 'aal2');
create policy "aal2 required for departments"
  on public.departments as restrictive for all
  to authenticated
  using (((select auth.jwt()) ->> 'aal') = 'aal2')
  with check (((select auth.jwt()) ->> 'aal') = 'aal2');
create policy "aal2 required for assignments"
  on public.assignments as restrictive for all
  to authenticated
  using (((select auth.jwt()) ->> 'aal') = 'aal2')
  with check (((select auth.jwt()) ->> 'aal') = 'aal2');
create policy "aal2 required for role bindings"
  on public.role_bindings as restrictive for all
  to authenticated
  using (((select auth.jwt()) ->> 'aal') = 'aal2')
  with check (((select auth.jwt()) ->> 'aal') = 'aal2');
create policy "aal2 required for role location scopes"
  on public.role_binding_locations as restrictive for all
  to authenticated
  using (((select auth.jwt()) ->> 'aal') = 'aal2')
  with check (((select auth.jwt()) ->> 'aal') = 'aal2');
create policy "aal2 required for role department scopes"
  on public.role_binding_departments as restrictive for all
  to authenticated
  using (((select auth.jwt()) ->> 'aal') = 'aal2')
  with check (((select auth.jwt()) ->> 'aal') = 'aal2');
create policy "aal2 required for invitations"
  on public.invitations as restrictive for all
  to authenticated
  using (((select auth.jwt()) ->> 'aal') = 'aal2')
  with check (((select auth.jwt()) ->> 'aal') = 'aal2');
create policy "aal2 required for onboarding progress"
  on public.onboarding_progress as restrictive for all
  to authenticated
  using (((select auth.jwt()) ->> 'aal') = 'aal2')
  with check (((select auth.jwt()) ->> 'aal') = 'aal2');

revoke all on table public.organizations from anon;
revoke all on table public.profiles from anon;
revoke all on table public.organization_members from anon;
revoke all on table public.locations from anon;
revoke all on table public.departments from anon;
revoke all on table public.assignments from anon;
revoke all on table public.role_bindings from anon;
revoke all on table public.role_binding_locations from anon;
revoke all on table public.role_binding_departments from anon;
revoke all on table public.invitations from anon;
revoke all on table public.onboarding_progress from anon;

grant select on table public.organizations to authenticated;
grant select on table public.profiles to authenticated;
grant update (full_name, work_email, locale)
  on table public.profiles to authenticated;
grant select on table public.organization_members to authenticated;
grant select, update (name, short_name, timezone, archived_at)
  on table public.locations to authenticated;
grant select, update (name, archived_at)
  on table public.departments to authenticated;
grant select on table public.assignments to authenticated;
grant select on table public.role_bindings to authenticated;
grant select on table public.role_binding_locations to authenticated;
grant select on table public.role_binding_departments to authenticated;
grant select on table public.invitations to authenticated;
grant select, update (
  status,
  locale,
  quiet_hours_start,
  quiet_hours_end,
  notifications_enabled
) on table public.onboarding_progress to authenticated;

grant all on table public.organizations to service_role;
grant all on table public.profiles to service_role;
grant all on table public.organization_members to service_role;
grant all on table public.locations to service_role;
grant all on table public.departments to service_role;
grant all on table public.assignments to service_role;
grant all on table public.role_bindings to service_role;
grant all on table public.role_binding_locations to service_role;
grant all on table public.role_binding_departments to service_role;
grant all on table public.invitations to service_role;
grant all on table public.onboarding_progress to service_role;
