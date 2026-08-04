create extension if not exists pg_cron with schema pg_catalog;

alter table public.tasks
  drop constraint if exists tasks_status_check;
alter table public.tasks
  drop constraint if exists tasks_check;

alter table public.tasks
  add column accepted_at timestamptz,
  add column declined_at timestamptz,
  add column blocked_at timestamptz,
  add column canceled_at timestamptz,
  add column status_reason text,
  add column active_status_before_block text,
  add column status_changed_at timestamptz not null default now();

update public.tasks
set
  status = case status
    when 'open' then 'accepted'
    else status
  end,
  status_changed_at = updated_at;

alter table public.tasks
  add constraint tasks_status_check check (
    status in (
      'pending_acceptance',
      'accepted',
      'in_progress',
      'blocked',
      'done',
      'declined',
      'canceled'
    )
  ),
  add constraint tasks_completion_state_check check (
    (status = 'done' and completed_at is not null)
    or (status <> 'done' and completed_at is null)
  ),
  add constraint tasks_reason_state_check check (
    status not in ('blocked', 'declined', 'canceled')
    or (
      status_reason is not null
      and length(trim(status_reason)) between 1 and 1000
    )
  ),
  add constraint tasks_block_restore_state_check check (
    active_status_before_block is null
    or active_status_before_block in ('accepted', 'in_progress')
  );

create table public.task_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  task_id uuid not null,
  actor_member_id uuid,
  event_type text not null check (
    event_type in (
      'assigned',
      'self_created',
      'accepted',
      'declined',
      'started',
      'blocked',
      'unblocked',
      'completed',
      'reassigned',
      'reopened',
      'canceled'
    )
  ),
  from_status text,
  to_status text not null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, task_id)
    references public.tasks (organization_id, id) on delete cascade,
  foreign key (organization_id, actor_member_id)
    references public.organization_members (organization_id, id),
  check (reason is null or length(trim(reason)) between 1 and 1000),
  check (jsonb_typeof(metadata) = 'object')
);

create table public.task_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  created_by_member_id uuid not null,
  name text not null,
  title text not null,
  visibility text not null default 'private'
    check (visibility in ('private', 'organization', 'location', 'department')),
  location_id uuid,
  department_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (organization_id, id),
  foreign key (organization_id, created_by_member_id)
    references public.organization_members (organization_id, id),
  foreign key (organization_id, location_id)
    references public.locations (organization_id, id),
  foreign key (organization_id, department_id)
    references public.departments (organization_id, id),
  check (length(trim(name)) between 1 and 120),
  check (length(trim(title)) between 1 and 240),
  check (
    (visibility = 'location' and location_id is not null and department_id is null)
    or (visibility = 'department' and department_id is not null and location_id is null)
    or (visibility in ('private', 'organization') and location_id is null and department_id is null)
  )
);

create table public.task_template_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  template_id uuid not null,
  position integer not null check (position between 0 and 49),
  label text not null check (length(trim(label)) between 1 and 500),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (template_id, position),
  foreign key (organization_id, template_id)
    references public.task_templates (organization_id, id) on delete cascade
);

create table public.task_schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  template_id uuid not null,
  created_by_member_id uuid not null,
  channel_id uuid not null,
  owner_member_id uuid not null,
  frequency text not null check (frequency in ('daily', 'weekly', 'monthly')),
  weekdays smallint[] not null default '{}'::smallint[],
  month_day smallint,
  due_local_time time not null,
  timezone text not null,
  create_lead_minutes integer not null default 1440
    check (create_lead_minutes between 0 and 43200),
  next_due_at timestamptz not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (organization_id, id),
  foreign key (organization_id, template_id)
    references public.task_templates (organization_id, id),
  foreign key (organization_id, channel_id)
    references public.channels (organization_id, id),
  foreign key (organization_id, created_by_member_id)
    references public.organization_members (organization_id, id),
  foreign key (organization_id, owner_member_id)
    references public.organization_members (organization_id, id),
  check (length(trim(timezone)) between 1 and 100),
  check (
    (frequency = 'daily' and cardinality(weekdays) = 0 and month_day is null)
    or (
      frequency = 'weekly'
      and cardinality(weekdays) between 1 and 7
      and weekdays <@ array[1,2,3,4,5,6,7]::smallint[]
      and month_day is null
    )
    or (
      frequency = 'monthly'
      and cardinality(weekdays) = 0
      and month_day between 1 and 31
    )
  )
);

alter table public.tasks
  add column template_id uuid,
  add column schedule_id uuid,
  add column occurrence_due_at timestamptz,
  add constraint tasks_template_fk foreign key (organization_id, template_id)
    references public.task_templates (organization_id, id),
  add constraint tasks_schedule_fk foreign key (organization_id, schedule_id)
    references public.task_schedules (organization_id, id),
  add constraint tasks_schedule_occurrence_check check (
    (schedule_id is null and occurrence_due_at is null)
    or (schedule_id is not null and occurrence_due_at is not null)
  );

create unique index tasks_schedule_occurrence_uidx
  on public.tasks (schedule_id, occurrence_due_at)
  where schedule_id is not null;
create index tasks_status_due_at_idx
  on public.tasks (organization_id, status, due_at, id)
  where archived_at is null;
create index task_events_task_created_at_idx
  on public.task_events (task_id, created_at, id);
create index task_events_actor_idx
  on public.task_events (actor_member_id)
  where actor_member_id is not null;
