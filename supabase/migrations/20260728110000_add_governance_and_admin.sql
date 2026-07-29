alter table public.organizations
  add column short_name text,
  add column legal_name text,
  add column retention_days integer not null default 90
    check (retention_days in (30, 90, 365)),
  add column retention_enforcement_enabled boolean not null default false,
  add column operational_warning_default boolean not null default true;

update public.organizations
set
  short_name = name,
  legal_name = name
where short_name is null or legal_name is null;

alter table public.organizations
  add constraint organizations_short_name_length
    check (length(trim(short_name)) between 1 and 80),
  add constraint organizations_legal_name_length
    check (length(trim(legal_name)) between 1 and 200);

alter table public.locations
  add column address text not null default '',
  add column status text not null default 'active'
    check (status in ('active', 'opening', 'archived'));

alter table public.departments
  add column code text;

update public.departments
set code = upper(left(regexp_replace(name, '[^A-Za-z0-9]', '', 'g'), 12))
where code is null;

create unique index departments_active_code_key
  on public.departments (organization_id, lower(code))
  where archived_at is null;

create table public.department_locations (
  organization_id uuid not null references public.organizations (id),
  department_id uuid not null,
  location_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (department_id, location_id),
  foreign key (organization_id, department_id)
    references public.departments (organization_id, id) on delete cascade,
  foreign key (organization_id, location_id)
    references public.locations (organization_id, id) on delete cascade
);

create index department_locations_location_id_idx
  on public.department_locations (location_id);

alter table public.department_locations enable row level security;

create policy "members can read department locations"
  on public.department_locations for select
  to authenticated
  using (private.is_active_member(organization_id));
create policy "aal2 required for department locations"
  on public.department_locations as restrictive for all to authenticated
  using ((select private.session_satisfies_mfa()))
  with check ((select private.session_satisfies_mfa()));

revoke all on table public.department_locations
  from public, anon, authenticated;
grant select on table public.department_locations to authenticated;
grant all on table public.department_locations to service_role;

