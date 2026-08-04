begin;

select plan(11);

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
values
  (
    '10000000-0000-0000-0000-000000000021',
    'authenticated',
    'authenticated',
    'onboarding@example.test',
    '',
    now(),
    '{}',
    '{}',
    now(),
    now()
  ),
  (
    '10000000-0000-0000-0000-000000000022',
    'authenticated',
    'authenticated',
    'suspended-onboarding@example.test',
    '',
    now(),
    '{}',
    '{}',
    now(),
    now()
  );

insert into public.organizations (id, name, slug)
values (
  '00000000-0000-0000-0000-000000000021',
  'Onboarding Clinic',
  'onboarding-clinic'
);

insert into public.profiles (
  id,
  full_name,
  work_email
)
values
  (
    '10000000-0000-0000-0000-000000000021',
    'Pending Staff',
    'onboarding@example.test'
  ),
  (
    '10000000-0000-0000-0000-000000000022',
    'Suspended Staff',
    'suspended-onboarding@example.test'
  );

insert into public.organization_members (
  id,
  organization_id,
  user_id,
  status,
  starts_at
)
values
  (
    '20000000-0000-0000-0000-000000000021',
    '00000000-0000-0000-0000-000000000021',
    '10000000-0000-0000-0000-000000000021',
    'active',
    now() - interval '1 day'
  ),
  (
    '20000000-0000-0000-0000-000000000022',
    '00000000-0000-0000-0000-000000000021',
    '10000000-0000-0000-0000-000000000022',
    'suspended',
    now() - interval '1 day'
  );

insert into public.onboarding_progress (
  organization_id,
  member_id,
  status
)
values
  (
    '00000000-0000-0000-0000-000000000021',
    '20000000-0000-0000-0000-000000000021',
    'policies'
  ),
  (
    '00000000-0000-0000-0000-000000000021',
    '20000000-0000-0000-0000-000000000022',
    'policies'
  );

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000021","role":"authenticated","aal":"aal1"}',
  true
);
select lives_ok(
  $$
    select public.complete_staff_onboarding(
      '20000000-0000-0000-0000-000000000021',
      '  Verified Staff  ',
      'en-US',
      '22:00'::time,
      '06:00'::time,
      true
    )
  $$,
  'an active AAL1 member can complete their own onboarding'
);
select is(
  (
    select full_name
    from public.profiles
    where id = '10000000-0000-0000-0000-000000000021'
  ),
  'Verified Staff',
  'onboarding normalizes and updates the member profile'
);
select is(
  (
    select locale
    from public.profiles
    where id = '10000000-0000-0000-0000-000000000021'
  ),
  'en-US',
  'onboarding stores the selected profile locale'
);
select is(
  (
    select status
    from public.onboarding_progress
    where member_id = '20000000-0000-0000-0000-000000000021'
  ),
  'complete',
  'onboarding reaches complete'
);
select is(
  (
    select accepted_policy_version
    from public.onboarding_progress
    where member_id = '20000000-0000-0000-0000-000000000021'
  ),
  'operational-use-2026-07',
  'the database controls the accepted policy version'
);
select ok(
  (
    select accepted_policy_at is not null
    from public.onboarding_progress
    where member_id = '20000000-0000-0000-0000-000000000021'
  ),
  'the database timestamps policy acceptance'
);
select results_eq(
  $$
    select
      locale,
      quiet_hours_start,
      quiet_hours_end,
      notifications_enabled
    from public.onboarding_progress
    where member_id = '20000000-0000-0000-0000-000000000021'
  $$,
  $$
    values ('en-US'::text, '22:00'::time, '06:00'::time, true)
  $$,
  'onboarding saves notification and quiet-hour preferences'
);
select is(
  (select count(*) from public.audit_events),
  0::bigint,
  'ordinary staff cannot read onboarding audit events'
);
reset role;

select is(
  (
    select count(*)
    from public.audit_events
    where organization_id = '00000000-0000-0000-0000-000000000021'
      and actor_member_id = '20000000-0000-0000-0000-000000000021'
      and action = 'onboarding.completed'
      and metadata ->> 'policy_version' = 'operational-use-2026-07'
  ),
  1::bigint,
  'onboarding appends metadata-only audit evidence'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000022","role":"authenticated","aal":"aal2"}',
  true
);
select throws_ok(
  $$
    select public.complete_staff_onboarding(
      '20000000-0000-0000-0000-000000000022',
      'Suspended Staff',
      'vi-VN',
      null,
      null,
      false
    )
  $$,
  '42501',
  'an active member can complete only their own onboarding',
  'a suspended member cannot complete onboarding'
);
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000021","role":"authenticated","aal":"aal1"}',
  true
);
select lives_ok(
  $$
    select public.complete_staff_onboarding(
      '20000000-0000-0000-0000-000000000021',
      'Verified Staff',
      'en-US',
      null,
      null,
      false
    )
  $$,
  'an active AAL1 member can safely repeat their own onboarding workflow'
);
reset role;

select * from finish();
rollback;
