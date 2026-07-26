begin;

select plan(21);

select has_table(
  'private',
  'development_mfa_bypasses',
  'development MFA bypass allowlist exists outside the exposed schema'
);
select has_table(
  'private',
  'development_mfa_bypass_events',
  'development MFA bypass use is recorded'
);
select has_function(
  'private',
  'session_satisfies_mfa',
  array[]::text[],
  'the shared MFA authorization helper exists'
);
select has_function(
  'public',
  'begin_development_mfa_bypass',
  array[]::text[],
  'authenticated clients can check and record an allowlisted bypass'
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
    '10000000-0000-0000-0000-000000000031',
    'authenticated',
    'authenticated',
    'bypass-member@example.test',
    '',
    now(),
    '{}',
    '{}',
    now(),
    now()
  ),
  (
    '10000000-0000-0000-0000-000000000032',
    'authenticated',
    'authenticated',
    'bypass-outsider@example.test',
    '',
    now(),
    '{}',
    '{}',
    now(),
    now()
  );

insert into public.organizations (id, name, slug)
values (
  '00000000-0000-0000-0000-000000000031',
  'Development Bypass Clinic',
  'development-bypass-clinic'
);

insert into public.organization_members (
  id,
  organization_id,
  user_id,
  status,
  starts_at
)
values (
  '20000000-0000-0000-0000-000000000031',
  '00000000-0000-0000-0000-000000000031',
  '10000000-0000-0000-0000-000000000031',
  'active',
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
  '50000000-0000-0000-0000-000000000031',
  '00000000-0000-0000-0000-000000000031',
  'development-bypass',
  'Development bypass',
  'Exercise development-only authentication behavior.',
  'department',
  '20000000-0000-0000-0000-000000000031'
);

insert into public.channel_memberships (
  id,
  organization_id,
  channel_id,
  member_id,
  source,
  can_send,
  starts_at
)
values (
  '51000000-0000-0000-0000-000000000031',
  '00000000-0000-0000-0000-000000000031',
  '50000000-0000-0000-0000-000000000031',
  '20000000-0000-0000-0000-000000000031',
  'policy',
  true,
  now() - interval '1 day'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000031","role":"authenticated","aal":"aal1","session_id":"dev-session-1"}',
  true
);
select is(
  private.session_satisfies_mfa(),
  false,
  'AAL1 remains denied without an explicit allowlist record'
);
select is(
  (select count(*) from public.organizations),
  0::bigint,
  'restrictive RLS remains fail closed for an ordinary AAL1 session'
);
select is(
  public.begin_development_mfa_bypass(),
  null::timestamptz,
  'the public bypass function returns no activation for an unlisted user'
);
reset role;

insert into private.development_mfa_bypasses (
  user_id,
  reason,
  expires_at
)
values (
  '10000000-0000-0000-0000-000000000031',
  'Local development test',
  now() + interval '1 hour'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000031","role":"authenticated","aal":"aal1","session_id":"dev-session-1"}',
  true
);
select is(
  private.session_satisfies_mfa(),
  true,
  'an allowlisted, unexpired development identity satisfies the MFA gate'
);
select is(
  (select count(*) from public.organizations),
  1::bigint,
  'the development bypass reaches the same tenant-scoped RLS path as AAL2'
);
select lives_ok(
  $$
    select public.create_attachment_upload(
      '50000000-0000-0000-0000-000000000031',
      'development.pdf',
      'application/pdf',
      1024,
      '70000000-0000-0000-0000-000000000031'
    )
  $$,
  'the allowlisted AAL1 sender can use attachment initialization'
);
select lives_ok(
  $$
    select public.send_message_with_attachments(
      '00000000-0000-0000-0000-000000000031',
      '50000000-0000-0000-0000-000000000031',
      '20000000-0000-0000-0000-000000000031',
      '60000000-0000-0000-0000-000000000031',
      'Development bypass message',
      false,
      '{}'::uuid[]
    )
  $$,
  'the allowlisted AAL1 sender can use the atomic message RPC'
);
select cmp_ok(
  public.begin_development_mfa_bypass(),
  '>',
  now(),
  'the public bypass function returns the server-controlled expiry'
);
select cmp_ok(
  public.begin_development_mfa_bypass(),
  '>',
  now(),
  'restarting the same bypass session is idempotent'
);
reset role;

select is(
  (
    select count(*)
    from private.development_mfa_bypass_events
    where user_id = '10000000-0000-0000-0000-000000000031'
  ),
  1::bigint,
  'bypass use is recorded once per authenticated session'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000032","role":"authenticated","aal":"aal1","session_id":"dev-session-2"}',
  true
);
select is(
  private.session_satisfies_mfa(),
  false,
  'an AAL1 identity cannot reuse another user bypass'
);
reset role;

update private.development_mfa_bypasses
set
  created_at = now() - interval '1 day',
  expires_at = now() - interval '1 second'
where user_id = '10000000-0000-0000-0000-000000000031';

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000031","role":"authenticated","aal":"aal1","session_id":"dev-session-3"}',
  true
);
select is(
  private.session_satisfies_mfa(),
  false,
  'an expired development bypass fails closed'
);
select is(
  (select count(*) from public.organizations),
  0::bigint,
  'expired bypasses are denied by restrictive RLS'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000031","role":"authenticated","aal":"aal2","session_id":"aal2-session"}',
  true
);
select is(
  private.session_satisfies_mfa(),
  true,
  'real AAL2 sessions remain authorized without an active bypass'
);
select is(
  has_table_privilege(
    'authenticated',
    'private.development_mfa_bypasses',
    'select'
  ),
  false,
  'authenticated clients cannot read the bypass allowlist'
);
select is(
  has_table_privilege(
    'authenticated',
    'private.development_mfa_bypass_events',
    'select'
  ),
  false,
  'authenticated clients cannot read the bypass event ledger'
);
reset role;

select throws_ok(
  $$
    insert into private.development_mfa_bypasses (
      user_id,
      reason,
      expires_at
    )
    values (
      '10000000-0000-0000-0000-000000000032',
      'Invalid long-lived bypass',
      now() + interval '8 days'
    )
  $$,
  '23514',
  'new row for relation "development_mfa_bypasses" violates check constraint "development_mfa_bypasses_max_duration_check"',
  'development bypasses cannot last longer than seven days'
);

select * from finish();
rollback;