create index task_templates_creator_idx
  on public.task_templates (created_by_member_id)
  where archived_at is null;
create index task_template_items_template_position_idx
  on public.task_template_items (template_id, position);
create index task_schedules_next_due_idx
  on public.task_schedules (next_due_at, id)
  where active and archived_at is null;
create index task_schedules_owner_idx
  on public.task_schedules (owner_member_id)
  where active and archived_at is null;

create trigger task_templates_set_updated_at
  before update on public.task_templates
  for each row execute function private.set_updated_at();
create trigger task_schedules_set_updated_at
  before update on public.task_schedules
  for each row execute function private.set_updated_at();

create function private.is_active_task_member(
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
      and member.status = 'active'
      and member.archived_at is null
      and member.starts_at <= now()
      and (member.expires_at is null or member.expires_at > now())
  );
$$;

create function private.can_delegate_task_to(
  target_organization_id uuid,
  target_channel_id uuid,
  target_member_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with current_member as (
    select private.current_member_id(target_organization_id) as id
  )
  select private.is_active_task_member(
    target_organization_id,
    target_member_id
  )
  and exists (
    select 1
    from public.channel_memberships as membership
    where membership.organization_id = target_organization_id
      and membership.channel_id = target_channel_id
      and membership.member_id = target_member_id
      and membership.archived_at is null
      and membership.starts_at <= now()
      and (membership.expires_at is null or membership.expires_at > now())
  )
  and (
    target_member_id = (select id from current_member)
    or private.has_role(
      target_organization_id,
      array['owner', 'org_admin']
    )
    or (
      private.has_role(target_organization_id, array['location_manager'])
      and private.can_manage_channel(
        target_organization_id,
        target_channel_id
      )
      and exists (
        select 1
        from public.assignments as assignment
        where assignment.organization_id = target_organization_id
          and assignment.member_id = target_member_id
          and assignment.archived_at is null
          and assignment.starts_at <= now()
          and (assignment.ends_at is null or assignment.ends_at > now())
          and private.can_manage_location(
            target_organization_id,
            assignment.location_id
          )
      )
    )
    or (
      private.has_role(target_organization_id, array['department_lead'])
      and private.can_manage_channel(
        target_organization_id,
        target_channel_id
      )
      and exists (
        select 1
        from public.assignments as assignment
        where assignment.organization_id = target_organization_id
          and assignment.member_id = target_member_id
          and assignment.archived_at is null
          and assignment.starts_at <= now()
          and (assignment.ends_at is null or assignment.ends_at > now())
          and private.can_manage_department(
            target_organization_id,
            assignment.department_id
          )
      )
    )
  );
$$;

create function private.can_manage_task_lifecycle(
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
        task.created_by_member_id = private.current_member_id(task.organization_id)
        or private.has_role(task.organization_id, array['owner', 'org_admin'])
        or (
          private.has_role(task.organization_id, array['location_manager'])
          and private.can_manage_channel(task.organization_id, task.channel_id)
          and exists (
            select 1
            from public.assignments as assignment
            where assignment.organization_id = task.organization_id
              and assignment.member_id = task.owner_member_id
              and assignment.archived_at is null
              and assignment.starts_at <= now()
              and (assignment.ends_at is null or assignment.ends_at > now())
              and private.can_manage_location(
                task.organization_id,
                assignment.location_id
              )
          )
        )
        or (
          private.has_role(task.organization_id, array['department_lead'])
          and private.can_manage_channel(task.organization_id, task.channel_id)
          and exists (
            select 1
            from public.assignments as assignment
            where assignment.organization_id = task.organization_id
              and assignment.member_id = task.owner_member_id
              and assignment.archived_at is null
              and assignment.starts_at <= now()
              and (assignment.ends_at is null or assignment.ends_at > now())
              and private.can_manage_department(
                task.organization_id,
                assignment.department_id
              )
          )
        )
      )
  );
$$;

create or replace function private.can_access_task(
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
        or task.created_by_member_id = private.current_member_id(task.organization_id)
        or exists (
          select 1
          from public.task_collaborators as collaborator
          where collaborator.organization_id = task.organization_id
            and collaborator.task_id = task.id
            and collaborator.member_id = private.current_member_id(task.organization_id)
        )
        or private.can_manage_task_lifecycle(task.organization_id, task.id)
      )
  );
$$;

create function private.can_access_task_template(
  target_organization_id uuid,
  target_template_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.task_templates as template
    where template.organization_id = target_organization_id
      and template.id = target_template_id
      and template.archived_at is null
      and (
        template.created_by_member_id = private.current_member_id(template.organization_id)
        or (
          template.visibility = 'organization'
          and private.has_role(
            template.organization_id,
            array['owner', 'org_admin', 'location_manager', 'department_lead']
          )
        )
        or (
          template.visibility = 'location'
          and private.can_manage_location(template.organization_id, template.location_id)
        )
        or (
          template.visibility = 'department'
          and private.can_manage_department(template.organization_id, template.department_id)
        )
      )
  );
$$;

create function private.can_access_task_schedule(
  target_organization_id uuid,
  target_schedule_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.task_schedules as schedule
    where schedule.organization_id = target_organization_id
      and schedule.id = target_schedule_id
      and schedule.archived_at is null
      and (
        schedule.owner_member_id = private.current_member_id(schedule.organization_id)
        or schedule.created_by_member_id = private.current_member_id(schedule.organization_id)
        or private.has_role(schedule.organization_id, array['owner', 'org_admin'])
        or private.can_delegate_task_to(
          schedule.organization_id,
          schedule.channel_id,
          schedule.owner_member_id
        )
      )
  );
