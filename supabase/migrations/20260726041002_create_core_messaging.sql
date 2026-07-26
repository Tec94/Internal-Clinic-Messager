create table public.channels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  name text not null,
  display_name text not null,
  purpose text not null,
  type text not null check (
    type in (
      'department',
      'interface',
      'project',
      'location',
      'announcement',
      'leadership',
      'incident',
      'direct'
    )
  ),
  visibility text not null default 'private'
    check (visibility in ('public', 'private', 'restricted')),
  owner_member_id uuid not null,
  is_urgent boolean not null default false,
  archive_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (organization_id, id),
  foreign key (organization_id, owner_member_id)
    references public.organization_members (organization_id, id),
  check (name ~ '^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$'),
  check (length(trim(display_name)) between 1 and 120),
  check (length(trim(purpose)) between 10 and 1000),
  check (archive_at is null or archive_at > created_at)
);

create unique index channels_active_name_key
  on public.channels (organization_id, lower(name))
  where archived_at is null;

create table public.channel_locations (
  organization_id uuid not null references public.organizations (id),
  channel_id uuid not null,
  location_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (channel_id, location_id),
  foreign key (organization_id, channel_id)
    references public.channels (organization_id, id) on delete cascade,
  foreign key (organization_id, location_id)
    references public.locations (organization_id, id) on delete cascade
);

create table public.channel_departments (
  organization_id uuid not null references public.organizations (id),
  channel_id uuid not null,
  department_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (channel_id, department_id),
  foreign key (organization_id, channel_id)
    references public.channels (organization_id, id) on delete cascade,
  foreign key (organization_id, department_id)
    references public.departments (organization_id, id) on delete cascade
);

create table public.channel_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  channel_id uuid not null,
  member_id uuid not null,
  source text not null
    check (source in ('policy', 'invitation', 'access_request')),
  can_send boolean not null default true,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (organization_id, id),
  foreign key (organization_id, channel_id)
    references public.channels (organization_id, id) on delete cascade,
  foreign key (organization_id, member_id)
    references public.organization_members (organization_id, id) on delete cascade,
  check (expires_at is null or expires_at > starts_at)
);

create unique index channel_memberships_active_source_key
  on public.channel_memberships (channel_id, member_id, source)
  where archived_at is null;

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  channel_id uuid not null,
  author_member_id uuid not null,
  client_message_id uuid not null,
  body text not null,
  is_urgent boolean not null default false,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (channel_id, client_message_id),
  foreign key (organization_id, channel_id)
    references public.channels (organization_id, id),
  foreign key (organization_id, author_member_id)
    references public.organization_members (organization_id, id),
  check (length(trim(body)) between 1 and 10000)
);

create table public.message_receipts (
  organization_id uuid not null references public.organizations (id),
  message_id uuid not null,
  member_id uuid not null,
  status text not null default 'delivered'
    check (status in ('delivered', 'read')),
  delivered_at timestamptz not null default now(),
  read_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (message_id, member_id),
  foreign key (organization_id, message_id)
    references public.messages (organization_id, id) on delete cascade,
  foreign key (organization_id, member_id)
    references public.organization_members (organization_id, id) on delete cascade,
  check (
    (status = 'delivered' and read_at is null)
    or
    (status = 'read' and read_at is not null)
  )
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  actor_member_id uuid,
  action text not null,
  target_type text not null,
  target_id uuid,
  location_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, actor_member_id)
    references public.organization_members (organization_id, id),
  foreign key (organization_id, location_id)
    references public.locations (organization_id, id),
  check (length(trim(action)) between 3 and 120),
  check (length(trim(target_type)) between 2 and 80),
  check (jsonb_typeof(metadata) = 'object')
);

create index channels_owner_member_id_idx
  on public.channels (owner_member_id);
create index channel_locations_location_id_idx
  on public.channel_locations (location_id);
create index channel_departments_department_id_idx
  on public.channel_departments (department_id);