create function private.can_manage_channel(
  target_organization_id uuid,
  target_channel_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_role(
    target_organization_id,
    array['owner', 'org_admin', 'it_support']
  )
  or (
    exists (
      select 1
      from public.channel_locations as channel_location
      where channel_location.organization_id = target_organization_id
        and channel_location.channel_id = target_channel_id
        and private.can_manage_location(
          target_organization_id,
          channel_location.location_id
        )
    )
    and not exists (
      select 1
      from public.channel_locations as channel_location
      where channel_location.organization_id = target_organization_id
        and channel_location.channel_id = target_channel_id
        and not private.can_manage_location(
          target_organization_id,
          channel_location.location_id
        )
    )
  )
  or (
    exists (
      select 1
      from public.channel_departments as channel_department
      where channel_department.organization_id = target_organization_id
        and channel_department.channel_id = target_channel_id
        and private.can_manage_department(
          target_organization_id,
          channel_department.department_id
        )
    )
    and not exists (
      select 1
      from public.channel_departments as channel_department
      where channel_department.organization_id = target_organization_id
        and channel_department.channel_id = target_channel_id
        and not private.can_manage_department(
          target_organization_id,
          channel_department.department_id
        )
    )
  );
$$;

revoke all on function private.can_manage_channel(uuid, uuid) from public;
grant execute on function private.can_manage_channel(uuid, uuid)
  to authenticated, service_role;

create function public.save_organization_settings(
  target_organization_id uuid,
  target_name text,
  target_short_name text,
  target_legal_name text,
  target_default_locale text,
  target_timezone text,
  target_retention_days integer,
  target_operational_warning_default boolean
)
returns setof public.organizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_organization public.organizations%rowtype;
begin
  if not private.session_satisfies_mfa()
    or not private.has_role(target_organization_id, array['owner'])
  then
    raise insufficient_privilege using
      message = 'Only an active organization owner can save these settings.';
  end if;

  if length(trim(target_name)) not between 1 and 200
    or length(trim(target_short_name)) not between 1 and 80
    or length(trim(target_legal_name)) not between 1 and 200
    or target_default_locale not in ('en-US', 'vi-VN')
    or length(trim(target_timezone)) not between 1 and 100
    or target_retention_days not in (30, 90, 365)
  then
    raise invalid_parameter_value using
      message = 'The organization settings are invalid.';
  end if;

  update public.organizations
  set
    name = trim(target_name),
    short_name = trim(target_short_name),
    legal_name = trim(target_legal_name),
    default_locale = target_default_locale,
    timezone = trim(target_timezone),
    retention_days = target_retention_days,
    retention_enforcement_enabled = false,
    operational_warning_default = target_operational_warning_default
  where id = target_organization_id
  returning * into saved_organization;

  insert into public.audit_events (
    organization_id,
    actor_member_id,
    action,
    target_type,
    target_id,
    metadata
  )
  values (
    target_organization_id,
    private.current_member_id(target_organization_id),
    'organization.settings_updated',
    'organization',
    target_organization_id,
    jsonb_build_object(
      'default_locale',
      target_default_locale,
      'retention_days',
      target_retention_days,
      'retention_enforcement_enabled',
      false
    )
  );

  return next saved_organization;
end;
$$;

create function public.save_location(
  target_organization_id uuid,
  target_location_id uuid,
  target_name text,
  target_short_name text,
  target_address text,
  target_timezone text,
  target_status text
)
returns setof public.locations
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_location public.locations%rowtype;
begin
  if not private.session_satisfies_mfa()
    or (
      target_location_id is null
      and not private.has_role(
        target_organization_id,
        array['owner', 'org_admin']
      )
    )
    or (
      target_location_id is not null
      and not private.can_manage_location(
        target_organization_id,
        target_location_id
      )
    )
  then
    raise insufficient_privilege using
      message = 'The current member cannot save this location.';
  end if;

  if length(trim(target_name)) not between 1 and 160
    or length(trim(target_short_name)) not between 1 and 40
    or length(trim(target_address)) > 500
    or length(trim(target_timezone)) not between 1 and 100
    or target_status not in ('active', 'opening', 'archived')
  then
    raise invalid_parameter_value using
      message = 'The location details are invalid.';
  end if;

  if target_location_id is null then
    insert into public.locations (
      organization_id,
      name,
      short_name,
      address,
      timezone,
      status
    )
    values (
      target_organization_id,
      trim(target_name),
      trim(target_short_name),
      trim(target_address),
      trim(target_timezone),
      target_status
    )
    returning * into saved_location;
  else
    update public.locations
    set
      name = trim(target_name),
      short_name = trim(target_short_name),
      address = trim(target_address),
      timezone = trim(target_timezone),
      status = target_status,
      archived_at = case
        when target_status = 'archived' then coalesce(archived_at, now())
        else null
      end
    where organization_id = target_organization_id
      and id = target_location_id
    returning * into saved_location;
  end if;

  if saved_location.id is null then
    raise no_data_found using message = 'The location does not exist.';
  end if;

  insert into public.audit_events (
    organization_id,
    actor_member_id,
    action,
    target_type,
    target_id,
    location_id,
    metadata
  )
  values (
    target_organization_id,
    private.current_member_id(target_organization_id),
    'location.saved',
    'location',
    saved_location.id,
    saved_location.id,
    jsonb_build_object('status', target_status)
  );

  return next saved_location;
end;
$$;

create function public.save_member_assignment(
  target_organization_id uuid,
  target_member_id uuid,
  target_role text,
  target_location_id uuid,
  target_department_id uuid,
  target_employment_type text,
  target_status text,
  target_expires_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_binding_id uuid;
begin
  if not private.session_satisfies_mfa()
    or not private.has_role(
      target_organization_id,
      array['owner', 'org_admin']
    )
    or (
      (
        target_role in ('owner', 'org_admin')
        or exists (
          select 1
          from public.role_bindings as binding
          where binding.organization_id = target_organization_id
            and binding.member_id = target_member_id
            and binding.role = 'owner'
            and binding.archived_at is null
            and binding.starts_at <= now()
            and (
              binding.expires_at is null
              or binding.expires_at > now()
            )
        )
      )
      and not private.has_role(target_organization_id, array['owner'])
    )
  then
    raise insufficient_privilege using
      message = 'Only organization administrators can save assignments.';
  end if;

  if target_role not in (
    'owner',
    'org_admin',
    'location_manager',
    'department_lead',
    'staff',
    'contractor',
    'it_support'
  )
    or target_employment_type not in (
      'employee',
      'contractor',
      'locum',
      'vendor'
    )
    or target_status not in ('active', 'suspended', 'offboarded')
    or not exists (
      select 1
      from public.locations as location
      where location.organization_id = target_organization_id
        and location.id = target_location_id
        and location.archived_at is null
    )
    or not exists (
      select 1
      from public.departments as department
      where department.organization_id = target_organization_id
        and department.id = target_department_id
        and department.archived_at is null
    )
  then
    raise invalid_parameter_value using
      message = 'The member assignment is invalid.';
  end if;

  update public.organization_members
  set
    status = target_status,
    employment_type = target_employment_type,
    expires_at = target_expires_at,
    archived_at = case
      when target_status = 'offboarded' then coalesce(archived_at, now())
      else null
    end
  where organization_id = target_organization_id
    and id = target_member_id;

  if not found then
    raise no_data_found using message = 'The organization member does not exist.';
  end if;

  update public.assignments
  set archived_at = now()
  where organization_id = target_organization_id
    and member_id = target_member_id
    and archived_at is null;

  insert into public.assignments (
    organization_id,
    member_id,
    location_id,
    department_id,
    is_primary,
    starts_at,
    ends_at
  )
  values (
    target_organization_id,
    target_member_id,
    target_location_id,
    target_department_id,
    true,
    now(),
    target_expires_at
  );

  update public.role_bindings
  set archived_at = now()
  where organization_id = target_organization_id
    and member_id = target_member_id
    and archived_at is null;

  insert into public.role_bindings (
    organization_id,
    member_id,
    role,
    starts_at,
    expires_at
  )
  values (
    target_organization_id,
    target_member_id,
    target_role,
    now(),
    target_expires_at
  )
  returning id into created_binding_id;

  if target_role = 'location_manager' then
    insert into public.role_binding_locations (
      organization_id,
      role_binding_id,
      location_id
    )
    values (
      target_organization_id,
      created_binding_id,
      target_location_id
    );
  elsif target_role = 'department_lead' then
    insert into public.role_binding_departments (
      organization_id,
      role_binding_id,
      department_id
    )
    values (
      target_organization_id,
      created_binding_id,
      target_department_id
    );
  end if;

  insert into public.audit_events (
    organization_id,
    actor_member_id,
    action,
    target_type,
    target_id,
    location_id,
    metadata
  )
  values (
    target_organization_id,
    private.current_member_id(target_organization_id),
    'member.assignment_saved',
    'organization_member',
    target_member_id,
    target_location_id,
    jsonb_build_object(
      'role',
      target_role,
      'status',
      target_status,
      'employment_type',
      target_employment_type
    )
  );
end;
$$;

create function public.create_managed_channel(
  target_organization_id uuid,
  target_name text,
  target_display_name text,
  target_purpose text,
  target_type text,
  target_visibility text,
  target_location_ids uuid[],
  target_department_ids uuid[],
  target_archive_at timestamptz,
  target_is_urgent boolean
)
returns setof public.channels
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_member_id uuid;
  created_channel public.channels%rowtype;
begin
  current_member_id := private.current_member_id(target_organization_id);
  if not private.session_satisfies_mfa()
    or current_member_id is null
    or not (
      private.has_role(
        target_organization_id,
        array['owner', 'org_admin', 'it_support']
      )
      or (
        cardinality(coalesce(target_location_ids, '{}'::uuid[])) > 0
        and not exists (
          select 1
          from unnest(target_location_ids) as location(location_id)
          where not private.can_manage_location(
            target_organization_id,
            location.location_id
          )
        )
      )
      or (
        cardinality(coalesce(target_department_ids, '{}'::uuid[])) > 0
        and not exists (
          select 1
          from unnest(target_department_ids) as department(department_id)
          where not private.can_manage_department(
            target_organization_id,
            department.department_id
          )
        )
      )
    )
  then
    raise insufficient_privilege using
      message = 'The current member cannot create this channel.';
  end if;

  if target_name !~ '^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$'
    or length(trim(target_display_name)) not between 1 and 120
    or length(trim(target_purpose)) not between 10 and 1000
    or target_type not in (
      'department',
      'interface',
      'project',
      'location',
      'announcement',
      'leadership',
      'incident',
      'direct'
    )
    or target_visibility not in ('public', 'private', 'restricted')
    or cardinality(coalesce(target_location_ids, '{}'::uuid[])) = 0
  then
    raise invalid_parameter_value using
      message = 'The channel details are invalid.';
  end if;

  insert into public.channels (
    organization_id,
    name,
    display_name,
    purpose,
    type,
    visibility,
    owner_member_id,
    is_urgent,
    archive_at
  )
  values (
    target_organization_id,
    target_name,
    trim(target_display_name),
    trim(target_purpose),
    target_type,
    target_visibility,
    current_member_id,
    target_is_urgent,
    target_archive_at
  )
  returning * into created_channel;

  insert into public.channel_locations (
    organization_id,
    channel_id,
    location_id
  )
  select
    target_organization_id,
    created_channel.id,
    location_id
  from (
    select distinct location_id
    from unnest(target_location_ids) as location(location_id)
  ) as locations;

  insert into public.channel_departments (
    organization_id,
    channel_id,
    department_id
  )
  select
    target_organization_id,
    created_channel.id,
    department_id
  from (
    select distinct department_id
    from unnest(coalesce(target_department_ids, '{}'::uuid[]))
      as department(department_id)
  ) as departments;

  insert into public.channel_memberships (
    organization_id,
    channel_id,
    member_id,
    source,
    can_send
  )
  values (
    target_organization_id,
    created_channel.id,
    current_member_id,
    'policy',
    true
  );

  insert into public.audit_events (
    organization_id,
    actor_member_id,
    action,
    target_type,
    target_id,
    metadata
  )
  values (
    target_organization_id,
    current_member_id,
    'channel.created',
    'channel',
    created_channel.id,
    jsonb_build_object(
      'type',
      target_type,
      'visibility',
      target_visibility
    )
  );

  return next created_channel;
end;
$$;

revoke all on function public.save_organization_settings(
  uuid,
  text,
  text,
  text,
  text,
  text,
  integer,
  boolean
) from public;
grant execute on function public.save_organization_settings(
  uuid,
  text,
  text,
  text,
  text,
  text,
  integer,
  boolean
) to authenticated, service_role;

revoke all on function public.save_location(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text
) from public;
grant execute on function public.save_location(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text
) to authenticated, service_role;

revoke all on function public.save_member_assignment(
  uuid,
  uuid,
  text,
  uuid,
  uuid,
  text,
  text,
  timestamptz
) from public;
grant execute on function public.save_member_assignment(
  uuid,
  uuid,
  text,
  uuid,
  uuid,
  text,
  text,
  timestamptz
) to authenticated, service_role;

revoke all on function public.create_managed_channel(
  uuid,
  text,
  text,
  text,
  text,
  text,
  uuid[],
  uuid[],
  timestamptz,
  boolean
) from public;
grant execute on function public.create_managed_channel(
  uuid,
  text,
  text,
  text,
  text,
  text,
  uuid[],
  uuid[],
  timestamptz,
  boolean
) to authenticated, service_role;

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  author_member_id uuid not null,
  organization_wide boolean not null default false,
  title text not null,
  body text not null,
  priority text not null default 'standard'
    check (priority in ('standard', 'urgent')),
  require_acknowledgement boolean not null default false,
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'published', 'expired')),
  scheduled_at timestamptz,
  published_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (organization_id, id),
  foreign key (organization_id, author_member_id)
    references public.organization_members (organization_id, id),
  check (length(trim(title)) between 1 and 240),
  check (length(trim(body)) between 1 and 10000),
  check (expires_at is null or expires_at > created_at),
  check (
    (status = 'published' and published_at is not null)
    or
    (status <> 'published')
  )
);

