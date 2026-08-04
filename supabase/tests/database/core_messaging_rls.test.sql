begin;

select plan(20);

select has_table('public', 'channels', 'channels table exists');
select has_table('public', 'messages', 'messages table exists');
select has_table('public', 'audit_events', 'audit events table exists');
select results_eq(
  $$
    select tablename
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  $$,
  array['messages'::name],
  'messages are published to Supabase Realtime'
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
    '10000000-0000-0000-0000-000000000011',
    'authenticated',
    'authenticated',
    'sender@example.test',
    '',
    now(),
    '{}',
    '{}',
    now(),
    now()
  ),
  (
    '10000000-0000-0000-0000-000000000012',
    'authenticated',
    'authenticated',
    'viewer@example.test',
    '',
    now(),
    '{}',
    '{}',
    now(),
    now()
  ),
  (
    '10000000-0000-0000-0000-000000000013',
    'authenticated',
    'authenticated',
    'other-org@example.test',
    '',
    now(),
    '{}',
    '{}',
    now(),
    now()
  ),
  (
    '10000000-0000-0000-0000-000000000014',
    'authenticated',
    'authenticated',
    'owner@example.test',
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
    '00000000-0000-0000-0000-000000000011',
    'Messaging Clinic',
    'messaging-clinic'
  ),
  (
    '00000000-0000-0000-0000-000000000012',
    'Other Messaging Clinic',
    'other-messaging-clinic'
  );

insert into public.organization_members (
  id,
  organization_id,
  user_id,
  starts_at
)
values
  (
    '20000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000011',
    '10000000-0000-0000-0000-000000000011',
    now() - interval '1 day'
  ),
  (
    '20000000-0000-0000-0000-000000000012',
    '00000000-0000-0000-0000-000000000011',
    '10000000-0000-0000-0000-000000000012',
    now() - interval '1 day'
  ),
  (
    '20000000-0000-0000-0000-000000000013',
    '00000000-0000-0000-0000-000000000012',
    '10000000-0000-0000-0000-000000000013',
    now() - interval '1 day'
  ),
  (
    '20000000-0000-0000-0000-000000000014',
    '00000000-0000-0000-0000-000000000011',
    '10000000-0000-0000-0000-000000000014',
    now() - interval '1 day'
  );

