create function private.current_member_id(target_organization_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select member.id
  from public.organization_members as member
  where member.organization_id = target_organization_id
    and member.user_id = (select auth.uid())
    and member.status = 'active'
    and member.archived_at is null
    and member.starts_at <= now()
    and (member.expires_at is null or member.expires_at > now())
  limit 1;
$$;

revoke all on function private.current_member_id(uuid) from public;
grant execute on function private.current_member_id(uuid)
  to authenticated, service_role;

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  channel_id uuid not null,
  owner_member_id uuid not null,
  created_by_member_id uuid not null,
  client_task_id uuid not null,
  client_message_id uuid not null,
  title text not null,
  due_at timestamptz not null,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'done')),
  source_message_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  archived_at timestamptz,
  unique (organization_id, id),
  unique (channel_id, client_task_id),
  unique (channel_id, client_message_id),
  foreign key (organization_id, channel_id)
    references public.channels (organization_id, id),
  foreign key (organization_id, owner_member_id)
    references public.organization_members (organization_id, id),
  foreign key (organization_id, created_by_member_id)
    references public.organization_members (organization_id, id),
  foreign key (organization_id, source_message_id)
    references public.messages (organization_id, id),
  check (length(trim(title)) between 1 and 240),
  check (
    (status = 'done' and completed_at is not null)
    or
    (status <> 'done' and completed_at is null)
  )
);

alter table public.messages
  add column task_id uuid;

alter table public.messages
  add constraint messages_task_fk
  foreign key (organization_id, task_id)
  references public.tasks (organization_id, id);

create table public.task_collaborators (
  organization_id uuid not null references public.organizations (id),
  task_id uuid not null,
  member_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (task_id, member_id),
  foreign key (organization_id, task_id)
    references public.tasks (organization_id, id) on delete cascade,
  foreign key (organization_id, member_id)
    references public.organization_members (organization_id, id)
    on delete cascade
);

create table public.task_checklist_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  task_id uuid not null,
  position integer not null check (position between 0 and 99),
  label text not null check (length(trim(label)) between 1 and 500),
  completed boolean not null default false,
  completed_by_member_id uuid,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (task_id, position),
  foreign key (organization_id, task_id)
    references public.tasks (organization_id, id) on delete cascade,
  foreign key (organization_id, completed_by_member_id)
    references public.organization_members (organization_id, id),
  check (
    (completed and completed_at is not null and completed_by_member_id is not null)
    or
    (not completed and completed_at is null and completed_by_member_id is null)
  )
);

create table public.task_attachments (
  organization_id uuid not null references public.organizations (id),
  task_id uuid not null,
  attachment_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (task_id, attachment_id),
  foreign key (organization_id, task_id)
    references public.tasks (organization_id, id) on delete cascade,
  foreign key (organization_id, attachment_id)
    references public.attachments (organization_id, id)
);

create index tasks_channel_due_at_idx
  on public.tasks (organization_id, channel_id, due_at, id)
  where archived_at is null;
create index tasks_owner_due_at_idx
  on public.tasks (organization_id, owner_member_id, due_at, id)
  where archived_at is null;
create index tasks_created_by_member_id_idx
  on public.tasks (created_by_member_id);
create index tasks_source_message_id_idx
  on public.tasks (source_message_id)
  where source_message_id is not null;
create index messages_task_id_idx
  on public.messages (task_id)
  where task_id is not null;
create index task_collaborators_member_id_idx
  on public.task_collaborators (member_id);
create index task_checklist_items_task_position_idx
  on public.task_checklist_items (task_id, position);
create index task_checklist_items_completed_by_idx
  on public.task_checklist_items (completed_by_member_id)
  where completed_by_member_id is not null;
create index task_attachments_attachment_id_idx
  on public.task_attachments (attachment_id);

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function private.set_updated_at();
create trigger task_checklist_items_set_updated_at
  before update on public.task_checklist_items
  for each row execute function private.set_updated_at();