create table public.announcement_locations (
  organization_id uuid not null references public.organizations (id),
  announcement_id uuid not null,
  location_id uuid not null,
  primary key (announcement_id, location_id),
  foreign key (organization_id, announcement_id)
    references public.announcements (organization_id, id) on delete cascade,
  foreign key (organization_id, location_id)
    references public.locations (organization_id, id) on delete cascade
);

create table public.announcement_departments (
  organization_id uuid not null references public.organizations (id),
  announcement_id uuid not null,
  department_id uuid not null,
  primary key (announcement_id, department_id),
  foreign key (organization_id, announcement_id)
    references public.announcements (organization_id, id) on delete cascade,
  foreign key (organization_id, department_id)
    references public.departments (organization_id, id) on delete cascade
);

create table public.announcement_acknowledgements (
  organization_id uuid not null references public.organizations (id),
  announcement_id uuid not null,
  member_id uuid not null,
  acknowledged_at timestamptz not null default now(),
  primary key (announcement_id, member_id),
  foreign key (organization_id, announcement_id)
    references public.announcements (organization_id, id) on delete cascade,
  foreign key (organization_id, member_id)
    references public.organization_members (organization_id, id)
    on delete cascade
);

create index announcements_published_idx
  on public.announcements (organization_id, published_at desc, id desc)
  where status = 'published' and archived_at is null;
