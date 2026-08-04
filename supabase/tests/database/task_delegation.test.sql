begin;

select plan(45);

select has_table('public', 'task_events', 'task event timeline exists');
select has_table('public', 'task_templates', 'task templates exist');
select has_table('public', 'task_schedules', 'task schedules exist');
select has_function('public', 'respond_to_task_assignment', array['uuid', 'uuid', 'text', 'text'], 'assignment response RPC exists');
select has_function('public', 'transition_task', array['uuid', 'uuid', 'text', 'text', 'uuid'], 'lifecycle transition RPC exists');
select has_function('public', 'reassign_task', array['uuid', 'uuid', 'uuid', 'text'], 'reassignment RPC exists');

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('10000000-0000-0000-0000-000000000051', 'authenticated', 'authenticated', 'task-owner@example.test', '', now(), '{}', '{}', now(), now()),
  ('10000000-0000-0000-0000-000000000052', 'authenticated', 'authenticated', 'task-location-manager@example.test', '', now(), '{}', '{}', now(), now()),
  ('10000000-0000-0000-0000-000000000053', 'authenticated', 'authenticated', 'task-department-lead@example.test', '', now(), '{}', '{}', now(), now()),
  ('10000000-0000-0000-0000-000000000054', 'authenticated', 'authenticated', 'task-staff-a@example.test', '', now(), '{}', '{}', now(), now()),
  ('10000000-0000-0000-0000-000000000055', 'authenticated', 'authenticated', 'task-staff-b@example.test', '', now(), '{}', '{}', now(), now()),
  ('10000000-0000-0000-0000-000000000056', 'authenticated', 'authenticated', 'task-offboarded@example.test', '', now(), '{}', '{}', now(), now());

insert into public.organizations (id, name, slug)
values ('00000000-0000-0000-0000-000000000051', 'Task Delegation Clinic', 'task-delegation-clinic');

insert into public.organization_members (id, organization_id, user_id, status, starts_at)
values
  ('20000000-0000-0000-0000-000000000051', '00000000-0000-0000-0000-000000000051', '10000000-0000-0000-0000-000000000051', 'active', now() - interval '1 day'),
  ('20000000-0000-0000-0000-000000000052', '00000000-0000-0000-0000-000000000051', '10000000-0000-0000-0000-000000000052', 'active', now() - interval '1 day'),
  ('20000000-0000-0000-0000-000000000053', '00000000-0000-0000-0000-000000000051', '10000000-0000-0000-0000-000000000053', 'active', now() - interval '1 day'),
  ('20000000-0000-0000-0000-000000000054', '00000000-0000-0000-0000-000000000051', '10000000-0000-0000-0000-000000000054', 'active', now() - interval '1 day'),
  ('20000000-0000-0000-0000-000000000055', '00000000-0000-0000-0000-000000000051', '10000000-0000-0000-0000-000000000055', 'active', now() - interval '1 day'),
  ('20000000-0000-0000-0000-000000000056', '00000000-0000-0000-0000-000000000051', '10000000-0000-0000-0000-000000000056', 'offboarded', now() - interval '2 days');

insert into public.locations (id, organization_id, name, short_name)
values
  ('30000000-0000-0000-0000-000000000051', '00000000-0000-0000-0000-000000000051', 'Task location A', 'TASK-A'),
  ('30000000-0000-0000-0000-000000000052', '00000000-0000-0000-0000-000000000051', 'Task location B', 'TASK-B');

insert into public.departments (id, organization_id, name)
values
  ('31000000-0000-0000-0000-000000000051', '00000000-0000-0000-0000-000000000051', 'Task department A'),
  ('31000000-0000-0000-0000-000000000052', '00000000-0000-0000-0000-000000000051', 'Task department B');