create function private.can_access_task(
  target_organization_id uuid,
  target_task_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tasks as task
    where task.organization_id = target_organization_id
      and task.id = target_task_id
      and task.archived_at is null
      and private.has_channel_access(
        task.organization_id,
        task.channel_id,
        false
      )
      and (
        task.owner_member_id = private.current_member_id(task.organization_id)
        or task.created_by_member_id =
          private.current_member_id(task.organization_id)
        or exists (
          select 1
          from public.task_collaborators as collaborator
          where collaborator.organization_id = task.organization_id
            and collaborator.task_id = task.id
            and collaborator.member_id =
              private.current_member_id(task.organization_id)
        )
      )
  );
$$;

revoke all on function private.can_access_task(uuid, uuid) from public;
grant execute on function private.can_access_task(uuid, uuid)
  to authenticated, service_role;

create function public.create_task_with_message(
  target_organization_id uuid,
  target_channel_id uuid,
  target_owner_member_id uuid,
  target_collaborator_ids uuid[],
  target_title text,
  target_due_at timestamptz,
  target_checklist_labels text[],
  target_attachment_ids uuid[],
  target_client_task_id uuid,
  target_client_message_id uuid,
  target_message_body text
)
returns setof public.tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_member_id uuid;
  existing_task public.tasks%rowtype;
  created_task public.tasks%rowtype;
  created_message public.messages%rowtype;
  requested_member_count integer;
  matched_member_count integer;
  attachment_count integer;
begin
  if not private.session_satisfies_mfa() then
    raise insufficient_privilege using
      message = 'An AAL2 session is required.';
  end if;

  current_member_id := private.current_member_id(target_organization_id);
  if current_member_id is null
    or not private.can_insert_message(
      target_organization_id,
      target_channel_id,
      current_member_id
    )
  then
    raise insufficient_privilege using
      message = 'The current member cannot create a task in this channel.';
  end if;

  if target_client_task_id is null or target_client_message_id is null then
    raise invalid_parameter_value using
      message = 'Client task and message identifiers are required.';
  end if;

  if length(trim(target_title)) not between 1 and 240 then
    raise invalid_parameter_value using
      message = 'Task titles must contain between 1 and 240 characters.';
  end if;

  if target_due_at <= now() - interval '1 day' then
    raise invalid_parameter_value using
      message = 'The task due time is invalid.';
  end if;

  if cardinality(coalesce(target_checklist_labels, '{}'::text[])) > 50
    or exists (
      select 1
      from unnest(coalesce(target_checklist_labels, '{}'::text[]))
        as item(label)
      where length(trim(item.label)) not between 1 and 500
    )
  then
    raise invalid_parameter_value using
      message = 'The task checklist is invalid.';
  end if;

  select task.*
  into existing_task
  from public.tasks as task
  where task.channel_id = target_channel_id
    and task.client_task_id = target_client_task_id;

  if found then
    if existing_task.organization_id <> target_organization_id
      or existing_task.owner_member_id <> target_owner_member_id
      or existing_task.created_by_member_id <> current_member_id
      or existing_task.client_message_id <> target_client_message_id
      or existing_task.title <> trim(target_title)
      or existing_task.due_at <> target_due_at
    then
      raise unique_violation using
        message = 'client_task_id already represents another task.';
    end if;
    return next existing_task;
    return;
  end if;

  select count(distinct requested.member_id)
  into requested_member_count
  from unnest(
    array_append(
      coalesce(target_collaborator_ids, '{}'::uuid[]),
      target_owner_member_id
    )
  ) as requested(member_id);

  select count(distinct membership.member_id)
  into matched_member_count
  from public.channel_memberships as membership
  where membership.organization_id = target_organization_id
    and membership.channel_id = target_channel_id
    and membership.member_id = any(
      array_append(
        coalesce(target_collaborator_ids, '{}'::uuid[]),
        target_owner_member_id
      )
    )
    and membership.archived_at is null
    and membership.starts_at <= now()
    and (
      membership.expires_at is null
      or membership.expires_at > now()
    );

  if requested_member_count <> matched_member_count then
    raise insufficient_privilege using
      message = 'Task owners and collaborators must be active channel members.';
  end if;

  attachment_count := cardinality(
    coalesce(target_attachment_ids, '{}'::uuid[])
  );
  if attachment_count > 5 then
    raise check_violation using
      message = 'A task can contain at most five attachments.';
  end if;

  insert into public.tasks (
    organization_id,
    channel_id,
    owner_member_id,
    created_by_member_id,
    client_task_id,
    client_message_id,
    title,
    due_at
  )
  values (
    target_organization_id,
    target_channel_id,
    target_owner_member_id,
    current_member_id,
    target_client_task_id,
    target_client_message_id,
    trim(target_title),
    target_due_at
  )
  returning * into created_task;

  insert into public.task_collaborators (
    organization_id,
    task_id,
    member_id
  )
  select
    target_organization_id,
    created_task.id,
    requested.member_id
  from (
    select distinct member_id
    from unnest(coalesce(target_collaborator_ids, '{}'::uuid[]))
      as member(member_id)
    where member_id <> target_owner_member_id
  ) as requested;

  insert into public.task_checklist_items (
    organization_id,
    task_id,
    position,
    label
  )
  select
    target_organization_id,
    created_task.id,
    item.ordinality - 1,
    trim(item.label)
  from unnest(coalesce(target_checklist_labels, '{}'::text[]))
    with ordinality as item(label, ordinality);

  select message.*
  into created_message
  from private.send_message_with_attachments(
    target_organization_id,
    target_channel_id,
    current_member_id,
    target_client_message_id,
    target_message_body,
    false,
    coalesce(target_attachment_ids, '{}'::uuid[])
  ) as message;

  update public.tasks
  set source_message_id = created_message.id
  where id = created_task.id
  returning * into created_task;

  update public.messages
  set task_id = created_task.id
  where id = created_message.id;

  insert into public.task_attachments (
    organization_id,
    task_id,
    attachment_id
  )
  select
    target_organization_id,
    created_task.id,
    attachment_id
  from unnest(coalesce(target_attachment_ids, '{}'::uuid[]))
    as requested(attachment_id);

  return next created_task;