create index announcements_author_member_id_idx
  on public.announcements (author_member_id);
create index announcement_locations_location_id_idx
  on public.announcement_locations (location_id);
create index announcement_departments_department_id_idx
  on public.announcement_departments (department_id);
create index announcement_acknowledgements_member_id_idx
  on public.announcement_acknowledgements (member_id);

create trigger announcements_set_updated_at
  before update on public.announcements
  for each row execute function private.set_updated_at();

create function private.can_view_announcement(
  target_organization_id uuid,
  target_announcement_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.announcements as announcement
    where announcement.organization_id = target_organization_id
      and announcement.id = target_announcement_id
      and announcement.archived_at is null
      and announcement.status = 'published'
      and (
        announcement.expires_at is null
        or announcement.expires_at > now()
      )
      and private.is_active_member(announcement.organization_id)
      and (
        announcement.organization_wide
        or exists (
          select 1
          from public.organization_members as member
          join public.assignments as assignment
            on assignment.organization_id = member.organization_id
            and assignment.member_id = member.id
          where member.organization_id = announcement.organization_id
            and member.user_id = (select auth.uid())
            and assignment.archived_at is null
            and assignment.starts_at <= now()
            and (
              assignment.ends_at is null
              or assignment.ends_at > now()
            )
            and (
              exists (
                select 1
                from public.announcement_locations as audience_location
                where audience_location.announcement_id = announcement.id
                  and audience_location.location_id = assignment.location_id
              )
              or exists (
                select 1
                from public.announcement_departments as audience_department
                where audience_department.announcement_id = announcement.id
                  and audience_department.department_id =
                    assignment.department_id
              )
            )
        )
      )
  );
