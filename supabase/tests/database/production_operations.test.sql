begin;

select plan(28);

select has_table(
  'public',
  'account_preferences',
  'account preferences table exists'
);
select has_table(
  'public',
  'push_subscriptions',
  'push subscriptions table exists'
);
select has_table('public', 'tasks', 'tasks table exists');
select has_table(
  'public',
  'task_checklist_items',
  'task checklist table exists'
);
select has_table(
  'public',
  'task_attachments',
  'task attachment links exist'
);
select has_table('public', 'meetings', 'meetings table exists');
select has_table(
  'public',
  'meeting_responses',
  'meeting responses table exists'
);
select has_table(
  'public',
  'announcements',
  'announcements table exists'
);
select has_table(
  'public',
  'access_requests',
  'access requests table exists'
);
select has_table(
  'public',
  'policy_warning_events',
  'metadata-only policy warning table exists'
);
select has_function(
  'public',
  'save_my_account_settings',
  array[
    'uuid',
    'uuid',
    'text',
    'uuid',
    'boolean',
    'time without time zone',
    'time without time zone',
    'text'
  ],
  'account settings RPC exists'
);
select has_function(
  'public',
  'create_task_with_message',
  array[
    'uuid',
    'uuid',
    'uuid',
    'uuid[]',
    'text',
    'timestamp with time zone',
    'text[]',
    'uuid[]',
    'uuid',
    'uuid',
    'text'
  ],
  'atomic task RPC exists'
);
select has_function(
  'public',
  'create_meeting_with_message',
  array[
    'uuid',
    'uuid',
    'text',
    'text',
    'text',
    'timestamp with time zone',
    'timestamp with time zone',
    'text',
    'uuid',
    'uuid',
    'text'
  ],
  'atomic meeting RPC exists'
);
select has_function(
  'public',
  'create_announcement',
  array[
    'uuid',
    'text',
    'text',
    'boolean',
    'uuid[]',
    'uuid[]',
    'text',
    'boolean',
    'text',
    'timestamp with time zone'
  ],
  'announcement RPC exists'
);

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  '10000000-0000-0000-0000-000000000041',
  'authenticated',
  'authenticated',
  'operations-owner@example.test',
  '',
  now(),
  '{}',
  '{}',
  now(),
  now()
);

insert into public.organizations (id, name, slug)
values (
  '00000000-0000-0000-0000-000000000041',
  'Operations Clinic',
  'operations-clinic'
);

insert into public.profiles (
  id,
  full_name,
  work_email,
  locale
)
values (
  '10000000-0000-0000-0000-000000000041',
  'Operations Owner',
  'operations-owner@example.test',
  'vi-VN'
);

insert into public.organization_members (
  id,
  organization_id,
  user_id,
  starts_at
)
values (
  '20000000-0000-0000-0000-000000000041',
  '00000000-0000-0000-0000-000000000041',
  '10000000-0000-0000-0000-000000000041',
  now() - interval '1 day'
);

insert into public.locations (
  id,
  organization_id,
  name,
  short_name
)
values (
  '30000000-0000-0000-0000-000000000041',
  '00000000-0000-0000-0000-000000000041',
  'Operations location',
  'OPS'
);

insert into public.departments (
  id,
  organization_id,
  name
)
values (
  '31000000-0000-0000-0000-000000000041',
  '00000000-0000-0000-0000-000000000041',
  'Operations'
);

insert into public.assignments (
  organization_id,
  member_id,
  location_id,
  department_id,
  is_primary,
  starts_at
)
values (
  '00000000-0000-0000-0000-000000000041',
  '20000000-0000-0000-0000-000000000041',
  '30000000-0000-0000-0000-000000000041',
  '31000000-0000-0000-0000-000000000041',
  true,
  now() - interval '1 day'
);

insert into public.role_bindings (
  organization_id,
  member_id,
  role,
  starts_at
)
values (
  '00000000-0000-0000-0000-000000000041',
  '20000000-0000-0000-0000-000000000041',
  'owner',
  now() - interval '1 day'
);

insert into public.channels (
  id,
  organization_id,
  name,
  display_name,
  purpose,
  type,
  owner_member_id
)
values (
  '50000000-0000-0000-0000-000000000041',
  '00000000-0000-0000-0000-000000000041',
  'operations-tests',
  'Operations tests',
  'Exercise durable production operations in one tenant.',
  'department',
  '20000000-0000-0000-0000-000000000041'
);

insert into public.channel_memberships (
  organization_id,
  channel_id,
  member_id,
  source,
  can_send,
  starts_at
)
values (
  '00000000-0000-0000-0000-000000000041',
  '50000000-0000-0000-0000-000000000041',
  '20000000-0000-0000-0000-000000000041',
  'policy',
  true,
  now() - interval '1 day'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000041","role":"authenticated","aal":"aal2","session_id":"operations-session"}',
  true
);