end;
$$;

create function public.set_task_checklist_item(
  target_organization_id uuid,
  target_task_id uuid,
  target_item_id uuid,
  target_completed boolean
)
returns setof public.tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_member_id uuid;
  saved_task public.tasks%rowtype;
  total_items integer;
  completed_items integer;
begin
  if not private.session_satisfies_mfa()
    or not private.can_access_task(target_organization_id, target_task_id)
  then
    raise insufficient_privilege using
      message = 'The current member cannot update this task.';
  end if;

  current_member_id := private.current_member_id(target_organization_id);

  update public.task_checklist_items
  set
    completed = target_completed,
    completed_by_member_id = case
      when target_completed then current_member_id
      else null
    end,
    completed_at = case
      when target_completed then now()
      else null
    end
  where organization_id = target_organization_id
    and task_id = target_task_id
    and id = target_item_id;

  if not found then
    raise no_data_found using
      message = 'The checklist item does not exist.';
  end if;

  select count(*), count(*) filter (where completed)
  into total_items, completed_items
  from public.task_checklist_items
  where organization_id = target_organization_id
    and task_id = target_task_id;

  update public.tasks
  set
    status = case
      when total_items > 0 and completed_items = total_items then 'done'
      when completed_items > 0 then 'in_progress'
      else 'open'
    end,
    completed_at = case
      when total_items > 0 and completed_items = total_items then now()
      else null
    end
  where organization_id = target_organization_id
    and id = target_task_id
  returning * into saved_task;

  return next saved_task;
end;
$$;

revoke all on function public.create_task_with_message(
  uuid,
  uuid,
  uuid,
  uuid[],
  text,
  timestamptz,
  text[],
  uuid[],
  uuid,
  uuid,
  text
) from public;
grant execute on function public.create_task_with_message(
  uuid,
  uuid,
  uuid,
  uuid[],
  text,
  timestamptz,
  text[],
  uuid[],
  uuid,
  uuid,
  text
) to authenticated, service_role;

revoke all on function public.set_task_checklist_item(
  uuid,
  uuid,
  uuid,
  boolean
) from public;
grant execute on function public.set_task_checklist_item(
  uuid,
  uuid,
  uuid,
  boolean
) to authenticated, service_role;

alter table public.tasks enable row level security;
alter table public.task_collaborators enable row level security;
alter table public.task_checklist_items enable row level security;
alter table public.task_attachments enable row level security;

create policy "assigned members can read tasks"
  on public.tasks for select
  to authenticated
  using (private.can_access_task(organization_id, id));