$$;

revoke all on function private.can_view_announcement(uuid, uuid)
  from public;
grant execute on function private.can_view_announcement(uuid, uuid)
  to authenticated, service_role;

create function public.create_announcement(
  target_organization_id uuid,
  target_title text,
  target_body text,
  target_organization_wide boolean,
  target_location_ids uuid[],
  target_department_ids uuid[],
  target_priority text,
  target_require_acknowledgement boolean,
  target_status text,
  target_expires_at timestamptz
)
returns setof public.announcements
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_member_id uuid;
  created_announcement public.announcements%rowtype;
begin
  current_member_id := private.current_member_id(target_organization_id);
  if not private.session_satisfies_mfa()
    or current_member_id is null
    or (
      target_organization_wide
      and not private.has_role(
        target_organization_id,
        array['owner', 'org_admin']
      )
    )
    or (
      not target_organization_wide
      and cardinality(coalesce(target_location_ids, '{}'::uuid[])) = 0
      and cardinality(coalesce(target_department_ids, '{}'::uuid[])) = 0
    )
    or exists (
      select 1
      from unnest(coalesce(target_location_ids, '{}'::uuid[]))
        as location(location_id)
      where not private.can_manage_location(
        target_organization_id,
        location.location_id
      )
    )
    or exists (
      select 1
      from unnest(coalesce(target_department_ids, '{}'::uuid[]))
        as department(department_id)
      where not private.can_manage_department(
        target_organization_id,
        department.department_id
      )
    )
  then
    raise insufficient_privilege using
      message = 'The current member cannot publish to this audience.';
  end if;

  if length(trim(target_title)) not between 1 and 240
    or length(trim(target_body)) not between 1 and 10000
    or target_priority not in ('standard', 'urgent')
    or target_status not in ('draft', 'published')
    or (target_expires_at is not null and target_expires_at <= now())
  then
    raise invalid_parameter_value using
      message = 'The announcement details are invalid.';
  end if;

  insert into public.announcements (
    organization_id,
    author_member_id,
    organization_wide,
    title,
    body,
    priority,
    require_acknowledgement,
    status,
    published_at,
    expires_at
  )
  values (
    target_organization_id,
    current_member_id,
    target_organization_wide,
    trim(target_title),
    trim(target_body),
    target_priority,
    target_require_acknowledgement,
    target_status,
    case when target_status = 'published' then now() else null end,
    target_expires_at
  )
  returning * into created_announcement;

  insert into public.announcement_locations (
    organization_id,
    announcement_id,
    location_id
  )
  select
    target_organization_id,
    created_announcement.id,
    location_id
  from (
    select distinct location_id
    from unnest(coalesce(target_location_ids, '{}'::uuid[]))
      as location(location_id)
  ) as locations;

  insert into public.announcement_departments (
    organization_id,
    announcement_id,
    department_id
  )
  select
    target_organization_id,
    created_announcement.id,
    department_id
  from (
    select distinct department_id
    from unnest(coalesce(target_department_ids, '{}'::uuid[]))
      as department(department_id)
  ) as departments;

  insert into public.audit_events (
    organization_id,
    actor_member_id,
    action,
    target_type,
    target_id,
    metadata
  )
  values (
    target_organization_id,
    current_member_id,
    'announcement.created',
    'announcement',
    created_announcement.id,
    jsonb_build_object(
      'priority',
      target_priority,
      'status',
      target_status,
      'organization_wide',
      target_organization_wide,
      'requires_acknowledgement',
      target_require_acknowledgement
    )
  );

  return next created_announcement;