$$;

create function private.post_task_event_message(
  target_organization_id uuid,
  target_task_id uuid,
  target_actor_member_id uuid,
  target_body text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_task public.tasks%rowtype;
  created_message_id uuid;
begin
  select * into target_task
  from public.tasks
  where organization_id = target_organization_id
    and id = target_task_id;

  if not found or length(trim(target_body)) not between 1 and 10000 then
    raise invalid_parameter_value using message = 'The task event message is invalid.';
  end if;

  insert into public.messages (
    organization_id,
    channel_id,
    author_member_id,
    client_message_id,
    body,
    is_urgent,
    task_id
  )
  values (
    target_task.organization_id,
    target_task.channel_id,
    target_actor_member_id,
    gen_random_uuid(),
    trim(target_body),
    false,
    target_task.id
  )
  returning id into created_message_id;

  return created_message_id;
end;
$$;

create or replace function public.create_task_with_message(
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
  initial_status text;
begin
  if not private.session_satisfies_mfa() then
    raise insufficient_privilege using message = 'An authenticated session is required.';
  end if;

  current_member_id := private.current_member_id(target_organization_id);
  if current_member_id is null
    or not private.can_insert_message(
      target_organization_id,
      target_channel_id,
      current_member_id
    )
    or not private.can_delegate_task_to(
      target_organization_id,
      target_channel_id,
      target_owner_member_id
    )
  then
    raise insufficient_privilege using
      message = 'The current member cannot assign this task.';
  end if;

  if target_client_task_id is null or target_client_message_id is null then
    raise invalid_parameter_value using message = 'Client identifiers are required.';
  end if;
  if length(trim(target_title)) not between 1 and 240 then
    raise invalid_parameter_value using message = 'The task title is invalid.';
  end if;
  if target_due_at <= now() - interval '1 day' then
    raise invalid_parameter_value using message = 'The task due time is invalid.';
  end if;
  if cardinality(coalesce(target_checklist_labels, '{}'::text[])) > 50
    or exists (
      select 1
      from unnest(coalesce(target_checklist_labels, '{}'::text[])) as item(label)
      where length(trim(item.label)) not between 1 and 500
    )
  then
    raise invalid_parameter_value using message = 'The task checklist is invalid.';
  end if;

  select task.* into existing_task
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
      raise unique_violation using message = 'client_task_id already represents another task.';
    end if;
    return next existing_task;
    return;
  end if;

  select count(distinct requested.member_id)
  into requested_member_count
  from unnest(
    array_append(coalesce(target_collaborator_ids, '{}'::uuid[]), target_owner_member_id)
  ) as requested(member_id);

  select count(distinct membership.member_id)
  into matched_member_count
  from public.channel_memberships as membership
  where membership.organization_id = target_organization_id
    and membership.channel_id = target_channel_id
    and membership.member_id = any(
      array_append(coalesce(target_collaborator_ids, '{}'::uuid[]), target_owner_member_id)
    )
    and membership.archived_at is null
    and membership.starts_at <= now()
    and (membership.expires_at is null or membership.expires_at > now());

  if requested_member_count <> matched_member_count then
    raise insufficient_privilege using
      message = 'Task owners and collaborators must be active channel members.';
  end if;

  attachment_count := cardinality(coalesce(target_attachment_ids, '{}'::uuid[]));
  if attachment_count > 5 then
    raise check_violation using message = 'A task can contain at most five attachments.';
  end if;

  initial_status := case
    when target_owner_member_id = current_member_id then 'accepted'
    else 'pending_acceptance'
  end;

  insert into public.tasks (
    organization_id,
    channel_id,
    owner_member_id,
    created_by_member_id,
    client_task_id,
    client_message_id,
    title,
    due_at,
    status,
    accepted_at,
    status_changed_at
  )
  values (
    target_organization_id,
    target_channel_id,
    target_owner_member_id,
    current_member_id,
    target_client_task_id,
    target_client_message_id,
    trim(target_title),
    target_due_at,
    initial_status,
    case when initial_status = 'accepted' then now() else null end,
    now()
  )
  returning * into created_task;

  insert into public.task_collaborators (organization_id, task_id, member_id)
  select target_organization_id, created_task.id, requested.member_id
  from (
    select distinct member_id
    from unnest(coalesce(target_collaborator_ids, '{}'::uuid[])) as member(member_id)
    where member_id <> target_owner_member_id
  ) as requested;

  insert into public.task_checklist_items (
    organization_id,
    task_id,
    position,
    label
  )
  select target_organization_id, created_task.id, item.ordinality - 1, trim(item.label)
  from unnest(coalesce(target_checklist_labels, '{}'::text[]))
    with ordinality as item(label, ordinality);

  select message.* into created_message
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

  update public.messages set task_id = created_task.id where id = created_message.id;

  insert into public.task_attachments (organization_id, task_id, attachment_id)
  select target_organization_id, created_task.id, attachment_id
  from unnest(coalesce(target_attachment_ids, '{}'::uuid[])) as requested(attachment_id);

  insert into public.task_events (
    organization_id,
    task_id,
    actor_member_id,
    event_type,
    to_status
  )
  values (
    target_organization_id,
    created_task.id,
    current_member_id,
    case when initial_status = 'accepted' then 'self_created' else 'assigned' end,
    initial_status
  );

  return next created_task;
end;
$$;

create function public.respond_to_task_assignment(
  target_organization_id uuid,
  target_task_id uuid,
  target_response text,
  target_reason text default null
)
returns setof public.tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_member_id uuid;
  saved_task public.tasks%rowtype;
  next_status text;
begin
  if not private.session_satisfies_mfa() then
    raise insufficient_privilege using message = 'An authenticated session is required.';
  end if;
  current_member_id := private.current_member_id(target_organization_id);

  select * into saved_task
  from public.tasks
  where organization_id = target_organization_id
    and id = target_task_id
    and archived_at is null;

  if not found
    or saved_task.owner_member_id <> current_member_id
    or saved_task.status <> 'pending_acceptance'
    or target_response not in ('accept', 'decline')
    or (target_response = 'decline' and length(trim(coalesce(target_reason, ''))) < 1)
  then
    raise insufficient_privilege using message = 'The task response is not allowed.';
  end if;

  next_status := case when target_response = 'accept' then 'accepted' else 'declined' end;

  update public.tasks
  set
    status = next_status,
    accepted_at = case when next_status = 'accepted' then now() else null end,
    declined_at = case when next_status = 'declined' then now() else null end,
    status_reason = case when next_status = 'declined' then trim(target_reason) else null end,
    status_changed_at = now()
  where organization_id = target_organization_id and id = target_task_id
  returning * into saved_task;

  insert into public.task_events (
    organization_id, task_id, actor_member_id, event_type,
    from_status, to_status, reason
  ) values (
    target_organization_id, target_task_id, current_member_id,
    case when next_status = 'accepted' then 'accepted' else 'declined' end,
    'pending_acceptance', next_status,
    case when next_status = 'declined' then trim(target_reason) else null end
  );

  perform private.post_task_event_message(
    target_organization_id,
    target_task_id,
    current_member_id,
    case
      when next_status = 'accepted' then 'Task accepted: ' || saved_task.title
      else 'Task declined: ' || saved_task.title || ' — ' || trim(target_reason)
    end
  );

  return next saved_task;
end;
$$;

create or replace function public.set_task_checklist_item(
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
  previous_status text;
  next_status text;
  total_items integer;
  completed_items integer;
  can_check boolean;
begin
  if not private.session_satisfies_mfa() then
    raise insufficient_privilege using message = 'An authenticated session is required.';
  end if;

  current_member_id := private.current_member_id(target_organization_id);
  select task.* into saved_task
  from public.tasks as task
  where task.organization_id = target_organization_id
    and task.id = target_task_id
    and task.archived_at is null;

  select (
    saved_task.owner_member_id = current_member_id
    or exists (
      select 1
      from public.task_collaborators as collaborator
      where collaborator.organization_id = target_organization_id
        and collaborator.task_id = target_task_id
        and collaborator.member_id = current_member_id
    )
  ) into can_check;

  if saved_task.id is null or not can_check or saved_task.status not in ('accepted', 'in_progress') then
    raise insufficient_privilege using message = 'The current member cannot update this checklist.';
  end if;

  previous_status := saved_task.status;
  update public.task_checklist_items
  set
    completed = target_completed,
    completed_by_member_id = case when target_completed then current_member_id else null end,
    completed_at = case when target_completed then now() else null end
  where organization_id = target_organization_id
    and task_id = target_task_id
    and id = target_item_id;

  if not found then
    raise no_data_found using message = 'The checklist item does not exist.';
  end if;

  select count(*), count(*) filter (where completed)
  into total_items, completed_items
  from public.task_checklist_items
  where organization_id = target_organization_id and task_id = target_task_id;

  next_status := case
    when total_items > 0 and completed_items = total_items then 'done'
    when completed_items > 0 then 'in_progress'
    else 'accepted'
  end;

  update public.tasks
  set
    status = next_status,
    completed_at = case when next_status = 'done' then now() else null end,
    status_changed_at = case when status <> next_status then now() else status_changed_at end
  where organization_id = target_organization_id and id = target_task_id
  returning * into saved_task;

  if previous_status = 'accepted' and next_status = 'in_progress' then
    insert into public.task_events (
      organization_id, task_id, actor_member_id, event_type, from_status, to_status
    ) values (
      target_organization_id, target_task_id, current_member_id,
      'started', previous_status, next_status
    );
  elsif next_status = 'done' and previous_status <> 'done' then
    insert into public.task_events (
      organization_id, task_id, actor_member_id, event_type, from_status, to_status
    ) values (
      target_organization_id, target_task_id, current_member_id,
      'completed', previous_status, next_status
    );
    perform private.post_task_event_message(
      target_organization_id,
      target_task_id,
      current_member_id,
      'Task completed: ' || saved_task.title
    );
  end if;

  return next saved_task;
end;
$$;

create function public.transition_task(
  target_organization_id uuid,
  target_task_id uuid,
  target_action text,
  target_reason text default null,
  target_reopen_item_id uuid default null
)
returns setof public.tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_member_id uuid;
  saved_task public.tasks%rowtype;
  previous_status text;
  next_status text;
  checklist_count integer;
  completed_count integer;
  is_manager boolean;
  event_name text;
  message_body text;
begin
  if not private.session_satisfies_mfa() then
    raise insufficient_privilege using message = 'An authenticated session is required.';
  end if;
  current_member_id := private.current_member_id(target_organization_id);
  select * into saved_task
  from public.tasks
  where organization_id = target_organization_id
    and id = target_task_id
    and archived_at is null;
  is_manager := private.can_manage_task_lifecycle(target_organization_id, target_task_id);

  if saved_task.id is null then
    raise no_data_found using message = 'The task does not exist.';
  end if;

  previous_status := saved_task.status;
  select count(*), count(*) filter (where completed)
  into checklist_count, completed_count
  from public.task_checklist_items
  where organization_id = target_organization_id and task_id = target_task_id;

  if target_action = 'block' then
    if (saved_task.owner_member_id <> current_member_id and not is_manager)
      or saved_task.status not in ('accepted', 'in_progress')
      or length(trim(coalesce(target_reason, ''))) < 1
    then raise insufficient_privilege using message = 'This task cannot be blocked.';
    end if;
    next_status := 'blocked';
    event_name := 'blocked';
  elsif target_action = 'unblock' then
    if (saved_task.owner_member_id <> current_member_id and not is_manager)
      or saved_task.status <> 'blocked'
    then raise insufficient_privilege using message = 'This task cannot be unblocked.';
    end if;
    next_status := case when completed_count > 0 then 'in_progress' else 'accepted' end;
    event_name := 'unblocked';
  elsif target_action = 'complete' then
    if saved_task.owner_member_id <> current_member_id
      or saved_task.status not in ('accepted', 'in_progress')
      or checklist_count <> 0
    then raise insufficient_privilege using message = 'This task cannot be completed directly.';
    end if;
    next_status := 'done';
    event_name := 'completed';
  elsif target_action = 'reopen' then
    if not is_manager
      or saved_task.status <> 'done'
      or length(trim(coalesce(target_reason, ''))) < 1
    then raise insufficient_privilege using message = 'This task cannot be reopened.';
    end if;
    if checklist_count > 0 then
      update public.task_checklist_items
      set completed = false, completed_by_member_id = null, completed_at = null
      where organization_id = target_organization_id
        and task_id = target_task_id
        and id = target_reopen_item_id
        and completed;
      if not found then
        raise invalid_parameter_value using
          message = 'Choose a completed checklist item to reopen.';
      end if;
      next_status := 'in_progress';
    else
      next_status := 'accepted';
    end if;
    event_name := 'reopened';
  elsif target_action = 'cancel' then
    if not is_manager
      or saved_task.status in ('done', 'canceled')
      or length(trim(coalesce(target_reason, ''))) < 1
    then raise insufficient_privilege using message = 'This task cannot be canceled.';
    end if;
    next_status := 'canceled';
    event_name := 'canceled';
  else
    raise invalid_parameter_value using message = 'The task transition is invalid.';
  end if;

  update public.tasks
  set
    status = next_status,
    active_status_before_block = case
      when next_status = 'blocked' then previous_status
      else null
    end,
    blocked_at = case when next_status = 'blocked' then now() else null end,
    canceled_at = case when next_status = 'canceled' then now() else null end,
    completed_at = case when next_status = 'done' then now() else null end,
    status_reason = case
      when next_status in ('blocked', 'canceled') then trim(target_reason)
      else null
    end,
    status_changed_at = now()
  where organization_id = target_organization_id and id = target_task_id
  returning * into saved_task;

  insert into public.task_events (
    organization_id, task_id, actor_member_id, event_type,
    from_status, to_status, reason
  ) values (
    target_organization_id, target_task_id, current_member_id, event_name,
    previous_status, next_status,
    case when length(trim(coalesce(target_reason, ''))) > 0 then trim(target_reason) else null end
  );

  message_body := case event_name
    when 'blocked' then 'Task blocked: ' || saved_task.title || ' — ' || trim(target_reason)
    when 'unblocked' then 'Task unblocked: ' || saved_task.title
    when 'completed' then 'Task completed: ' || saved_task.title
    when 'reopened' then 'Task reopened: ' || saved_task.title || ' — ' || trim(target_reason)
    else 'Task canceled: ' || saved_task.title || ' — ' || trim(target_reason)
  end;
  perform private.post_task_event_message(
    target_organization_id, target_task_id, current_member_id, message_body
  );

  return next saved_task;
end;
$$;

create function public.reassign_task(
  target_organization_id uuid,
  target_task_id uuid,
  target_owner_member_id uuid,
  target_reason text
)
returns setof public.tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_member_id uuid;
  saved_task public.tasks%rowtype;
  previous_owner_id uuid;
  previous_status text;
  next_status text;
begin
  if not private.session_satisfies_mfa() then
    raise insufficient_privilege using message = 'An authenticated session is required.';
  end if;
  current_member_id := private.current_member_id(target_organization_id);
  select * into saved_task
  from public.tasks
  where organization_id = target_organization_id
    and id = target_task_id
    and archived_at is null;

  if not found
    or not private.can_manage_task_lifecycle(target_organization_id, target_task_id)
    or not private.can_delegate_task_to(
      target_organization_id,
      saved_task.channel_id,
      target_owner_member_id
    )
    or saved_task.status in ('done', 'canceled')
    or length(trim(coalesce(target_reason, ''))) < 1
  then
    raise insufficient_privilege using message = 'The task cannot be reassigned.';
  end if;

  previous_owner_id := saved_task.owner_member_id;
  previous_status := saved_task.status;
  next_status := case when target_owner_member_id = current_member_id then 'accepted' else 'pending_acceptance' end;

  delete from public.task_collaborators
  where organization_id = target_organization_id
    and task_id = target_task_id
    and member_id = target_owner_member_id;

  update public.tasks
  set
    owner_member_id = target_owner_member_id,
    status = next_status,
    accepted_at = case when next_status = 'accepted' then now() else null end,
    declined_at = null,
    blocked_at = null,
    canceled_at = null,
    status_reason = null,
    active_status_before_block = null,
    status_changed_at = now()
  where organization_id = target_organization_id and id = target_task_id
  returning * into saved_task;

  insert into public.task_events (
    organization_id, task_id, actor_member_id, event_type,
    from_status, to_status, reason, metadata
  ) values (
    target_organization_id, target_task_id, current_member_id, 'reassigned',
    previous_status, next_status, trim(target_reason),
    jsonb_build_object(
      'previous_owner_member_id', previous_owner_id,
      'new_owner_member_id', target_owner_member_id
    )
  );

  perform private.post_task_event_message(
    target_organization_id,
    target_task_id,
    current_member_id,
    'Task reassigned: ' || saved_task.title || ' — ' || trim(target_reason)
  );
  return next saved_task;
end;
$$;

create function public.save_task_template(
  target_organization_id uuid,
  target_name text,
  target_title text,
  target_visibility text,
  target_location_id uuid,
  target_department_id uuid,
  target_checklist_labels text[]
)
returns setof public.task_templates
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_member_id uuid;
  created_template public.task_templates%rowtype;
begin
  if not private.session_satisfies_mfa()
    or not private.has_role(
      target_organization_id,
      array['owner', 'org_admin', 'location_manager', 'department_lead']
    )
  then raise insufficient_privilege using message = 'The current member cannot save task templates.';
  end if;
  current_member_id := private.current_member_id(target_organization_id);

  if length(trim(target_name)) not between 1 and 120
    or length(trim(target_title)) not between 1 and 240
    or target_visibility not in ('private', 'organization', 'location', 'department')
    or cardinality(coalesce(target_checklist_labels, '{}'::text[])) > 50
    or exists (
      select 1
      from unnest(coalesce(target_checklist_labels, '{}'::text[])) as item(label)
      where length(trim(item.label)) not between 1 and 500
    )
    or (target_visibility = 'organization' and not private.has_role(target_organization_id, array['owner', 'org_admin']))
    or (target_visibility = 'location' and not private.can_manage_location(target_organization_id, target_location_id))
    or (target_visibility = 'department' and not private.can_manage_department(target_organization_id, target_department_id))
  then raise invalid_parameter_value using message = 'The task template is invalid.';
  end if;

  insert into public.task_templates (
    organization_id, created_by_member_id, name, title,
    visibility, location_id, department_id
  ) values (
    target_organization_id, current_member_id, trim(target_name), trim(target_title),
    target_visibility,
    case when target_visibility = 'location' then target_location_id else null end,
    case when target_visibility = 'department' then target_department_id else null end
  ) returning * into created_template;

  insert into public.task_template_items (
    organization_id, template_id, position, label
  )
  select target_organization_id, created_template.id, item.ordinality - 1, trim(item.label)
  from unnest(coalesce(target_checklist_labels, '{}'::text[]))
    with ordinality as item(label, ordinality);

  return next created_template;
end;
$$;

create function private.next_task_schedule_due(
  target_frequency text,
  target_current_due timestamptz,
  target_weekdays smallint[],
  target_month_day smallint,
  target_due_local_time time,
  target_timezone text
)
returns timestamptz
language plpgsql
stable
set search_path = ''
as $$
declare
  local_date date;
  candidate_date date;
  next_month date;
  last_day integer;
begin
  local_date := (target_current_due at time zone target_timezone)::date;
  if target_frequency = 'daily' then
    candidate_date := local_date + 1;
  elsif target_frequency = 'weekly' then
    for offset_days in 1..7 loop
      candidate_date := local_date + offset_days;
      exit when extract(isodow from candidate_date)::smallint = any(target_weekdays);
    end loop;
  elsif target_frequency = 'monthly' then
    next_month := date_trunc('month', local_date + interval '1 month')::date;
    last_day := extract(day from (next_month + interval '1 month - 1 day'))::integer;
    candidate_date := next_month + (least(target_month_day, last_day) - 1);
  else
    raise invalid_parameter_value using message = 'The task recurrence is invalid.';
  end if;
  return (candidate_date + target_due_local_time) at time zone target_timezone;
end;
$$;

create function public.create_task_schedule(
  target_organization_id uuid,
  target_template_id uuid,
  target_channel_id uuid,
  target_owner_member_id uuid,
  target_frequency text,
  target_weekdays smallint[],
  target_month_day smallint,
  target_due_local_time time,
  target_timezone text,
  target_create_lead_minutes integer,
  target_last_due_at timestamptz
)
returns setof public.task_schedules
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_member_id uuid;
  created_schedule public.task_schedules%rowtype;
begin
  if not private.session_satisfies_mfa()
    or not private.has_role(
      target_organization_id,
      array['owner', 'org_admin', 'location_manager', 'department_lead']
    )
    or not private.can_access_task_template(target_organization_id, target_template_id)
    or not private.can_delegate_task_to(
      target_organization_id,
      target_channel_id,
      target_owner_member_id
    )
  then raise insufficient_privilege using message = 'The task schedule is not allowed.';
  end if;
  current_member_id := private.current_member_id(target_organization_id);

  insert into public.task_schedules (
    organization_id, template_id, created_by_member_id, channel_id,
    owner_member_id, frequency, weekdays, month_day, due_local_time,
    timezone, create_lead_minutes, next_due_at
  ) values (
    target_organization_id, target_template_id, current_member_id, target_channel_id,
    target_owner_member_id, target_frequency,
    coalesce(target_weekdays, '{}'::smallint[]), target_month_day,
    target_due_local_time, trim(target_timezone),
    coalesce(target_create_lead_minutes, 1440),
    private.next_task_schedule_due(
      target_frequency,
      target_last_due_at,
      coalesce(target_weekdays, '{}'::smallint[]),
      target_month_day,
      target_due_local_time,
      trim(target_timezone)
    )
  ) returning * into created_schedule;
  return next created_schedule;
end;
$$;

create function public.set_task_schedule_active(
  target_organization_id uuid,
  target_schedule_id uuid,
  target_active boolean
)
returns setof public.task_schedules
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_schedule public.task_schedules%rowtype;
begin
  if not private.session_satisfies_mfa()
    or not private.can_access_task_schedule(target_organization_id, target_schedule_id)
  then raise insufficient_privilege using message = 'The task schedule cannot be changed.';
  end if;
  update public.task_schedules
  set active = target_active
  where organization_id = target_organization_id
    and id = target_schedule_id
    and archived_at is null
  returning * into saved_schedule;
  return next saved_schedule;
end;
$$;

create function private.generate_due_task_occurrences(
  target_reference_time timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  schedule_row public.task_schedules%rowtype;
  template_row public.task_templates%rowtype;
  created_task public.tasks%rowtype;
  created_message_id uuid;
  created_count integer := 0;
  occurrence_count integer;
  initial_status text;
begin
  for schedule_row in
    select *
    from public.task_schedules
    where active
      and archived_at is null
      and next_due_at - make_interval(mins => create_lead_minutes) <= target_reference_time
    order by next_due_at, id
    for update skip locked
  loop
    occurrence_count := 0;
    while schedule_row.next_due_at - make_interval(mins => schedule_row.create_lead_minutes) <= target_reference_time
      and occurrence_count < 366
    loop
      if not private.is_active_task_member(schedule_row.organization_id, schedule_row.owner_member_id)
        or not private.is_active_task_member(schedule_row.organization_id, schedule_row.created_by_member_id)
        or not exists (
          select 1
          from public.channel_memberships as membership
          where membership.organization_id = schedule_row.organization_id
            and membership.channel_id = schedule_row.channel_id
            and membership.member_id = schedule_row.owner_member_id
            and membership.archived_at is null
            and membership.starts_at <= target_reference_time
            and (membership.expires_at is null or membership.expires_at > target_reference_time)
        )
      then
        update public.task_schedules set active = false where id = schedule_row.id;
        exit;
      end if;

      select * into template_row
      from public.task_templates
      where organization_id = schedule_row.organization_id
        and id = schedule_row.template_id
        and archived_at is null;
      if not found then
        update public.task_schedules set active = false where id = schedule_row.id;
        exit;
      end if;

      initial_status := case
        when schedule_row.owner_member_id = schedule_row.created_by_member_id then 'accepted'
        else 'pending_acceptance'
      end;

      insert into public.tasks (
        organization_id, channel_id, owner_member_id, created_by_member_id,
        client_task_id, client_message_id, title, due_at, status,
        accepted_at, status_changed_at, template_id, schedule_id, occurrence_due_at
      ) values (
        schedule_row.organization_id, schedule_row.channel_id,
        schedule_row.owner_member_id, schedule_row.created_by_member_id,
        gen_random_uuid(), gen_random_uuid(), template_row.title,
        schedule_row.next_due_at, initial_status,
        case when initial_status = 'accepted' then target_reference_time else null end,
        target_reference_time, template_row.id, schedule_row.id, schedule_row.next_due_at
      )
      on conflict (schedule_id, occurrence_due_at) where schedule_id is not null do nothing
      returning * into created_task;

      if found then
        insert into public.task_checklist_items (
          organization_id, task_id, position, label
        )
        select item.organization_id, created_task.id, item.position, item.label
        from public.task_template_items as item
        where item.organization_id = template_row.organization_id
          and item.template_id = template_row.id
        order by item.position;

        insert into public.messages (
          organization_id, channel_id, author_member_id, client_message_id,
          body, is_urgent, task_id
        ) values (
          schedule_row.organization_id, schedule_row.channel_id,
          schedule_row.created_by_member_id, created_task.client_message_id,
          'Recurring task assigned: ' || created_task.title, false, created_task.id
        ) returning id into created_message_id;

        update public.tasks set source_message_id = created_message_id where id = created_task.id;
        insert into public.task_events (
          organization_id, task_id, actor_member_id, event_type, to_status,
          metadata
        ) values (
          schedule_row.organization_id, created_task.id,
          schedule_row.created_by_member_id,
          case when initial_status = 'accepted' then 'self_created' else 'assigned' end,
          initial_status,
          jsonb_build_object('schedule_id', schedule_row.id)
        );
        created_count := created_count + 1;
      end if;

      schedule_row.next_due_at := private.next_task_schedule_due(
        schedule_row.frequency,
        schedule_row.next_due_at,
        schedule_row.weekdays,
        schedule_row.month_day,
        schedule_row.due_local_time,
        schedule_row.timezone
      );
      update public.task_schedules
      set next_due_at = schedule_row.next_due_at
      where id = schedule_row.id;
      occurrence_count := occurrence_count + 1;
    end loop;
  end loop;
  return created_count;
end;
$$;

revoke all on function private.is_active_task_member(uuid, uuid) from public;
revoke all on function private.can_delegate_task_to(uuid, uuid, uuid) from public;
revoke all on function private.can_manage_task_lifecycle(uuid, uuid) from public;
revoke all on function private.can_access_task_template(uuid, uuid) from public;
revoke all on function private.can_access_task_schedule(uuid, uuid) from public;
revoke all on function private.post_task_event_message(uuid, uuid, uuid, text) from public;
revoke all on function private.next_task_schedule_due(text, timestamptz, smallint[], smallint, time, text) from public;
revoke all on function private.generate_due_task_occurrences(timestamptz) from public;

grant execute on function private.is_active_task_member(uuid, uuid) to authenticated, service_role;
grant execute on function private.can_delegate_task_to(uuid, uuid, uuid) to authenticated, service_role;
grant execute on function private.can_manage_task_lifecycle(uuid, uuid) to authenticated, service_role;
grant execute on function private.can_access_task_template(uuid, uuid) to authenticated, service_role;
grant execute on function private.can_access_task_schedule(uuid, uuid) to authenticated, service_role;
grant execute on function private.generate_due_task_occurrences(timestamptz) to service_role;

revoke all on function public.respond_to_task_assignment(uuid, uuid, text, text) from public;
revoke all on function public.transition_task(uuid, uuid, text, text, uuid) from public;
revoke all on function public.reassign_task(uuid, uuid, uuid, text) from public;
revoke all on function public.save_task_template(uuid, text, text, text, uuid, uuid, text[]) from public;
revoke all on function public.create_task_schedule(uuid, uuid, uuid, uuid, text, smallint[], smallint, time, text, integer, timestamptz) from public;
revoke all on function public.set_task_schedule_active(uuid, uuid, boolean) from public;

grant execute on function public.respond_to_task_assignment(uuid, uuid, text, text) to authenticated, service_role;
grant execute on function public.transition_task(uuid, uuid, text, text, uuid) to authenticated, service_role;
grant execute on function public.reassign_task(uuid, uuid, uuid, text) to authenticated, service_role;
grant execute on function public.save_task_template(uuid, text, text, text, uuid, uuid, text[]) to authenticated, service_role;
grant execute on function public.create_task_schedule(uuid, uuid, uuid, uuid, text, smallint[], smallint, time, text, integer, timestamptz) to authenticated, service_role;
grant execute on function public.set_task_schedule_active(uuid, uuid, boolean) to authenticated, service_role;

alter table public.task_events enable row level security;
alter table public.task_templates enable row level security;
alter table public.task_template_items enable row level security;
alter table public.task_schedules enable row level security;

create policy "authorized members can read task events"
  on public.task_events for select
  to authenticated
  using (private.can_access_task(organization_id, task_id));
create policy "authorized managers can read task templates"
  on public.task_templates for select
  to authenticated
  using (private.can_access_task_template(organization_id, id));
create policy "authorized managers can read task template items"
  on public.task_template_items for select
  to authenticated
  using (private.can_access_task_template(organization_id, template_id));
create policy "authorized members can read task schedules"
  on public.task_schedules for select
  to authenticated
  using (private.can_access_task_schedule(organization_id, id));

create policy "authenticated required for task events"
  on public.task_events as restrictive for all to authenticated
  using ((select private.session_satisfies_mfa()))
  with check ((select private.session_satisfies_mfa()));
create policy "authenticated required for task templates"
  on public.task_templates as restrictive for all to authenticated
  using ((select private.session_satisfies_mfa()))
  with check ((select private.session_satisfies_mfa()));
create policy "authenticated required for task template items"
  on public.task_template_items as restrictive for all to authenticated
  using ((select private.session_satisfies_mfa()))
  with check ((select private.session_satisfies_mfa()));
create policy "authenticated required for task schedules"
  on public.task_schedules as restrictive for all to authenticated
  using ((select private.session_satisfies_mfa()))
  with check ((select private.session_satisfies_mfa()));

revoke all on table public.task_events from public, anon, authenticated;
revoke all on table public.task_templates from public, anon, authenticated;
revoke all on table public.task_template_items from public, anon, authenticated;
revoke all on table public.task_schedules from public, anon, authenticated;
grant select on table public.task_events to authenticated;
grant select on table public.task_templates to authenticated;
grant select on table public.task_template_items to authenticated;
grant select on table public.task_schedules to authenticated;
grant all on table public.task_events to service_role;
grant all on table public.task_templates to service_role;
grant all on table public.task_template_items to service_role;
grant all on table public.task_schedules to service_role;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tasks'
  ) then alter publication supabase_realtime add table public.tasks; end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'task_checklist_items'
  ) then alter publication supabase_realtime add table public.task_checklist_items; end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'task_events'
  ) then alter publication supabase_realtime add table public.task_events; end if;
end;
$$;

select cron.schedule(
  'generate-task-occurrences',
  '*/15 * * * *',
  $job$select private.generate_due_task_occurrences();$job$
);