create policy "assigned members can read task collaborators"
  on public.task_collaborators for select
  to authenticated
  using (private.can_access_task(organization_id, task_id));
create policy "assigned members can read task checklist items"
  on public.task_checklist_items for select
  to authenticated
  using (private.can_access_task(organization_id, task_id));
create policy "assigned members can read task attachments"
  on public.task_attachments for select
  to authenticated
  using (private.can_access_task(organization_id, task_id));

create policy "aal2 required for tasks"
  on public.tasks as restrictive for all to authenticated
  using ((select private.session_satisfies_mfa()))
  with check ((select private.session_satisfies_mfa()));
create policy "aal2 required for task collaborators"
  on public.task_collaborators as restrictive for all to authenticated
  using ((select private.session_satisfies_mfa()))
  with check ((select private.session_satisfies_mfa()));
create policy "aal2 required for task checklist items"
  on public.task_checklist_items as restrictive for all to authenticated
  using ((select private.session_satisfies_mfa()))
  with check ((select private.session_satisfies_mfa()));
create policy "aal2 required for task attachments"
  on public.task_attachments as restrictive for all to authenticated
  using ((select private.session_satisfies_mfa()))
  with check ((select private.session_satisfies_mfa()));

revoke all on table public.tasks
  from public, anon, authenticated;
revoke all on table public.task_collaborators
  from public, anon, authenticated;
revoke all on table public.task_checklist_items
  from public, anon, authenticated;
revoke all on table public.task_attachments
  from public, anon, authenticated;
grant select on table public.tasks to authenticated;
grant select on table public.task_collaborators to authenticated;
grant select on table public.task_checklist_items to authenticated;
grant select on table public.task_attachments to authenticated;
grant all on table public.tasks to service_role;
grant all on table public.task_collaborators to service_role;
grant all on table public.task_checklist_items to service_role;
grant all on table public.task_attachments to service_role;

create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  channel_id uuid not null,
  organizer_member_id uuid not null,
  client_meeting_id uuid not null,
  client_message_id uuid not null,
  message_id uuid,
  title text not null,
  provider text not null check (provider in ('zoom', 'google_meet')),
  join_url text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (organization_id, id),
  unique (channel_id, client_meeting_id),
  unique (channel_id, client_message_id),
  foreign key (organization_id, channel_id)
    references public.channels (organization_id, id),
  foreign key (organization_id, organizer_member_id)
    references public.organization_members (organization_id, id),
  foreign key (organization_id, message_id)
    references public.messages (organization_id, id),
  check (length(trim(title)) between 1 and 240),
  check (join_url ~ '^https://'),
  check (ends_at > starts_at),
  check (length(trim(timezone)) between 1 and 100)
);

alter table public.messages
  add column meeting_id uuid;

alter table public.messages
  add constraint messages_meeting_fk
  foreign key (organization_id, meeting_id)
  references public.meetings (organization_id, id);

create table public.meeting_attendees (
  organization_id uuid not null references public.organizations (id),
  meeting_id uuid not null,
  member_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (meeting_id, member_id),
  foreign key (organization_id, meeting_id)
    references public.meetings (organization_id, id) on delete cascade,
  foreign key (organization_id, member_id)
    references public.organization_members (organization_id, id)
    on delete cascade
);

create table public.meeting_responses (
  organization_id uuid not null references public.organizations (id),
  meeting_id uuid not null,
  member_id uuid not null,
  status text not null check (status in ('accepted', 'declined')),
  responded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (meeting_id, member_id),
  foreign key (organization_id, meeting_id)
    references public.meetings (organization_id, id) on delete cascade,
  foreign key (organization_id, member_id)
    references public.organization_members (organization_id, id)
    on delete cascade
);

create index meetings_channel_starts_at_idx
  on public.meetings (organization_id, channel_id, starts_at, id)
  where archived_at is null;
create index meetings_organizer_idx
  on public.meetings (organizer_member_id);
create index meetings_message_id_idx
  on public.meetings (message_id)
  where message_id is not null;
create index messages_meeting_id_idx
  on public.messages (meeting_id)
  where meeting_id is not null;
create index meeting_attendees_member_id_idx
  on public.meeting_attendees (member_id);
