begin;
select no_plan();

-- Durations here are test fixtures, not deployment defaults or recommended policy.
create temporary table notification_fixture as select
  gen_random_uuid() as org, gen_random_uuid() as other_org, gen_random_uuid() as channel,
  gen_random_uuid() as author_user, gen_random_uuid() as recipient_user, gen_random_uuid() as outsider_user,
  gen_random_uuid() as author, gen_random_uuid() as recipient, gen_random_uuid() as outsider,
  gen_random_uuid() as author_subscription, gen_random_uuid() as subscription, gen_random_uuid() as outsider_subscription,
  gen_random_uuid() as message, gen_random_uuid() as second_message, gen_random_uuid() as third_message;

insert into auth.users(id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data)
select author_user, 'authenticated', 'authenticated', 'queue-author@example.test', '', '{}', '{}' from notification_fixture
union all select recipient_user, 'authenticated', 'authenticated', 'queue-recipient@example.test', '', '{}', '{}' from notification_fixture
union all select outsider_user, 'authenticated', 'authenticated', 'queue-outsider@example.test', '', '{}', '{}' from notification_fixture;
insert into public.organizations(id, name, slug)
select org, 'Queue clinic', 'queue-clinic' from notification_fixture
union all select other_org, 'Other queue clinic', 'other-queue-clinic' from notification_fixture;
insert into public.organization_members(id, organization_id, user_id, starts_at)
select author, org, author_user, now() - interval '1 day' from notification_fixture
union all select recipient, org, recipient_user, now() - interval '1 day' from notification_fixture
union all select outsider, other_org, outsider_user, now() - interval '1 day' from notification_fixture;
insert into public.channels(id, organization_id, name, display_name, purpose, type, owner_member_id)
select channel, org, 'notification-queue-tests', 'Queue tests', 'Exercise notification delivery authorization.', 'department', author
from notification_fixture;
insert into public.channel_memberships(organization_id, channel_id, member_id, source, starts_at)
select org, channel, author, 'policy', now() - interval '1 day' from notification_fixture
union all select org, channel, recipient, 'policy', now() - interval '1 day' from notification_fixture;
insert into public.account_preferences(organization_id, member_id, notifications_enabled)
select org, author, true from notification_fixture
union all select org, recipient, true from notification_fixture
union all select other_org, outsider, true from notification_fixture;
insert into public.push_subscriptions(id, organization_id, member_id, device_id, endpoint, p256dh, auth_secret)
select author_subscription, org, author, gen_random_uuid(), 'https://push.example.test/author', 'test', 'test' from notification_fixture
union all select subscription, org, recipient, gen_random_uuid(), 'https://push.example.test/recipient', 'test', 'test' from notification_fixture
union all select outsider_subscription, other_org, outsider, gen_random_uuid(), 'https://push.example.test/outsider', 'test', 'test' from notification_fixture;
insert into public.messages(id, organization_id, channel_id, author_member_id, client_message_id, body)
select message, org, channel, author, gen_random_uuid(), 'First queue test message' from notification_fixture
union all select second_message, org, channel, author, gen_random_uuid(), 'Second queue test message' from notification_fixture
union all select third_message, org, channel, author, gen_random_uuid(), 'Third queue test message' from notification_fixture;

select ok(not has_function_privilege('anon', 'public.enqueue_message_notification(uuid)', 'EXECUTE'), 'anonymous callers cannot enqueue');
select ok(not has_function_privilege('authenticated', 'public.enqueue_message_notification(uuid)', 'EXECUTE'), 'members cannot bypass edge enqueue authorization');
select ok(not has_function_privilege('authenticated', 'public.claim_notification_delivery(integer,timestamp with time zone)', 'EXECUTE'), 'members cannot claim provider credentials');
select ok(not has_function_privilege('authenticated', 'public.finish_notification_delivery(uuid,uuid,uuid,text,integer,text)', 'EXECUTE'), 'members cannot acknowledge deliveries');
select ok(has_function_privilege('service_role', 'public.claim_notification_delivery(integer,timestamp with time zone)', 'EXECUTE'), 'service worker can claim deliveries');
select ok(not has_table_privilege('authenticated', 'private.notification_deliveries', 'SELECT'), 'members cannot read the queue');
select ok(not private.notification_subscription_is_eligible(message, author_subscription), 'author does not receive own notification') from notification_fixture;
select ok(not private.notification_subscription_is_eligible(message, outsider_subscription), 'another organization cannot receive notification') from notification_fixture;
select ok(private.notification_subscription_is_eligible(message, subscription), 'current channel recipient is eligible') from notification_fixture;