end;
$$;

create function public.acknowledge_announcement(
  target_organization_id uuid,
  target_announcement_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_member_id uuid;
begin
  if not private.session_satisfies_mfa()
    or not private.can_view_announcement(
      target_organization_id,
      target_announcement_id
    )
  then
    raise insufficient_privilege using
      message = 'The announcement is not available.';
  end if;

  current_member_id := private.current_member_id(target_organization_id);

  insert into public.announcement_acknowledgements (
    organization_id,
    announcement_id,
    member_id
  )
  values (
    target_organization_id,
    target_announcement_id,
    current_member_id
  )
  on conflict (announcement_id, member_id) do nothing;
end;
$$;

revoke all on function public.create_announcement(
  uuid,
  text,
  text,
  boolean,
  uuid[],
  uuid[],
  text,
  boolean,
  text,
  timestamptz
) from public;
grant execute on function public.create_announcement(
  uuid,
  text,
  text,
  boolean,
  uuid[],
  uuid[],
  text,
  boolean,
  text,
  timestamptz
) to authenticated, service_role;
revoke all on function public.acknowledge_announcement(uuid, uuid)
  from public;
grant execute on function public.acknowledge_announcement(uuid, uuid)
  to authenticated, service_role;

alter table public.announcements enable row level security;
alter table public.announcement_locations enable row level security;
alter table public.announcement_departments enable row level security;
alter table public.announcement_acknowledgements enable row level security;

create policy "audience members can read announcements"
  on public.announcements for select
  to authenticated
  using (
    private.can_view_announcement(organization_id, id)
    or private.has_role(
      organization_id,
      array[
        'owner',
        'org_admin',
        'location_manager',
        'department_lead'
      ]
    )
  );
create policy "audience members can read announcement locations"
  on public.announcement_locations for select
  to authenticated
  using (
    private.can_view_announcement(organization_id, announcement_id)
    or private.has_role(
      organization_id,
      array[
        'owner',
        'org_admin',
        'location_manager',
        'department_lead'
      ]
    )
  );
create policy "audience members can read announcement departments"
  on public.announcement_departments for select
  to authenticated
  using (
    private.can_view_announcement(organization_id, announcement_id)
    or private.has_role(
      organization_id,
      array[
        'owner',
        'org_admin',
        'location_manager',
        'department_lead'
      ]
    )
  );
create policy "members can read announcement acknowledgements"
  on public.announcement_acknowledgements for select
  to authenticated
  using (
    member_id = private.current_member_id(organization_id)
    or private.has_role(
      organization_id,
      array['owner', 'org_admin', 'location_manager', 'department_lead']
    )
  );

create policy "aal2 required for announcements"
  on public.announcements as restrictive for all to authenticated
  using ((select private.session_satisfies_mfa()))
  with check ((select private.session_satisfies_mfa()));
create policy "aal2 required for announcement locations"
  on public.announcement_locations as restrictive for all to authenticated
  using ((select private.session_satisfies_mfa()))
  with check ((select private.session_satisfies_mfa()));
create policy "aal2 required for announcement departments"
  on public.announcement_departments as restrictive for all to authenticated
  using ((select private.session_satisfies_mfa()))
  with check ((select private.session_satisfies_mfa()));
create policy "aal2 required for announcement acknowledgements"
  on public.announcement_acknowledgements
  as restrictive for all to authenticated
  using ((select private.session_satisfies_mfa()))
  with check ((select private.session_satisfies_mfa()));

revoke all on table public.announcements
  from public, anon, authenticated;
revoke all on table public.announcement_locations
  from public, anon, authenticated;
revoke all on table public.announcement_departments
  from public, anon, authenticated;
revoke all on table public.announcement_acknowledgements
  from public, anon, authenticated;
grant select on table public.announcements to authenticated;
grant select on table public.announcement_locations to authenticated;
grant select on table public.announcement_departments to authenticated;
grant select on table public.announcement_acknowledgements to authenticated;
grant all on table public.announcements to service_role;
grant all on table public.announcement_locations to service_role;
grant all on table public.announcement_departments to service_role;
grant all on table public.announcement_acknowledgements to service_role;

create table public.access_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  channel_id uuid not null,
  requester_member_id uuid not null,
  approver_member_id uuid,
  reason text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'denied', 'expired')),
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  expires_at timestamptz,
  unique (organization_id, id),
  foreign key (organization_id, channel_id)
    references public.channels (organization_id, id) on delete cascade,
  foreign key (organization_id, requester_member_id)
    references public.organization_members (organization_id, id),
  foreign key (organization_id, approver_member_id)
    references public.organization_members (organization_id, id),
  check (length(trim(reason)) between 10 and 1000),
  check (
    (status = 'pending' and resolved_at is null and approver_member_id is null)
    or
    (status <> 'pending' and resolved_at is not null)
  )
);

