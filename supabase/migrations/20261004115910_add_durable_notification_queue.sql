create table private.notification_jobs (
  message_id uuid primary key references public.messages(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table private.notification_deliveries (
  message_id uuid not null references private.notification_jobs(message_id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'delivered', 'cancelled')),
  next_attempt_at timestamptz not null default now(),
  attempts bigint not null default 0,
  lease_token uuid,
  lease_expires_at timestamptz,
  finished_at timestamptz,
  last_result text,
  primary key (message_id, subscription_id)
);

create index notification_deliveries_due_idx
  on private.notification_deliveries (next_attempt_at, message_id, subscription_id)
  where status = 'pending';
create index notification_deliveries_subscription_idx
  on private.notification_deliveries (subscription_id);

alter table private.notification_jobs enable row level security;
alter table private.notification_deliveries enable row level security;
revoke all on private.notification_jobs, private.notification_deliveries
  from public, anon, authenticated;
grant all on private.notification_jobs, private.notification_deliveries to service_role;

create function private.notification_subscription_is_eligible(
  target_message_id uuid, target_subscription_id uuid
)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.messages as message
    join public.channels as channel
      on channel.id = message.channel_id and channel.organization_id = message.organization_id
    join public.push_subscriptions as subscription
      on subscription.organization_id = message.organization_id
    join public.organization_members as member
      on member.id = subscription.member_id and member.organization_id = message.organization_id
    join public.account_preferences as preference
      on preference.member_id = member.id and preference.organization_id = message.organization_id
    where message.id = target_message_id
      and subscription.id = target_subscription_id
      and subscription.revoked_at is null
      and member.id <> message.author_member_id
      and member.status = 'active' and member.archived_at is null
      and member.starts_at <= now() and (member.expires_at is null or member.expires_at > now())
      and channel.archived_at is null and (channel.archive_at is null or channel.archive_at > now())
      and preference.notifications_enabled
      and exists (
        select 1 from public.channel_memberships as membership
        where membership.organization_id = message.organization_id
          and membership.channel_id = message.channel_id and membership.member_id = member.id
          and membership.archived_at is null and membership.starts_at <= now()
          and (membership.expires_at is null or membership.expires_at > now())
      )
  );
$$;

create function public.enqueue_message_notification(target_message_id uuid)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare queued integer;
begin
  insert into private.notification_jobs(message_id) values (target_message_id)
  on conflict (message_id) do nothing;
  if not found then return 0; end if;

  insert into private.notification_deliveries(message_id, subscription_id)
  select target_message_id, subscription.id
  from public.push_subscriptions as subscription
  join public.messages as message
    on message.id = target_message_id and message.organization_id = subscription.organization_id
  where private.notification_subscription_is_eligible(target_message_id, subscription.id);
  get diagnostics queued = row_count;
  return queued;
end;
$$;

create function public.claim_notification_delivery(target_lease_seconds integer, target_due_before timestamptz)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  delivery private.notification_deliveries%rowtype;
  result jsonb;
begin
  if target_lease_seconds is null or target_lease_seconds <= 0 or target_due_before is null then
    raise invalid_parameter_value using message = 'A positive delivery lease is required.';
  end if;
  loop
    -- One row is one leased delivery; concurrent workers skip its row lock.
    select pending.* into delivery
    from private.notification_deliveries as pending
    where pending.status = 'pending' and pending.next_attempt_at <= least(now(), target_due_before)
      and (pending.lease_expires_at is null or pending.lease_expires_at <= now())
    order by pending.next_attempt_at, pending.message_id, pending.subscription_id
    limit 1 for update skip locked;
    if not found then return null; end if;

    if not private.notification_subscription_is_eligible(delivery.message_id, delivery.subscription_id) then
      update private.notification_deliveries
      set status = 'cancelled', finished_at = now(), last_result = 'ineligible',
        lease_token = null, lease_expires_at = null
      where message_id = delivery.message_id and subscription_id = delivery.subscription_id;
      continue;
    end if;

    update private.notification_deliveries
    set lease_token = gen_random_uuid(), lease_expires_at = now() + make_interval(secs => target_lease_seconds),
      attempts = attempts + 1
    where message_id = delivery.message_id and subscription_id = delivery.subscription_id
    returning * into delivery;

    select jsonb_build_object(
      'message_id', delivery.message_id, 'subscription_id', delivery.subscription_id,
      'lease_token', delivery.lease_token, 'lease_expires_at', delivery.lease_expires_at,
      'channel_id', message.channel_id, 'endpoint', subscription.endpoint,
      'p256dh', subscription.p256dh, 'auth_secret', subscription.auth_secret,
      'locale', preference.locale, 'quiet_hours_start', preference.quiet_hours_start,
      'quiet_hours_end', preference.quiet_hours_end, 'timezone', preference.timezone
    ) into result
    from public.messages as message
    join public.push_subscriptions as subscription on subscription.id = delivery.subscription_id
    join public.account_preferences as preference on preference.member_id = subscription.member_id
    where message.id = delivery.message_id;
    return result;
  end loop;