insert into public.assignments (organization_id, member_id, location_id, department_id, is_primary, starts_at)
values
  ('00000000-0000-0000-0000-000000000051', '20000000-0000-0000-0000-000000000051', '30000000-0000-0000-0000-000000000051', '31000000-0000-0000-0000-000000000051', true, now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000000051', '20000000-0000-0000-0000-000000000052', '30000000-0000-0000-0000-000000000051', '31000000-0000-0000-0000-000000000051', true, now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000000051', '20000000-0000-0000-0000-000000000053', '30000000-0000-0000-0000-000000000051', '31000000-0000-0000-0000-000000000051', true, now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000000051', '20000000-0000-0000-0000-000000000054', '30000000-0000-0000-0000-000000000051', '31000000-0000-0000-0000-000000000051', true, now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000000051', '20000000-0000-0000-0000-000000000055', '30000000-0000-0000-0000-000000000052', '31000000-0000-0000-0000-000000000052', true, now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000000051', '20000000-0000-0000-0000-000000000056', '30000000-0000-0000-0000-000000000051', '31000000-0000-0000-0000-000000000051', true, now() - interval '1 day');

insert into public.role_bindings (id, organization_id, member_id, role, starts_at)
values
  ('40000000-0000-0000-0000-000000000051', '00000000-0000-0000-0000-000000000051', '20000000-0000-0000-0000-000000000051', 'owner', now() - interval '1 day'),
  ('40000000-0000-0000-0000-000000000052', '00000000-0000-0000-0000-000000000051', '20000000-0000-0000-0000-000000000052', 'location_manager', now() - interval '1 day'),
  ('40000000-0000-0000-0000-000000000053', '00000000-0000-0000-0000-000000000051', '20000000-0000-0000-0000-000000000053', 'department_lead', now() - interval '1 day'),
  ('40000000-0000-0000-0000-000000000054', '00000000-0000-0000-0000-000000000051', '20000000-0000-0000-0000-000000000054', 'staff', now() - interval '1 day'),
  ('40000000-0000-0000-0000-000000000055', '00000000-0000-0000-0000-000000000051', '20000000-0000-0000-0000-000000000055', 'staff', now() - interval '1 day');

insert into public.role_binding_locations (organization_id, role_binding_id, location_id)
values ('00000000-0000-0000-0000-000000000051', '40000000-0000-0000-0000-000000000052', '30000000-0000-0000-0000-000000000051');
insert into public.role_binding_departments (organization_id, role_binding_id, department_id)
values ('00000000-0000-0000-0000-000000000051', '40000000-0000-0000-0000-000000000053', '31000000-0000-0000-0000-000000000051');

insert into public.channels (id, organization_id, name, display_name, purpose, type, owner_member_id)
values
  ('50000000-0000-0000-0000-000000000051', '00000000-0000-0000-0000-000000000051', 'task-scope-a', 'Task scope A', 'Scoped task coordination for location and department A.', 'department', '20000000-0000-0000-0000-000000000051'),
  ('50000000-0000-0000-0000-000000000052', '00000000-0000-0000-0000-000000000051', 'task-scope-b', 'Task scope B', 'Scoped task coordination for location and department B.', 'department', '20000000-0000-0000-0000-000000000051');

insert into public.channel_locations (organization_id, channel_id, location_id)
values
  ('00000000-0000-0000-0000-000000000051', '50000000-0000-0000-0000-000000000051', '30000000-0000-0000-0000-000000000051'),
  ('00000000-0000-0000-0000-000000000051', '50000000-0000-0000-0000-000000000052', '30000000-0000-0000-0000-000000000052');
insert into public.channel_departments (organization_id, channel_id, department_id)
values
  ('00000000-0000-0000-0000-000000000051', '50000000-0000-0000-0000-000000000051', '31000000-0000-0000-0000-000000000051'),
  ('00000000-0000-0000-0000-000000000051', '50000000-0000-0000-0000-000000000052', '31000000-0000-0000-0000-000000000052');

insert into public.channel_memberships (organization_id, channel_id, member_id, source, can_send, starts_at)
select '00000000-0000-0000-0000-000000000051', channel_id, member_id, 'policy', true, now() - interval '1 day'
from unnest(array['50000000-0000-0000-0000-000000000051'::uuid, '50000000-0000-0000-0000-000000000052'::uuid]) channel(channel_id)
cross join unnest(array[
  '20000000-0000-0000-0000-000000000051'::uuid,
  '20000000-0000-0000-0000-000000000052'::uuid,
  '20000000-0000-0000-0000-000000000053'::uuid,
  '20000000-0000-0000-0000-000000000054'::uuid,
  '20000000-0000-0000-0000-000000000055'::uuid,
  '20000000-0000-0000-0000-000000000056'::uuid
]) member(member_id);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000051","role":"authenticated","aal":"aal1"}', true);

select lives_ok(
  $$select public.create_task_with_message('00000000-0000-0000-0000-000000000051', '50000000-0000-0000-0000-000000000051', '20000000-0000-0000-0000-000000000054', '{}'::uuid[], 'Delegated opening check', now() + interval '1 day', array['Walk the site', 'Confirm coverage'], '{}'::uuid[], '60000000-0000-0000-0000-000000000051', '61000000-0000-0000-0000-000000000051', 'Assigned task: Delegated opening check')$$,
  'an owner delegates work to an active member'
);
select is((select status from public.tasks where client_task_id = '60000000-0000-0000-0000-000000000051'), 'pending_acceptance', 'delegated work awaits the owner response');
select throws_ok(
  $$select public.respond_to_task_assignment('00000000-0000-0000-0000-000000000051', (select id from public.tasks where client_task_id = '60000000-0000-0000-0000-000000000051'), 'accept', null)$$,
  '42501', 'The task response is not allowed.', 'a manager cannot accept for the assigned owner'
);
select throws_ok(
  $$select public.create_task_with_message('00000000-0000-0000-0000-000000000051', '50000000-0000-0000-0000-000000000051', '20000000-0000-0000-0000-000000000056', '{}'::uuid[], 'Invalid assignment', now() + interval '1 day', '{}'::text[], '{}'::uuid[], '60000000-0000-0000-0000-000000000056', '61000000-0000-0000-0000-000000000056', 'Assigned task: Invalid assignment')$$,
  '42501', 'The current member cannot assign this task.', 'offboarded assignees are rejected'
);

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000054","role":"authenticated","aal":"aal1"}', true);
select lives_ok(
  $$select public.respond_to_task_assignment('00000000-0000-0000-0000-000000000051', (select id from public.tasks where client_task_id = '60000000-0000-0000-0000-000000000051'), 'accept', null)$$,
  'the assigned owner accepts the work'
);
select is((select status from public.tasks where client_task_id = '60000000-0000-0000-0000-000000000051'), 'accepted', 'acceptance activates the task');
select lives_ok(
  $$select public.set_task_checklist_item('00000000-0000-0000-0000-000000000051', (select id from public.tasks where client_task_id = '60000000-0000-0000-0000-000000000051'), (select id from public.task_checklist_items where task_id = (select id from public.tasks where client_task_id = '60000000-0000-0000-0000-000000000051') order by position limit 1), true)$$,
  'the owner checks the first checklist item'
);
select is((select status from public.tasks where client_task_id = '60000000-0000-0000-0000-000000000051'), 'in_progress', 'the first checked item starts work automatically');
select lives_ok(
  $$select public.set_task_checklist_item('00000000-0000-0000-0000-000000000051', (select id from public.tasks where client_task_id = '60000000-0000-0000-0000-000000000051'), (select id from public.task_checklist_items where task_id = (select id from public.tasks where client_task_id = '60000000-0000-0000-0000-000000000051') order by position desc limit 1), true)$$,
  'the owner checks the final checklist item'
);
select is((select status from public.tasks where client_task_id = '60000000-0000-0000-0000-000000000051'), 'done', 'the final checked item completes work atomically');
select is((select count(*) from public.task_events where task_id = (select id from public.tasks where client_task_id = '60000000-0000-0000-0000-000000000051') and actor_member_id = '20000000-0000-0000-0000-000000000054'), 3::bigint, 'acceptance, start, and completion events retain actor attribution');

select lives_ok(
  $$select public.create_task_with_message('00000000-0000-0000-0000-000000000051', '50000000-0000-0000-0000-000000000051', '20000000-0000-0000-0000-000000000054', '{}'::uuid[], 'Staff self check', now() + interval '2 days', '{}'::text[], '{}'::uuid[], '60000000-0000-0000-0000-000000000054', '61000000-0000-0000-0000-000000000054', 'Created task: Staff self check')$$,
  'staff can create work only for themselves'
);
select is((select status from public.tasks where client_task_id = '60000000-0000-0000-0000-000000000054'), 'accepted', 'self-created work starts accepted');
select throws_ok(
  $$select public.create_task_with_message('00000000-0000-0000-0000-000000000051', '50000000-0000-0000-0000-000000000051', '20000000-0000-0000-0000-000000000053', '{}'::uuid[], 'Prohibited staff delegation', now() + interval '2 days', '{}'::text[], '{}'::uuid[], '60000000-0000-0000-0000-000000000059', '61000000-0000-0000-0000-000000000059', 'Assigned task')$$,
  '42501', 'The current member cannot assign this task.', 'staff cannot delegate to another member'
);

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000052","role":"authenticated","aal":"aal1"}', true);
select lives_ok(
  $$select public.create_task_with_message('00000000-0000-0000-0000-000000000051', '50000000-0000-0000-0000-000000000051', '20000000-0000-0000-0000-000000000054', '{}'::uuid[], 'Location scoped assignment', now() + interval '2 days', '{}'::text[], '{}'::uuid[], '60000000-0000-0000-0000-000000000052', '61000000-0000-0000-0000-000000000052', 'Assigned task')$$,
  'a location manager delegates inside assigned scope'
);
select throws_ok(
  $$select public.create_task_with_message('00000000-0000-0000-0000-000000000051', '50000000-0000-0000-0000-000000000052', '20000000-0000-0000-0000-000000000055', '{}'::uuid[], 'Cross-location assignment', now() + interval '2 days', '{}'::text[], '{}'::uuid[], '60000000-0000-0000-0000-000000000062', '61000000-0000-0000-0000-000000000062', 'Assigned task')$$,
  '42501', 'The current member cannot assign this task.', 'a location manager cannot delegate outside assigned scope'
);

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000053","role":"authenticated","aal":"aal1"}', true);
select lives_ok(
  $$select public.create_task_with_message('00000000-0000-0000-0000-000000000051', '50000000-0000-0000-0000-000000000051', '20000000-0000-0000-0000-000000000054', '{}'::uuid[], 'Department scoped assignment', now() + interval '2 days', '{}'::text[], '{}'::uuid[], '60000000-0000-0000-0000-000000000053', '61000000-0000-0000-0000-000000000053', 'Assigned task')$$,
  'a department lead delegates inside assigned scope'
);
select throws_ok(
  $$select public.create_task_with_message('00000000-0000-0000-0000-000000000051', '50000000-0000-0000-0000-000000000052', '20000000-0000-0000-0000-000000000055', '{}'::uuid[], 'Cross-department assignment', now() + interval '2 days', '{}'::text[], '{}'::uuid[], '60000000-0000-0000-0000-000000000063', '61000000-0000-0000-0000-000000000063', 'Assigned task')$$,
  '42501', 'The current member cannot assign this task.', 'a department lead cannot delegate outside assigned scope'
);

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000051","role":"authenticated","aal":"aal1"}', true);
select lives_ok(
  $$select public.transition_task('00000000-0000-0000-0000-000000000051', (select id from public.tasks where client_task_id = '60000000-0000-0000-0000-000000000051'), 'reopen', 'Coverage needs another review', (select id from public.task_checklist_items where task_id = (select id from public.tasks where client_task_id = '60000000-0000-0000-0000-000000000051') order by position limit 1))$$,
  'an authorized manager reopens a completed checklist item'
);
select is((select status from public.tasks where client_task_id = '60000000-0000-0000-0000-000000000051'), 'in_progress', 'reopening returns a checklist task to in progress');
select is((select count(*) from public.task_checklist_items where task_id = (select id from public.tasks where client_task_id = '60000000-0000-0000-0000-000000000051') and completed), 1::bigint, 'reopening unchecks only the selected item');
select lives_ok(
  $$select public.reassign_task('00000000-0000-0000-0000-000000000051', (select id from public.tasks where client_task_id = '60000000-0000-0000-0000-000000000054'), '20000000-0000-0000-0000-000000000055', 'Move the follow-up to the other staff member')$$,
  'an authorized manager reassigns active work'
);
select is((select status from public.tasks where client_task_id = '60000000-0000-0000-0000-000000000054'), 'pending_acceptance', 'reassignment requires the new owner response');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000055","role":"authenticated","aal":"aal1"}', true);
select throws_ok(
  $$select public.respond_to_task_assignment('00000000-0000-0000-0000-000000000051', (select id from public.tasks where client_task_id = '60000000-0000-0000-0000-000000000054'), 'decline', null)$$,
  '42501', 'The task response is not allowed.', 'declining without a reason is rejected'
);
select lives_ok(
  $$select public.respond_to_task_assignment('00000000-0000-0000-0000-000000000051', (select id from public.tasks where client_task_id = '60000000-0000-0000-0000-000000000054'), 'decline', 'Scheduled at another location')$$,
  'the new owner can decline with a reason'
);
select is((select status_reason from public.tasks where client_task_id = '60000000-0000-0000-0000-000000000054'), 'Scheduled at another location', 'the rejection reason remains visible on the task');
select is((select count(*) from public.tasks where client_task_id = '60000000-0000-0000-0000-000000000051'), 0::bigint, 'RLS hides unrelated task details from another staff member');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000054","role":"authenticated","aal":"aal1"}', true);
select lives_ok(
  $$select public.respond_to_task_assignment('00000000-0000-0000-0000-000000000051', (select id from public.tasks where client_task_id = '60000000-0000-0000-0000-000000000052'), 'accept', null)$$,
  'the owner accepts a location-scoped assignment'
);
select throws_ok(
  $$select public.transition_task('00000000-0000-0000-0000-000000000051', (select id from public.tasks where client_task_id = '60000000-0000-0000-0000-000000000052'), 'block', null, null)$$,
  '42501', 'This task cannot be blocked.', 'blocking without a reason is rejected'
);
select lives_ok(
  $$select public.transition_task('00000000-0000-0000-0000-000000000051', (select id from public.tasks where client_task_id = '60000000-0000-0000-0000-000000000052'), 'block', 'Waiting for a replacement key', null)$$,
  'the owner reports a blocker with a reason'
);
select is((select status from public.tasks where client_task_id = '60000000-0000-0000-0000-000000000052'), 'blocked', 'blocking changes the lifecycle status');
select lives_ok(
  $$select public.transition_task('00000000-0000-0000-0000-000000000051', (select id from public.tasks where client_task_id = '60000000-0000-0000-0000-000000000052'), 'unblock', null, null)$$,
  'the owner clears a blocker'
);
select is((select status from public.tasks where client_task_id = '60000000-0000-0000-0000-000000000052'), 'accepted', 'clearing a blocker restores accepted when no checklist work is complete');

reset role;
select is(
  private.next_task_schedule_due('monthly', '2027-01-31 03:00:00+00'::timestamptz, '{}'::smallint[], 31::smallint, '10:00'::time, 'Asia/Ho_Chi_Minh'),
  '2027-02-28 03:00:00+00'::timestamptz,
  'monthly schedules use the final day of shorter months'
);

insert into public.task_templates (id, organization_id, created_by_member_id, name, title, visibility)
values ('70000000-0000-0000-0000-000000000051', '00000000-0000-0000-0000-000000000051', '20000000-0000-0000-0000-000000000051', 'Recurring check', 'Recurring check', 'private');
insert into public.task_template_items (organization_id, template_id, position, label)
values ('00000000-0000-0000-0000-000000000051', '70000000-0000-0000-0000-000000000051', 0, 'Confirm readiness');
insert into public.task_schedules (id, organization_id, template_id, created_by_member_id, channel_id, owner_member_id, frequency, due_local_time, timezone, create_lead_minutes, next_due_at)
values ('71000000-0000-0000-0000-000000000051', '00000000-0000-0000-0000-000000000051', '70000000-0000-0000-0000-000000000051', '20000000-0000-0000-0000-000000000051', '50000000-0000-0000-0000-000000000051', '20000000-0000-0000-0000-000000000054', 'daily', '19:00'::time, 'Asia/Ho_Chi_Minh', 1440, '2026-08-04 12:00:00+00');

select is(private.generate_due_task_occurrences('2026-08-03 12:00:00+00'), 1, 'the recurrence generator creates an eligible independent occurrence');
select is(private.generate_due_task_occurrences('2026-08-03 12:00:00+00'), 0, 'the recurrence generator is idempotent at the same reference time');
update public.task_templates set title = 'Future recurring title' where id = '70000000-0000-0000-0000-000000000051';
select is((select title from public.tasks where schedule_id = '71000000-0000-0000-0000-000000000051'), 'Recurring check', 'schedule edits do not rewrite existing occurrences');
update public.task_schedules set active = false, next_due_at = '2026-08-04 12:00:00+00' where id = '71000000-0000-0000-0000-000000000051';
select is(private.generate_due_task_occurrences('2026-08-03 12:00:00+00'), 0, 'paused schedules do not generate occurrences');
select is((select count(*) from public.tasks where schedule_id = '71000000-0000-0000-0000-000000000051'), 1::bigint, 'a schedule occurrence remains independent and unique');

select * from finish();
rollback;