create index meeting_responses_member_id_idx
  on public.meeting_responses (member_id);

create trigger meetings_set_updated_at
  before update on public.meetings
  for each row execute function private.set_updated_at();
create trigger meeting_responses_set_updated_at
  before update on public.meeting_responses
  for each row execute function private.set_updated_at();

create function private.can_access_meeting(
  target_organization_id uuid,
  target_meeting_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.meetings as meeting
    where meeting.organization_id = target_organization_id
      and meeting.id = target_meeting_id
      and meeting.archived_at is null
      and private.has_channel_access(
        meeting.organization_id,
        meeting.channel_id,
        false
      )
      and (
        meeting.organizer_member_id =
          private.current_member_id(meeting.organization_id)
        or exists (
          select 1
          from public.meeting_attendees as attendee
          where attendee.organization_id = meeting.organization_id
            and attendee.meeting_id = meeting.id
            and attendee.member_id =
              private.current_member_id(meeting.organization_id)
        )
      )
  );
$$;

revoke all on function private.can_access_meeting(uuid, uuid) from public;
grant execute on function private.can_access_meeting(uuid, uuid)
  to authenticated, service_role;

create function public.create_meeting_with_message(
  target_organization_id uuid,
  target_channel_id uuid,
  target_title text,
  target_provider text,
  target_join_url text,
  target_starts_at timestamptz,
  target_ends_at timestamptz,
  target_timezone text,
  target_client_meeting_id uuid,
  target_client_message_id uuid,
  target_message_body text
)
returns setof public.meetings
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_member_id uuid;
  existing_meeting public.meetings%rowtype;
  created_meeting public.meetings%rowtype;
  created_message public.messages%rowtype;
begin
  if not private.session_satisfies_mfa() then
    raise insufficient_privilege using
      message = 'An AAL2 session is required.';
  end if;

  current_member_id := private.current_member_id(target_organization_id);
  if current_member_id is null
    or not private.can_insert_message(
      target_organization_id,
      target_channel_id,
      current_member_id
    )
  then
    raise insufficient_privilege using
      message = 'The current member cannot create a meeting in this channel.';
  end if;

  if target_client_meeting_id is null or target_client_message_id is null then
    raise invalid_parameter_value using
      message = 'Client meeting and message identifiers are required.';
  end if;

  if length(trim(target_title)) not between 1 and 240
    or target_provider not in ('zoom', 'google_meet')
    or target_starts_at < now() - interval '1 day'
    or target_ends_at <= target_starts_at
    or length(trim(target_timezone)) not between 1 and 100
    or target_join_url !~ '^https://'
    or (
      target_provider = 'google_meet'
      and target_join_url !~ '^https://meet\.google\.com/'
    )
    or (
      target_provider = 'zoom'
      and target_join_url !~ '^https://([a-z0-9-]+\.)?zoom\.us/'
    )
  then
    raise invalid_parameter_value using
      message = 'The meeting details are invalid.';
  end if;

  select meeting.*
  into existing_meeting
  from public.meetings as meeting
  where meeting.channel_id = target_channel_id
    and meeting.client_meeting_id = target_client_meeting_id;

  if found then
    if existing_meeting.organization_id <> target_organization_id
      or existing_meeting.organizer_member_id <> current_member_id
      or existing_meeting.client_message_id <> target_client_message_id
      or existing_meeting.title <> trim(target_title)
      or existing_meeting.provider <> target_provider
      or existing_meeting.join_url <> target_join_url
      or existing_meeting.starts_at <> target_starts_at
      or existing_meeting.ends_at <> target_ends_at
    then
      raise unique_violation using
        message = 'client_meeting_id already represents another meeting.';
    end if;
    return next existing_meeting;
    return;
  end if;

  insert into public.meetings (
    organization_id,
    channel_id,
    organizer_member_id,
    client_meeting_id,
    client_message_id,
    title,
    provider,
    join_url,
    starts_at,
    ends_at,
    timezone
  )
  values (
    target_organization_id,
    target_channel_id,
    current_member_id,
    target_client_meeting_id,
    target_client_message_id,
    trim(target_title),
    target_provider,
    target_join_url,
    target_starts_at,
    target_ends_at,
    trim(target_timezone)
  )
  returning * into created_meeting;

  insert into public.meeting_attendees (
    organization_id,
    meeting_id,
    member_id
  )
  select
    target_organization_id,
    created_meeting.id,
    membership.member_id
  from public.channel_memberships as membership
  where membership.organization_id = target_organization_id
    and membership.channel_id = target_channel_id
    and membership.archived_at is null
    and membership.starts_at <= now()
    and (
      membership.expires_at is null
      or membership.expires_at > now()
    );

  insert into public.meeting_responses (
    organization_id,
    meeting_id,
    member_id,
    status
  )
  values (
    target_organization_id,
    created_meeting.id,
    current_member_id,
    'accepted'
  );

  select message.*
  into created_message
  from private.send_message_with_attachments(
    target_organization_id,
    target_channel_id,
    current_member_id,
    target_client_message_id,
    target_message_body,
    false,
    '{}'::uuid[]
  ) as message;

  update public.meetings
  set message_id = created_message.id
  where id = created_meeting.id
  returning * into created_meeting;

  update public.messages
  set meeting_id = created_meeting.id
  where id = created_message.id;

  return next created_meeting;