create index channel_memberships_member_channel_idx
  on public.channel_memberships (organization_id, member_id, channel_id)
  where archived_at is null;
create index channel_memberships_channel_member_idx
  on public.channel_memberships (organization_id, channel_id, member_id)
  where archived_at is null;
create index channel_memberships_channel_id_idx
  on public.channel_memberships (channel_id);
create index channel_memberships_member_id_idx
  on public.channel_memberships (member_id);
create index messages_channel_created_at_idx
  on public.messages (organization_id, channel_id, created_at desc, id desc);
create index messages_author_member_id_idx
  on public.messages (author_member_id);
create index message_receipts_member_id_idx
  on public.message_receipts (member_id);
create index audit_events_organization_created_at_idx
  on public.audit_events (organization_id, created_at desc, id desc);
create index audit_events_actor_member_id_idx
  on public.audit_events (actor_member_id)
  where actor_member_id is not null;
create index audit_events_location_id_idx
  on public.audit_events (location_id)
  where location_id is not null;

create trigger channels_set_updated_at
  before update on public.channels
  for each row execute function private.set_updated_at();
create trigger channel_memberships_set_updated_at
  before update on public.channel_memberships
  for each row execute function private.set_updated_at();
create trigger message_receipts_set_updated_at
  before update on public.message_receipts
  for each row execute function private.set_updated_at();

create function private.audit_onboarding_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status <> 'complete' and new.status = 'complete' then
    insert into public.audit_events (
      organization_id,
      actor_member_id,
      action,
      target_type,
      target_id,
      metadata
    )
    values (
      new.organization_id,
      new.member_id,
      'onboarding.completed',
      'organization_member',
      new.member_id,
      jsonb_build_object(
        'policy_version',
        new.accepted_policy_version,
        'notifications_enabled',
        new.notifications_enabled
      )
    );
  end if;

  return new;
end;
$$;

revoke all on function private.audit_onboarding_completion() from public;

create trigger onboarding_progress_audit_completion
  after update on public.onboarding_progress
  for each row execute function private.audit_onboarding_completion();

create function private.is_current_member(
  target_organization_id uuid,
  target_member_id uuid
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
    where member.organization_id = target_organization_id
      and member.id = target_member_id
      and member.user_id = (select auth.uid())
      and member.status = 'active'
      and member.archived_at is null
      and member.starts_at <= now()
      and (member.expires_at is null or member.expires_at > now())
  );
$$;

create function private.has_channel_access(
  target_organization_id uuid,
  target_channel_id uuid,
  require_send_access boolean default false
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
    join public.channel_memberships as membership
      on membership.organization_id = member.organization_id
      and membership.member_id = member.id
    join public.channels as channel
      on channel.organization_id = membership.organization_id
      and channel.id = membership.channel_id
    where member.organization_id = target_organization_id
      and member.user_id = (select auth.uid())
      and member.status = 'active'
      and member.archived_at is null
      and member.starts_at <= now()
      and (member.expires_at is null or member.expires_at > now())
      and membership.channel_id = target_channel_id
      and membership.archived_at is null
      and membership.starts_at <= now()
      and (membership.expires_at is null or membership.expires_at > now())
      and (not require_send_access or membership.can_send)
      and channel.archived_at is null
      and (channel.archive_at is null or channel.archive_at > now())
  );
$$;