update public.channel_memberships set starts_at = now() + interval '1 day'
where member_id = (select recipient from notification_fixture);
select ok(not private.notification_subscription_is_eligible(message, subscription), 'future channel membership is ineligible') from notification_fixture;
update public.channel_memberships set starts_at = now() - interval '1 day'
where member_id = (select recipient from notification_fixture);
update public.organization_members set archived_at = now() where id = (select recipient from notification_fixture);
select ok(not private.notification_subscription_is_eligible(message, subscription), 'archived active member is ineligible') from notification_fixture;
update public.organization_members set archived_at = null where id = (select recipient from notification_fixture);

select is(public.enqueue_message_notification(message), 1, 'enqueue snapshots one eligible subscription') from notification_fixture;
select is(public.enqueue_message_notification(message), 0, 'same message enqueue is idempotent') from notification_fixture;
select is((select count(*) from private.notification_deliveries), 1::bigint, 'replay creates no duplicate deliveries');
select is(public.claim_notification_delivery(30, now() - interval '1 second'), null::jsonb, 'invocation cutoff excludes later arrivals even when due now');

create temporary table first_claim as select public.claim_notification_delivery(30, now()) as claim;
select ok((claim ->> 'subscription_id')::uuid = (select subscription from notification_fixture), 'claim returns only eligible subscription') from first_claim;
select is(public.claim_notification_delivery(30, now()), null::jsonb, 'active lease cannot be claimed twice');
update private.notification_deliveries set lease_expires_at = now() - interval '1 second';
create temporary table recovered_claim as select public.claim_notification_delivery(30, now()) as claim;
select ok((select claim ->> 'lease_token' from first_claim) <> (select claim ->> 'lease_token' from recovered_claim), 'crashed lease is recovered with a fresh fencing token');
select ok(not public.finish_notification_delivery(
  (claim ->> 'message_id')::uuid, (claim ->> 'subscription_id')::uuid,
  (claim ->> 'lease_token')::uuid, 'delivered', null, 'delivered'
), 'stale worker cannot acknowledge recovered delivery') from first_claim;
select ok(public.finish_notification_delivery(
  (claim ->> 'message_id')::uuid, (claim ->> 'subscription_id')::uuid,
  (claim ->> 'lease_token')::uuid, 'retry', 60, 'provider_429'
), 'transient failure durably schedules retry') from recovered_claim;
select is(public.claim_notification_delivery(30, now()), null::jsonb, 'retry is not eligible before its scheduled time');
update private.notification_deliveries set next_attempt_at = now() - interval '1 second';
create temporary table retried_claim as select public.claim_notification_delivery(30, now()) as claim;
select ok(public.finish_notification_delivery(
  (claim ->> 'message_id')::uuid, (claim ->> 'subscription_id')::uuid,
  (claim ->> 'lease_token')::uuid, 'delivered', null, 'delivered'
), 'retried delivery can complete') from retried_claim;
select is(public.claim_notification_delivery(30, now()), null::jsonb, 'delivered subscription is not sent again');
select is(public.enqueue_message_notification(message), 0, 'completed message replay stays idempotent') from notification_fixture;

select is(public.enqueue_message_notification(second_message), 1, 'distinct message queues independently') from notification_fixture;
create temporary table revoked_claim as select public.claim_notification_delivery(30, now()) as claim;
select ok(public.finish_notification_delivery(
  (claim ->> 'message_id')::uuid, (claim ->> 'subscription_id')::uuid,
  (claim ->> 'lease_token')::uuid, 'revoked', null, 'provider_410'
), 'provider expiry durably cancels delivery') from revoked_claim;
select ok(revoked_at is not null, 'provider expiry revokes subscription')
from public.push_subscriptions where id = (select subscription from notification_fixture);
update public.push_subscriptions set revoked_at = null where id = (select subscription from notification_fixture);
select is(public.enqueue_message_notification(third_message), 1, 'new message queues after subscription restoration') from notification_fixture;
update public.channel_memberships set archived_at = now() where member_id = (select recipient from notification_fixture);
select is(public.claim_notification_delivery(30, now()), null::jsonb, 'worker rechecks access revoked after enqueue');
select is(status, 'cancelled', 'lost recipient access cancels pending delivery')
from private.notification_deliveries where message_id = (select third_message from notification_fixture);