insert into public.role_bindings (
  id,
  organization_id,
  member_id,
  role,
  starts_at
)
values (
  '40000000-0000-0000-0000-000000000014',
  '00000000-0000-0000-0000-000000000011',
  '20000000-0000-0000-0000-000000000014',
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
values
  (
    '50000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000011',
    'operations-chat',
    'Operations chat',
    'Coordinate routine clinic operations.',
    'department',
    '20000000-0000-0000-0000-000000000011'
  ),
  (
    '50000000-0000-0000-0000-000000000012',
    '00000000-0000-0000-0000-000000000011',
    'clinic-announcements',
    'Clinic announcements',
    'Publish reviewed organization notices.',
    'announcement',
    '20000000-0000-0000-0000-000000000014'
  ),
  (
    '50000000-0000-0000-0000-000000000013',
    '00000000-0000-0000-0000-000000000011',
    'expired-project',
    'Expired project',
    'Verify that expired channel access is denied.',
    'project',
    '20000000-0000-0000-0000-000000000011'
  ),
  (
    '50000000-0000-0000-0000-000000000014',
    '00000000-0000-0000-0000-000000000012',
    'other-operations',
    'Other operations',
    'Coordinate operations in the other organization.',
    'department',
    '20000000-0000-0000-0000-000000000013'
  );

insert into public.channel_memberships (
  id,
  organization_id,
  channel_id,
  member_id,
  source,
  can_send,
  starts_at,
  expires_at
)
values
  (
    '51000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000011',
    '50000000-0000-0000-0000-000000000011',
    '20000000-0000-0000-0000-000000000011',
    'policy',
    true,
    now() - interval '1 day',
    null
  ),
  (
    '51000000-0000-0000-0000-000000000012',
    '00000000-0000-0000-0000-000000000011',
    '50000000-0000-0000-0000-000000000011',
    '20000000-0000-0000-0000-000000000012',
    'policy',
    false,
    now() - interval '1 day',
    null
  ),
  (
    '51000000-0000-0000-0000-000000000013',
    '00000000-0000-0000-0000-000000000011',
    '50000000-0000-0000-0000-000000000012',
    '20000000-0000-0000-0000-000000000011',
    'policy',
    true,
    now() - interval '1 day',
    null
  ),
  (
    '51000000-0000-0000-0000-000000000014',
    '00000000-0000-0000-0000-000000000011',
    '50000000-0000-0000-0000-000000000013',
    '20000000-0000-0000-0000-000000000011',
    'invitation',
    true,
    now() - interval '2 days',
    now() - interval '1 day'
  );

select throws_ok(
  $$
    insert into public.channel_memberships (
      organization_id,
      channel_id,
      member_id,
      source
    )
    values (
      '00000000-0000-0000-0000-000000000011',
      '50000000-0000-0000-0000-000000000011',
      '20000000-0000-0000-0000-000000000013',
      'invitation'
    )
  $$,
  '23503',
  'insert or update on table "channel_memberships" violates foreign key constraint "channel_memberships_organization_id_member_id_fkey"',
  'channel memberships reject cross-organization members'
);

insert into public.audit_events (
  organization_id,
  actor_member_id,
  action,
  target_type
)
values (
  '00000000-0000-0000-0000-000000000011',
  '20000000-0000-0000-0000-000000000014',
  'channel.created',
  'channel'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000011","role":"authenticated","aal":"aal2"}',
  true
);
select is(
  (select count(*) from public.channels),
  2::bigint,
  'a member sees only current joined channels'
);
select lives_ok(
  $$
    insert into public.messages (
      id,
      organization_id,
      channel_id,
      author_member_id,
      client_message_id,
      body
    )
    values (
      '60000000-0000-0000-0000-000000000011',
      '00000000-0000-0000-0000-000000000011',
      '50000000-0000-0000-0000-000000000011',
      '20000000-0000-0000-0000-000000000011',
      '61000000-0000-0000-0000-000000000011',
      'Routine operational update'
    )
  $$,
  'a writable member can send a message as themselves'
);
select is(
  (select count(*) from public.messages),
  1::bigint,
  'a channel member can read channel messages'
);
select throws_ok(
  $$
    insert into public.messages (
      organization_id,
      channel_id,
      author_member_id,
      client_message_id,
      body
    )
    values (
      '00000000-0000-0000-0000-000000000011',
      '50000000-0000-0000-0000-000000000011',
      '20000000-0000-0000-0000-000000000012',
      '61000000-0000-0000-0000-000000000012',
      'Spoofed author'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "messages"',
  'a sender cannot spoof another channel member'
);
select throws_ok(
  $$
    insert into public.messages (
      organization_id,
      channel_id,
      author_member_id,
      client_message_id,
      body
    )
    values (
      '00000000-0000-0000-0000-000000000011',
      '50000000-0000-0000-0000-000000000011',
      '20000000-0000-0000-0000-000000000011',
      '61000000-0000-0000-0000-000000000011',
      'Duplicate retry'
    )
  $$,
  '23505',
  'duplicate key value violates unique constraint "messages_channel_id_client_message_id_key"',
  'client message identifiers prevent duplicate sends'
);
select throws_ok(
  $$
    insert into public.messages (
      organization_id,
      channel_id,
      author_member_id,
      client_message_id,
      body
    )
    values (
      '00000000-0000-0000-0000-000000000011',
      '50000000-0000-0000-0000-000000000012',
      '20000000-0000-0000-0000-000000000011',
      '61000000-0000-0000-0000-000000000013',
      'Unreviewed announcement'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "messages"',
  'announcement messages require a future trusted publishing workflow'
);
select is(
  (
    select count(*)
    from public.channels
    where id = '50000000-0000-0000-0000-000000000013'
  ),
  0::bigint,
  'an expired channel membership does not grant access'
);
select lives_ok(
  $$
    insert into public.message_receipts (
      organization_id,
      message_id,
      member_id
    )
    values (
      '00000000-0000-0000-0000-000000000011',
      '60000000-0000-0000-0000-000000000011',
      '20000000-0000-0000-0000-000000000011'
    )
  $$,
  'a member can create their own delivery receipt'
);
select lives_ok(
  $$
    update public.message_receipts
    set status = 'read',
        read_at = now()
    where message_id = '60000000-0000-0000-0000-000000000011'
      and member_id = '20000000-0000-0000-0000-000000000011'
  $$,
  'a member can mark their own receipt as read'
);
select is(
  (select count(*) from public.audit_events),
  0::bigint,
  'ordinary staff cannot read audit events'
);
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000011","role":"authenticated","aal":"aal1"}',
  true
);
select is(
  (select count(*) from public.channels),
  2::bigint,
  'an active AAL1 member can read joined channels'
);
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000012","role":"authenticated","aal":"aal2"}',
  true
);
select is(
  (select count(*) from public.messages),
  1::bigint,
  'a view-only member can read channel messages'
);
select throws_ok(
  $$
    insert into public.messages (
      organization_id,
      channel_id,
      author_member_id,
      client_message_id,
      body
    )
    values (
      '00000000-0000-0000-0000-000000000011',
      '50000000-0000-0000-0000-000000000011',
      '20000000-0000-0000-0000-000000000012',
      '61000000-0000-0000-0000-000000000014',
      'View-only send attempt'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "messages"',
  'a view-only member cannot send messages'
);
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000013","role":"authenticated","aal":"aal2"}',
  true
);
select is(
  (select count(*) from public.channels),
  0::bigint,
  'a member of another organization cannot read channels'
);
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000014","role":"authenticated","aal":"aal2"}',
  true
);
select is(
  (select count(*) from public.audit_events),
  1::bigint,
  'an organization owner can read organization audit events'
);
reset role;

select * from finish();
rollback;