create function private.can_insert_message(
  target_organization_id uuid,
  target_channel_id uuid,
  target_author_member_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_current_member(
    target_organization_id,
    target_author_member_id
  )
  and private.has_channel_access(
    target_organization_id,
    target_channel_id,
    true
  )
  and exists (
    select 1
    from public.channels as channel
    where channel.organization_id = target_organization_id
      and channel.id = target_channel_id
      and channel.type <> 'announcement'
  );
$$;

create function private.can_view_audit_event(
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
    array['owner', 'org_admin', 'it_support']
  )
  or (
    target_location_id is not null
    and private.can_manage_location(
      target_organization_id,
      target_location_id
    )
  );
$$;

create function public.complete_staff_onboarding(
  target_member_id uuid,
  target_full_name text,
  target_locale text,
  target_quiet_hours_start time,
  target_quiet_hours_end time,
  target_notifications_enabled boolean
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_organization_id uuid;
  affected_rows integer;
begin
  if target_full_name is null
    or length(trim(target_full_name)) not between 2 and 120 then
    raise exception using
      errcode = '22023',
      message = 'full name must contain between 2 and 120 characters';
  end if;

  if target_locale not in ('en-US', 'vi-VN') then
    raise exception using
      errcode = '22023',
      message = 'locale must be en-US or vi-VN';
  end if;

  if (target_quiet_hours_start is null) <> (target_quiet_hours_end is null) then
    raise exception using
      errcode = '22023',
      message = 'quiet hours must include both a start and an end';
  end if;

  if target_notifications_enabled is null then
    raise exception using
      errcode = '22023',
      message = 'notifications preference is required';
  end if;

  select member.organization_id
  into target_organization_id
  from public.organization_members as member
  where member.id = target_member_id
    and member.user_id = (select auth.uid());

  if target_organization_id is null
    or not private.is_current_member(
      target_organization_id,
      target_member_id
    ) then
    raise exception using
      errcode = '42501',
      message = 'an active member can complete only their own onboarding';
  end if;

  update public.profiles
  set full_name = trim(target_full_name),
      locale = target_locale
  where id = (select auth.uid());

  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception using
      errcode = 'P0002',
      message = 'the staff profile is missing';
  end if;

  update public.onboarding_progress
  set status = 'complete',
      locale = target_locale,
      quiet_hours_start = target_quiet_hours_start,
      quiet_hours_end = target_quiet_hours_end,
      notifications_enabled = target_notifications_enabled
  where organization_id = target_organization_id
    and member_id = target_member_id;

  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception using
      errcode = 'P0002',
      message = 'the onboarding record is missing';
  end if;
end;
$$;

revoke all on function public.complete_staff_onboarding(
  uuid,
  text,
  text,
  time,
  time,
  boolean
) from public;

revoke all on function private.is_current_member(uuid, uuid) from public;
revoke all on function private.has_channel_access(uuid, uuid, boolean) from public;
revoke all on function private.can_insert_message(uuid, uuid, uuid) from public;
revoke all on function private.can_view_audit_event(uuid, uuid) from public;

grant execute on function private.is_current_member(uuid, uuid)
  to authenticated, service_role;
grant execute on function private.has_channel_access(uuid, uuid, boolean)
  to authenticated, service_role;
grant execute on function private.can_insert_message(uuid, uuid, uuid)
  to authenticated, service_role;
grant execute on function private.can_view_audit_event(uuid, uuid)
  to authenticated, service_role;
grant execute on function public.complete_staff_onboarding(
  uuid,
  text,
  text,
  time,
  time,
  boolean
) to authenticated, service_role;

alter table public.channels enable row level security;
alter table public.channel_locations enable row level security;
alter table public.channel_departments enable row level security;
alter table public.channel_memberships enable row level security;
alter table public.messages enable row level security;
alter table public.message_receipts enable row level security;
alter table public.audit_events enable row level security;

create policy "members can read joined channels"
  on public.channels for select
  to authenticated
  using (private.has_channel_access(organization_id, id));

create policy "members can read joined channel locations"
  on public.channel_locations for select
  to authenticated
  using (private.has_channel_access(organization_id, channel_id));

create policy "members can read joined channel departments"
  on public.channel_departments for select
  to authenticated
  using (private.has_channel_access(organization_id, channel_id));

create policy "members can read joined channel memberships"
  on public.channel_memberships for select
  to authenticated
  using (private.has_channel_access(organization_id, channel_id));

create policy "members can read joined channel messages"
  on public.messages for select
  to authenticated
  using (private.has_channel_access(organization_id, channel_id));

create policy "members can send to writable channels"
  on public.messages for insert
  to authenticated
  with check (
    private.can_insert_message(
      organization_id,
      channel_id,
      author_member_id
    )
  );

create policy "members can read receipts in joined channels"
  on public.message_receipts for select
  to authenticated
  using (
    exists (
      select 1
      from public.messages as message
      where message.id = message_receipts.message_id
        and message.organization_id = message_receipts.organization_id
        and private.has_channel_access(
          message.organization_id,
          message.channel_id
        )
    )
  );

create policy "members can insert their own receipts"
  on public.message_receipts for insert
  to authenticated
  with check (
    private.is_current_member(organization_id, member_id)
    and exists (
      select 1
      from public.messages as message
      where message.id = message_receipts.message_id
        and message.organization_id = message_receipts.organization_id
        and private.has_channel_access(
          message.organization_id,
          message.channel_id
        )
    )
  );

create policy "members can update their own receipts"
  on public.message_receipts for update
  to authenticated
  using (private.is_current_member(organization_id, member_id))
  with check (private.is_current_member(organization_id, member_id));

create policy "authorized staff can read audit events"
  on public.audit_events for select
  to authenticated
  using (private.can_view_audit_event(organization_id, location_id));

create policy "aal2 required for channels"
  on public.channels as restrictive for all
  to authenticated
  using (((select auth.jwt()) ->> 'aal') = 'aal2')
  with check (((select auth.jwt()) ->> 'aal') = 'aal2');
create policy "aal2 required for channel locations"
  on public.channel_locations as restrictive for all
  to authenticated
  using (((select auth.jwt()) ->> 'aal') = 'aal2')
  with check (((select auth.jwt()) ->> 'aal') = 'aal2');
create policy "aal2 required for channel departments"
  on public.channel_departments as restrictive for all
  to authenticated
  using (((select auth.jwt()) ->> 'aal') = 'aal2')
  with check (((select auth.jwt()) ->> 'aal') = 'aal2');
create policy "aal2 required for channel memberships"
  on public.channel_memberships as restrictive for all
  to authenticated
  using (((select auth.jwt()) ->> 'aal') = 'aal2')
  with check (((select auth.jwt()) ->> 'aal') = 'aal2');
create policy "aal2 required for messages"
  on public.messages as restrictive for all
  to authenticated
  using (((select auth.jwt()) ->> 'aal') = 'aal2')
  with check (((select auth.jwt()) ->> 'aal') = 'aal2');
create policy "aal2 required for message receipts"
  on public.message_receipts as restrictive for all
  to authenticated
  using (((select auth.jwt()) ->> 'aal') = 'aal2')
  with check (((select auth.jwt()) ->> 'aal') = 'aal2');
create policy "aal2 required for audit events"
  on public.audit_events as restrictive for all
  to authenticated
  using (((select auth.jwt()) ->> 'aal') = 'aal2')
  with check (((select auth.jwt()) ->> 'aal') = 'aal2');

revoke all on table public.channels from anon;
revoke all on table public.channel_locations from anon;
revoke all on table public.channel_departments from anon;
revoke all on table public.channel_memberships from anon;
revoke all on table public.messages from anon;
revoke all on table public.message_receipts from anon;
revoke all on table public.audit_events from anon;

grant select on table public.channels to authenticated;
grant select on table public.channel_locations to authenticated;
grant select on table public.channel_departments to authenticated;
grant select on table public.channel_memberships to authenticated;
grant select, insert on table public.messages to authenticated;
grant select, insert, update (status, read_at)
  on table public.message_receipts to authenticated;
grant select on table public.audit_events to authenticated;

grant all on table public.channels to service_role;
grant all on table public.channel_locations to service_role;
grant all on table public.channel_departments to service_role;
grant all on table public.channel_memberships to service_role;
grant all on table public.messages to service_role;
grant all on table public.message_receipts to service_role;
grant all on table public.audit_events to service_role;

alter publication supabase_realtime add table public.messages;