-- Public browser sends enqueue atomically; internal private callers keep their existing behavior.
alter table notification_fixture add column send_client uuid default gen_random_uuid();
alter table notification_fixture add column failed_client uuid default gen_random_uuid();
alter table notification_fixture add column internal_client uuid default gen_random_uuid();
grant select on notification_fixture to authenticated;
update public.channel_memberships set archived_at = null where member_id = (select recipient from notification_fixture);
select ok(not has_function_privilege('anon', 'public.send_message_with_attachments(uuid,uuid,uuid,uuid,text,boolean,uuid[])', 'EXECUTE'), 'anonymous callers cannot use privileged send wrapper');
select set_config('request.jwt.claims', jsonb_build_object('sub', author_user, 'role', 'authenticated', 'aal', 'aal1')::text, true)
from notification_fixture;
set local role authenticated;
select lives_ok($$
  select public.send_message_with_attachments(org, channel, author, send_client, 'Atomic browser send', false, '{}'::uuid[])
  from notification_fixture
$$, 'authenticated public send retains private helper authorization');
select lives_ok($$
  select public.send_message_with_attachments(org, channel, author, send_client, 'Atomic browser send', false, '{}'::uuid[])
  from notification_fixture
$$, 'public send retry preserves message idempotency');
reset role;
select is((select count(*) from public.messages where client_message_id = (select send_client from notification_fixture)), 1::bigint, 'public send retry creates one message');
select is((
  select count(*) from private.notification_jobs as job join public.messages as message on message.id = job.message_id
  where message.client_message_id = (select send_client from notification_fixture)
), 1::bigint, 'public send creates one durable job in the same transaction');
select is((
  select count(*) from private.notification_deliveries as delivery join public.messages as message on message.id = delivery.message_id
  where message.client_message_id = (select send_client from notification_fixture)
), 1::bigint, 'public send snapshots recipients once');

select set_config('request.jwt.claims', jsonb_build_object('sub', recipient_user, 'role', 'authenticated', 'aal', 'aal1')::text, true)
from notification_fixture;
set local role authenticated;
select throws_ok($$
  select public.send_message_with_attachments(org, channel, author, failed_client, 'Forged author', false, '{}'::uuid[])
  from notification_fixture
$$, '42501', 'The current member cannot send to this channel.', 'definer wrapper cannot bypass author checks');
reset role;
select set_config('request.jwt.claims', jsonb_build_object('sub', author_user, 'role', 'authenticated', 'aal', 'aal1')::text, true)
from notification_fixture;

create function pg_temp.reject_notification_enqueue() returns trigger language plpgsql as $$
begin raise exception 'queue test failure'; end;
$$;
create trigger notification_queue_test_failure before insert on private.notification_jobs
  for each row execute function pg_temp.reject_notification_enqueue();
select throws_ok($$
  select public.send_message_with_attachments(org, channel, author, failed_client, 'Must roll back', false, '{}'::uuid[])
  from notification_fixture
$$, 'P0001', 'queue test failure', 'enqueue failure rejects the entire send transaction');
select is((select count(*) from public.messages where client_message_id = (select failed_client from notification_fixture)), 0::bigint, 'enqueue failure leaves no committed message');
drop trigger notification_queue_test_failure on private.notification_jobs;

select lives_ok($$
  select private.send_message_with_attachments(org, channel, author, internal_client, 'Internal helper send', false, '{}'::uuid[])
  from notification_fixture
$$, 'internal private helper still works independently');
select is((
  select count(*) from private.notification_jobs as job join public.messages as message on message.id = job.message_id
  where message.client_message_id = (select internal_client from notification_fixture)
), 0::bigint, 'internal helper does not start sending new notifications');

select * from finish();
rollback;
