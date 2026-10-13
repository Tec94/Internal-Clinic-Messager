begin;

select plan(8);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('10000000-0000-0000-0000-000000000081', 'authenticated', 'authenticated', 'dm-a@example.test', '', now(), '{}', '{}', now(), now()),
  ('10000000-0000-0000-0000-000000000082', 'authenticated', 'authenticated', 'dm-b@example.test', '', now(), '{}', '{}', now(), now()),
  ('10000000-0000-0000-0000-000000000083', 'authenticated', 'authenticated', 'dm-c@example.test', '', now(), '{}', '{}', now(), now()),
  ('10000000-0000-0000-0000-000000000084', 'authenticated', 'authenticated', 'dm-other@example.test', '', now(), '{}', '{}', now(), now());

insert into public.organizations (id, name, slug)
values
  ('00000000-0000-0000-0000-000000000081', 'Direct Clinic', 'direct-clinic'),
  ('00000000-0000-0000-0000-000000000082', 'Other Direct Clinic', 'other-direct-clinic');

insert into public.organization_members (id, organization_id, user_id, starts_at)
values
  ('20000000-0000-0000-0000-000000000081', '00000000-0000-0000-0000-000000000081', '10000000-0000-0000-0000-000000000081', now() - interval '1 day'),
  ('20000000-0000-0000-0000-000000000082', '00000000-0000-0000-0000-000000000081', '10000000-0000-0000-0000-000000000082', now() - interval '1 day'),
  ('20000000-0000-0000-0000-000000000083', '00000000-0000-0000-0000-000000000081', '10000000-0000-0000-0000-000000000083', now() - interval '1 day'),
  ('20000000-0000-0000-0000-000000000084', '00000000-0000-0000-0000-000000000082', '10000000-0000-0000-0000-000000000084', now() - interval '1 day');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000081","role":"authenticated","aal":"aal1"}', true);

create temporary table first_dm on commit drop as
  select id from public.ensure_direct_channel(
    '00000000-0000-0000-0000-000000000081',
    '20000000-0000-0000-0000-000000000082'
  );

select is(
  (select count(*) from public.channel_memberships where channel_id = (select id from first_dm)),
  2::bigint,
  'a new direct message has exactly the two participants'
);

select is(
  (select id from public.ensure_direct_channel(
    '00000000-0000-0000-0000-000000000081',
    '20000000-0000-0000-0000-000000000082'
  )),
  (select id from first_dm),
  'asking again returns the same direct message'
);

select lives_ok(
  $$
    insert into public.messages (organization_id, channel_id, author_member_id, client_message_id, body)
    select '00000000-0000-0000-0000-000000000081', id, '20000000-0000-0000-0000-000000000081',
      '61000000-0000-0000-0000-000000000081', 'Hello'
    from first_dm
  $$,
  'the starter can send in the direct message'
);

select throws_ok(
  $$ select * from public.ensure_direct_channel('00000000-0000-0000-0000-000000000081', '20000000-0000-0000-0000-000000000081') $$,
  '22023',
  'The direct message participant is invalid.',
  'a member cannot start a direct message with themselves'
);

select throws_ok(
  $$ select * from public.ensure_direct_channel('00000000-0000-0000-0000-000000000081', '20000000-0000-0000-0000-000000000084') $$,
  '22023',
  'The direct message participant is invalid.',
  'a member cannot start a direct message with another organization''s member'
);

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000082","role":"authenticated","aal":"aal1"}', true);

select is(
  (select id from public.ensure_direct_channel(
    '00000000-0000-0000-0000-000000000081',
    '20000000-0000-0000-0000-000000000081'
  )),
  (select id from first_dm),
  'the other participant reaches the same direct message'
);

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000083","role":"authenticated","aal":"aal1"}', true);

select is(
  (select count(*) from public.channels where id = (select id from first_dm)),
  0::bigint,
  'a non-participant cannot see the direct message'
);

select throws_ok(
  $$
    insert into public.messages (organization_id, channel_id, author_member_id, client_message_id, body)
    select '00000000-0000-0000-0000-000000000081', id, '20000000-0000-0000-0000-000000000083',
      '61000000-0000-0000-0000-000000000083', 'Intruding'
    from first_dm
  $$,
  '42501',
  null,
  'a non-participant cannot send in the direct message'
);

reset role;

select * from finish();
rollback;