select lives_ok(
  $$
    select public.save_my_account_settings(
      '00000000-0000-0000-0000-000000000041',
      '20000000-0000-0000-0000-000000000041',
      'en-US',
      '30000000-0000-0000-0000-000000000041',
      true,
      '21:00'::time,
      '07:00'::time,
      'Asia/Ho_Chi_Minh'
    )
  $$,
  'an active AAL2 member saves account settings'
);
select is(
  (
    select locale
    from public.profiles
    where id = '10000000-0000-0000-0000-000000000041'
  ),
  'en-US',
  'saving preferences updates the profile locale'
);
select is(
  (
    select default_location_id
    from public.account_preferences
    where member_id = '20000000-0000-0000-0000-000000000041'
  ),
  '30000000-0000-0000-0000-000000000041'::uuid,
  'the assigned default location is stored'
);

select lives_ok(
  $$
    select public.create_task_with_message(
      '00000000-0000-0000-0000-000000000041',
      '50000000-0000-0000-0000-000000000041',
      '20000000-0000-0000-0000-000000000041',
      '{}'::uuid[],
      'Confirm the operational handoff',
      now() + interval '1 day',
      array['Confirm owner', 'Post update'],
      '{}'::uuid[],
      '60000000-0000-0000-0000-000000000041',
      '61000000-0000-0000-0000-000000000041',
      'Assigned task: Confirm the operational handoff'
    )
  $$,
  'task creation and its channel message are atomic'
);
select is(
  (
    select count(*)
    from public.tasks
    where organization_id = '00000000-0000-0000-0000-000000000041'
  ),
  1::bigint,
  'one durable task is created'
);
select is(
  (
    select count(*)
    from public.messages
    where task_id = (
      select id
      from public.tasks
      where organization_id = '00000000-0000-0000-0000-000000000041'
    )
  ),
  1::bigint,
  'the task status message links back to the task'
);

select lives_ok(
  $$
    select public.create_meeting_with_message(
      '00000000-0000-0000-0000-000000000041',
      '50000000-0000-0000-0000-000000000041',
      'Operations review',
      'zoom',
      'https://yksg.zoom.us/j/123456789',
      now() + interval '2 days',
      now() + interval '2 days 30 minutes',
      'Asia/Ho_Chi_Minh',
      '70000000-0000-0000-0000-000000000041',
      '71000000-0000-0000-0000-000000000041',
      'Operations review https://yksg.zoom.us/j/123456789'
    )
  $$,
  'meeting creation and its channel message are atomic'
);
select is(
  (
    select count(*)
    from public.messages
    where meeting_id = (
      select id
      from public.meetings
      where organization_id = '00000000-0000-0000-0000-000000000041'
    )
  ),
  1::bigint,
  'the meeting message links back to the meeting'
);

select lives_ok(
  $$
    select public.authorize_message_notification(
      (
        select id
        from public.messages
        where client_message_id =
          '71000000-0000-0000-0000-000000000041'
      )
    )
  $$,
  'the current AAL2 message author can authorize notification delivery'
);

select lives_ok(
  $$
    select public.create_announcement(
      '00000000-0000-0000-0000-000000000041',
      'Operations notice',
      'Use the updated operational handoff checklist.',
      true,
      '{}'::uuid[],
      '{}'::uuid[],
      'urgent',
      true,
      'published',
      now() + interval '7 days'
    )
  $$,
  'an owner publishes an organization-wide announcement'
);
select is(
  (
    select count(*)
    from public.announcements
    where organization_id = '00000000-0000-0000-0000-000000000041'
      and status = 'published'
  ),
  1::bigint,
  'the published announcement is durable'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000041","role":"authenticated","aal":"aal1","session_id":"ordinary-aal1"}',
  true
);
select is(
  private.session_satisfies_mfa(),
  false,
  'ordinary AAL1 sessions remain denied'
);
select throws_ok(
  $$
    select public.authorize_message_notification(
      (
        select id
        from public.messages
        where client_message_id =
          '71000000-0000-0000-0000-000000000041'
      )
    )
  $$,
  '42501',
  'AAL2 is required to send notifications.',
  'an AAL1 message author cannot authorize notification delivery'
);

reset role;
update private.environment_settings set environment = 'production';
insert into private.development_mfa_bypasses (
  user_id,
  reason,
  expires_at
)
values (
  '10000000-0000-0000-0000-000000000041',
  'Must remain disabled outside development',
  now() + interval '1 hour'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000041","role":"authenticated","aal":"aal1","session_id":"production-aal1"}',
  true
);
select is(
  private.session_satisfies_mfa(),
  false,
  'the MFA bypass fails closed when the database is not development'
);

select * from finish();
rollback;