create unique index access_requests_pending_key
  on public.access_requests (channel_id, requester_member_id)
  where status = 'pending';
create index access_requests_requester_idx
  on public.access_requests (requester_member_id);
create index access_requests_approver_idx
  on public.access_requests (approver_member_id)
  where approver_member_id is not null;

create table public.policy_warning_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  actor_member_id uuid not null,
  channel_id uuid,
  field text not null
    check (field in ('channel_name', 'purpose', 'message', 'attachment')),
  rule_id text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, actor_member_id)
    references public.organization_members (organization_id, id),
  foreign key (organization_id, channel_id)
    references public.channels (organization_id, id),
  check (length(trim(rule_id)) between 2 and 120)
);

create index policy_warning_events_org_created_idx
  on public.policy_warning_events (organization_id, created_at desc, id desc);
create index policy_warning_events_actor_idx
  on public.policy_warning_events (actor_member_id);
create index policy_warning_events_channel_idx
  on public.policy_warning_events (channel_id)
  where channel_id is not null;

create function public.resolve_access_request(
  target_organization_id uuid,
  target_request_id uuid,
  target_status text,
  target_access_expires_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_row public.access_requests%rowtype;
  current_member_id uuid;
begin
  select *
  into request_row
  from public.access_requests
  where organization_id = target_organization_id
    and id = target_request_id
    and status = 'pending';

  if request_row.id is null
    or target_status not in ('approved', 'denied')
    or not private.session_satisfies_mfa()
    or not private.can_manage_channel(
      target_organization_id,
      request_row.channel_id
    )
  then
    raise insufficient_privilege using
      message = 'The access request cannot be resolved.';
  end if;

  current_member_id := private.current_member_id(target_organization_id);

  update public.access_requests
  set
    status = target_status,
    approver_member_id = current_member_id,
    resolved_at = now(),
    expires_at = target_access_expires_at
  where id = target_request_id;

  if target_status = 'approved' then
    insert into public.channel_memberships (
      organization_id,
      channel_id,
      member_id,
      source,
      can_send,
      expires_at
    )
    values (
      target_organization_id,
      request_row.channel_id,
      request_row.requester_member_id,
      'access_request',
      true,
      target_access_expires_at
    )
    on conflict (channel_id, member_id, source)
      where archived_at is null
    do update
    set
      can_send = true,
      expires_at = excluded.expires_at,
      updated_at = now();
  end if;
end;
$$;

create function public.record_policy_warning(
  target_organization_id uuid,
  target_channel_id uuid,
  target_field text,
  target_rule_id text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_member_id uuid;
begin
  current_member_id := private.current_member_id(target_organization_id);
  if not private.session_satisfies_mfa()
    or current_member_id is null
    or (
      target_channel_id is not null
      and not private.has_channel_access(
        target_organization_id,
        target_channel_id,
        false
      )
    )
  then
    raise insufficient_privilege using
      message = 'The policy warning cannot be recorded.';
  end if;

  insert into public.policy_warning_events (
    organization_id,
    actor_member_id,
    channel_id,
    field,
    rule_id
  )
  values (
    target_organization_id,
    current_member_id,
    target_channel_id,
    target_field,
    trim(target_rule_id)
  );
end;
$$;

revoke all on function public.resolve_access_request(
  uuid,
  uuid,
  text,
  timestamptz
) from public;
grant execute on function public.resolve_access_request(
  uuid,
  uuid,
  text,
  timestamptz
) to authenticated, service_role;
revoke all on function public.record_policy_warning(
  uuid,
  uuid,
  text,
  text
) from public;
grant execute on function public.record_policy_warning(
  uuid,
  uuid,
  text,
  text
) to authenticated, service_role;

alter table public.access_requests enable row level security;
alter table public.policy_warning_events enable row level security;

create policy "members can read relevant access requests"
  on public.access_requests for select
  to authenticated
  using (
    requester_member_id = private.current_member_id(organization_id)
    or private.can_manage_channel(organization_id, channel_id)
  );
create policy "members can create access requests"
  on public.access_requests for insert
  to authenticated
  with check (
    requester_member_id = private.current_member_id(organization_id)
    and private.is_active_member(organization_id)
  );
create policy "members can read relevant policy warning events"
  on public.policy_warning_events for select
  to authenticated
  using (
    actor_member_id = private.current_member_id(organization_id)
    or private.can_view_audit_event(organization_id, null)
  );

create policy "aal2 required for access requests"
  on public.access_requests as restrictive for all to authenticated
  using ((select private.session_satisfies_mfa()))
  with check ((select private.session_satisfies_mfa()));
create policy "aal2 required for policy warning events"
  on public.policy_warning_events as restrictive for all to authenticated
  using ((select private.session_satisfies_mfa()))
  with check ((select private.session_satisfies_mfa()));

revoke all on table public.access_requests
  from public, anon, authenticated;
revoke all on table public.policy_warning_events
  from public, anon, authenticated;
grant select, insert on table public.access_requests to authenticated;
grant select on table public.policy_warning_events to authenticated;
grant all on table public.access_requests to service_role;
grant all on table public.policy_warning_events to service_role;