end;
$$;

create function public.finish_notification_delivery(
  target_message_id uuid, target_subscription_id uuid, target_lease_token uuid,
  target_outcome text, target_retry_seconds integer, target_result text
)
returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  if target_outcome is null or target_outcome not in ('delivered', 'retry', 'cancelled', 'revoked') then
    raise invalid_parameter_value using message = 'Invalid notification outcome.';
  end if;
  if target_outcome = 'retry' and (target_retry_seconds is null or target_retry_seconds <= 0) then
    raise invalid_parameter_value using message = 'A positive retry interval is required.';
  end if;

  update private.notification_deliveries
  set status = case when target_outcome = 'retry' then 'pending'
      when target_outcome = 'delivered' then 'delivered' else 'cancelled' end,
    next_attempt_at = case when target_outcome = 'retry'
      then now() + make_interval(secs => target_retry_seconds) else next_attempt_at end,
    finished_at = case when target_outcome = 'retry' then null else now() end,
    lease_token = null, lease_expires_at = null, last_result = target_result
  where message_id = target_message_id and subscription_id = target_subscription_id
    and status = 'pending' and lease_token = target_lease_token
    and lease_expires_at > now();
  if not found then return false; end if;

  if target_outcome = 'revoked' then
    update public.push_subscriptions set revoked_at = now() where id = target_subscription_id;
  end if;
  return true;
end;
$$;

revoke all on function private.notification_subscription_is_eligible(uuid, uuid) from public, anon, authenticated;
revoke all on function public.enqueue_message_notification(uuid) from public, anon, authenticated;
revoke all on function public.claim_notification_delivery(integer, timestamptz) from public, anon, authenticated;
revoke all on function public.finish_notification_delivery(uuid, uuid, uuid, text, integer, text)
  from public, anon, authenticated;
grant execute on function private.notification_subscription_is_eligible(uuid, uuid) to service_role;
grant execute on function public.enqueue_message_notification(uuid) to service_role;
grant execute on function public.claim_notification_delivery(integer, timestamptz) to service_role;
grant execute on function public.finish_notification_delivery(uuid, uuid, uuid, text, integer, text) to service_role;

-- Only the public browser-send wrapper enqueues; task/meeting helpers call private directly.
create or replace function public.send_message_with_attachments(
  target_organization_id uuid,
  target_channel_id uuid,
  target_author_member_id uuid,
  target_client_message_id uuid,
  target_body text,
  target_is_urgent boolean,
  target_attachment_ids uuid[] default '{}'::uuid[]
)
returns setof public.messages
language plpgsql security definer set search_path = ''
as $$
declare sent_message public.messages%rowtype;
begin
  for sent_message in
    select * from private.send_message_with_attachments(
      target_organization_id, target_channel_id, target_author_member_id,
      target_client_message_id, target_body, target_is_urgent, target_attachment_ids
    )
  loop
    perform public.enqueue_message_notification(sent_message.id);
    return next sent_message;
  end loop;
end;
$$;

revoke all on function public.send_message_with_attachments(uuid, uuid, uuid, uuid, text, boolean, uuid[])
  from public, anon;
grant execute on function public.send_message_with_attachments(uuid, uuid, uuid, uuid, text, boolean, uuid[])
  to authenticated, service_role;
