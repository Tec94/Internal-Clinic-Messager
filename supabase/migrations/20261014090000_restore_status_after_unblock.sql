-- Unblock restores the status the Task had before it was blocked. The previous
-- rule recomputed it from the checklist, which returned 'accepted' for a Task
-- reopened into 'in_progress' with no completed items.
create or replace function public.transition_task(
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
    next_status := coalesce(
      saved_task.active_status_before_block,
      case when completed_count > 0 then 'in_progress' else 'accepted' end
    );
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

