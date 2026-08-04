begin;

select plan(16);

select has_table('public', 'organizations', 'organizations table exists');
select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'role_bindings', 'role bindings table exists');
select has_trigger(
  'public',
  'locations',
  'locations_set_updated_at',
  'locations maintain updated_at in the database'
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
values
  (
    '10000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'member@example.test',
    '',
    now(),
    '{}',
    '{}',
    now(),
    now()
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'manager@example.test',
    '',
    now(),
    '{}',
    '{}',
    now(),
    now()
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    'authenticated',
    'authenticated',
    'outsider@example.test',
    '',
    now(),
    '{}',
    '{}',
    now(),
    now()
  ),
  (
    '10000000-0000-0000-0000-000000000004',
    'authenticated',
    'authenticated',
    'suspended@example.test',
    '',
    now(),
    '{}',
    '{}',
    now(),
    now()
  ),
  (
    '10000000-0000-0000-0000-000000000005',
    'authenticated',
    'authenticated',
    'expired@example.test',
    '',
    now(),
    '{}',
    '{}',
    now(),
    now()
  );

insert into public.organizations (id, name, slug)
values
  (
    '00000000-0000-0000-0000-000000000001',
    'Test Clinic',
    'test-clinic'
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'Other Clinic',
    'other-clinic'
  );

insert into public.organization_members (
  id,
  organization_id,
  user_id,
  status,
  starts_at,
  expires_at
)
values
  (
    '20000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'active',
    now() - interval '1 day',
    null
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    'active',
    now() - interval '1 day',
    null
  ),
  (
    '20000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000004',
    'suspended',
    now() - interval '2 days',
    null
  ),
  (
    '20000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000005',
    'active',
    now() - interval '2 days',
    now() - interval '1 day'
  );

insert into public.locations (
  id,
  organization_id,
  name,
  short_name,
  updated_at
)
values
  (
    '30000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'Scoped location',
    'Scoped',
    '2000-01-01 00:00:00+00'
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'Unscoped location',
    'Unscoped',
    '2000-01-01 00:00:00+00'
  ),
  (
    '30000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000002',
    'Other organization location',
    'Other',
    '2000-01-01 00:00:00+00'
  );

insert into public.departments (
  id,
  organization_id,
  name
)
values
  (
    '31000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'Operations'
  ),
  (
    '31000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000002',
    'Other operations'
  );

insert into public.onboarding_progress (
  organization_id,
  member_id,
  locale
)
values (
  '00000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000004',
  'vi-VN'
);

insert into public.role_bindings (
  id,
  organization_id,
  member_id,
  role
)
values (
  '40000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000002',
  'location_manager'
);

insert into public.role_binding_locations (
  organization_id,
  role_binding_id,
  location_id
)
values (
  '00000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001'
);

select throws_ok(
  $$
    insert into public.assignments (
      organization_id,
      member_id,
      location_id,
      department_id
    )
    values (
      '00000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000003',
      '31000000-0000-0000-0000-000000000001'
    )
  $$,
  '23503',
  'insert or update on table "assignments" violates foreign key constraint "assignments_organization_id_location_id_fkey"',
  'tenant-owned relationships reject cross-organization rows'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}',
  true
);
select is(
  (select count(*) from public.organizations),
  1::bigint,
  'an active AAL2 member can read their organization'
);
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000004","role":"authenticated","aal":"aal2"}',
  true
);
select is(
  (select count(*) from public.organization_members),
  1::bigint,
  'a suspended user can read only their own membership status'
);
select is(
  (select count(*) from public.organizations),
  0::bigint,
  'a suspended user cannot read organization data'
);
update public.onboarding_progress
set locale = 'en-US'
where member_id = '20000000-0000-0000-0000-000000000004';
reset role;
select is(
  (
    select locale
    from public.onboarding_progress
    where member_id = '20000000-0000-0000-0000-000000000004'
  ),
  'vi-VN',
  'a suspended user cannot change onboarding state'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000005","role":"authenticated","aal":"aal2"}',
  true
);
select is(
  (select count(*) from public.organization_members),
  1::bigint,
  'an expired user can read only their own membership status'
);
select is(
  (select count(*) from public.organizations),
  0::bigint,
  'an expired user cannot read organization data'
);
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);
select is(
  (select count(*) from public.organizations),
  1::bigint,
  'an active AAL1 member can read their organization'
);
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated","aal":"aal2"}',
  true
);
select is(
  (select count(*) from public.organizations),
  0::bigint,
  'an outsider cannot read the organization'
);
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}',
  true
);
update public.locations
set name = 'Updated scoped location'
where id = '30000000-0000-0000-0000-000000000001';
select is(
  (
    select name
    from public.locations
    where id = '30000000-0000-0000-0000-000000000001'
  ),
  'Updated scoped location',
  'a location manager can update their scoped location'
);
update public.locations
set name = 'Updated unscoped location'
where id = '30000000-0000-0000-0000-000000000002';
select is(
  (
    select name
    from public.locations
    where id = '30000000-0000-0000-0000-000000000002'
  ),
  'Unscoped location',
  'a location manager cannot update an unscoped location'
);
select ok(
  (
    select updated_at
    from public.locations
    where id = '30000000-0000-0000-0000-000000000001'
  ) > '2000-01-01 00:00:00+00'::timestamptz,
  'location updates receive a server-controlled updated_at timestamp'
);
reset role;

select * from finish();
rollback;