end;
$$;

create function public.respond_to_meeting(
  target_organization_id uuid,
  target_meeting_id uuid,
  target_status text
)
returns setof public.meeting_responses
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_member_id uuid;
  saved_response public.meeting_responses%rowtype;
begin
  if not private.session_satisfies_mfa()
    or not private.can_access_meeting(
      target_organization_id,
      target_meeting_id
    )
    or target_status not in ('accepted', 'declined')
  then
    raise insufficient_privilege using
      message = 'The meeting response is not allowed.';
  end if;

  current_member_id := private.current_member_id(target_organization_id);

  insert into public.meeting_responses (
    organization_id,
    meeting_id,
    member_id,
    status,
    responded_at
  )
  values (
    target_organization_id,
    target_meeting_id,
    current_member_id,
    target_status,
    now()
  )
  on conflict (meeting_id, member_id) do update
  set status = excluded.status, responded_at = excluded.responded_at
  returning * into saved_response;

  return next saved_response;
end;
$$;

revoke all on function public.create_meeting_with_message(
  uuid,
  uuid,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  text,
  uuid,
  uuid,
  text
) from public;
grant execute on function public.create_meeting_with_message(
  uuid,
  uuid,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  text,
  uuid,
  uuid,
  text
) to authenticated, service_role;

revoke all on function public.respond_to_meeting(uuid, uuid, text)
  from public;
grant execute on function public.respond_to_meeting(uuid, uuid, text)
  to authenticated, service_role;

alter table public.meetings enable row level security;
alter table public.meeting_attendees enable row level security;
alter table public.meeting_responses enable row level security;

create policy "attendees can read meetings"
  on public.meetings for select
  to authenticated
  using (private.can_access_meeting(organization_id, id));
create policy "attendees can read meeting attendees"
  on public.meeting_attendees for select
  to authenticated
  using (private.can_access_meeting(organization_id, meeting_id));
create policy "attendees can read meeting responses"
  on public.meeting_responses for select
  to authenticated
  using (private.can_access_meeting(organization_id, meeting_id));

create policy "aal2 required for meetings"
  on public.meetings as restrictive for all to authenticated
  using ((select private.session_satisfies_mfa()))
  with check ((select private.session_satisfies_mfa()));
create policy "aal2 required for meeting attendees"
  on public.meeting_attendees as restrictive for all to authenticated
  using ((select private.session_satisfies_mfa()))
  with check ((select private.session_satisfies_mfa()));
create policy "aal2 required for meeting responses"
  on public.meeting_responses as restrictive for all to authenticated
  using ((select private.session_satisfies_mfa()))
  with check ((select private.session_satisfies_mfa()));

revoke all on table public.meetings
  from public, anon, authenticated;
revoke all on table public.meeting_attendees
  from public, anon, authenticated;
revoke all on table public.meeting_responses
  from public, anon, authenticated;
grant select on table public.meetings to authenticated;
grant select on table public.meeting_attendees to authenticated;
grant select on table public.meeting_responses to authenticated;
grant all on table public.meetings to service_role;
grant all on table public.meeting_attendees to service_role;
grant all on table public.meeting_responses to service_role;
