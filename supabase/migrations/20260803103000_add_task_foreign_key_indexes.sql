-- Cover the tenant-scoped composite foreign keys used by the task workflow.
-- These indexes keep cascade checks and scoped joins bounded as task history grows.

create index if not exists messages_organization_task_idx
  on public.messages (organization_id, task_id)
  where task_id is not null;

create index if not exists tasks_organization_created_by_idx
  on public.tasks (organization_id, created_by_member_id);

create index if not exists tasks_organization_source_message_idx
  on public.tasks (organization_id, source_message_id)
  where source_message_id is not null;

create index if not exists tasks_organization_template_idx
  on public.tasks (organization_id, template_id)
  where template_id is not null;

create index if not exists tasks_organization_schedule_idx
  on public.tasks (organization_id, schedule_id)
  where schedule_id is not null;

create index if not exists task_collaborators_organization_task_idx
  on public.task_collaborators (organization_id, task_id);

create index if not exists task_collaborators_organization_member_idx
  on public.task_collaborators (organization_id, member_id);

create index if not exists task_checklist_items_organization_task_idx
  on public.task_checklist_items (organization_id, task_id);

create index if not exists task_checklist_items_organization_completed_by_idx
  on public.task_checklist_items (organization_id, completed_by_member_id)
  where completed_by_member_id is not null;

create index if not exists task_attachments_organization_task_idx
  on public.task_attachments (organization_id, task_id);

create index if not exists task_attachments_organization_attachment_idx
  on public.task_attachments (organization_id, attachment_id);

create index if not exists task_events_organization_task_idx
  on public.task_events (organization_id, task_id);

create index if not exists task_events_organization_actor_idx
  on public.task_events (organization_id, actor_member_id);

create index if not exists task_templates_organization_creator_idx
  on public.task_templates (organization_id, created_by_member_id);

create index if not exists task_templates_organization_location_idx
  on public.task_templates (organization_id, location_id)
  where location_id is not null;

create index if not exists task_templates_organization_department_idx
  on public.task_templates (organization_id, department_id)
  where department_id is not null;

create index if not exists task_template_items_organization_template_idx
  on public.task_template_items (organization_id, template_id);

create index if not exists task_schedules_organization_template_idx
  on public.task_schedules (organization_id, template_id);

create index if not exists task_schedules_organization_creator_idx
  on public.task_schedules (organization_id, created_by_member_id);

create index if not exists task_schedules_organization_channel_idx
  on public.task_schedules (organization_id, channel_id);

create index if not exists task_schedules_organization_owner_idx
  on public.task_schedules (organization_id, owner_member_id);
