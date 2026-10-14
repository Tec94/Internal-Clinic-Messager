-- A Direct message is a 'direct' Channel whose only memberships are its two
-- participants. The name is derived from the sorted member pair, so the
-- active-name unique index makes find-or-create idempotent.
create function public.ensure_direct_channel(
  target_organization_id uuid,
  target_member_id uuid
)
returns setof public.channels
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_member_id uuid;
  pair_name text;
  direct_channel public.channels%rowtype;
begin
  current_member_id := private.current_member_id(target_organization_id);
  if not private.session_satisfies_mfa() or current_member_id is null then
    raise insufficient_privilege using
      message = 'The current member cannot start a direct message.';
  end if;

  if target_member_id is null
    or target_member_id = current_member_id
    or not exists (
      select 1
      from public.organization_members as member
      where member.organization_id = target_organization_id
        and member.id = target_member_id
        and member.status = 'active'
        and member.archived_at is null
        and member.starts_at <= now()
        and (member.expires_at is null or member.expires_at > now())
    )
  then
    raise invalid_parameter_value using
      message = 'The direct message participant is invalid.';
  end if;

  pair_name := 'dm-' || md5(
    least(current_member_id, target_member_id)::text
    || ':'
    || greatest(current_member_id, target_member_id)::text
  );

  -- Serialize concurrent first messages between the same pair.
  perform pg_advisory_xact_lock(hashtextextended(pair_name, 0));

  select channel.* into direct_channel
  from public.channels as channel
  where channel.organization_id = target_organization_id
    and lower(channel.name) = pair_name
    and channel.type = 'direct'
    and channel.archived_at is null;

  if found then
    return next direct_channel;
    return;
  end if;

  insert into public.channels (
    organization_id,
    name,
    display_name,
    purpose,
    type,
    visibility,
    owner_member_id
  )
  values (
    target_organization_id,
    pair_name,
    'Direct message',
    'Direct message between two members.',
    'direct',
    'private',
    current_member_id
  )
  returning * into direct_channel;

  insert into public.channel_memberships (
    organization_id,
    channel_id,
    member_id,
    source,
    can_send
  )
  values
    (target_organization_id, direct_channel.id, current_member_id, 'invitation', true),
    (target_organization_id, direct_channel.id, target_member_id, 'invitation', true);

  insert into public.audit_events (
    organization_id,
    actor_member_id,
    action,
    target_type,
    target_id,
    metadata
  )
  values (
    target_organization_id,
    current_member_id,
    'channel.created',
    'channel',
    direct_channel.id,
    jsonb_build_object('type', 'direct', 'visibility', 'private')
  );

  return next direct_channel;
end;
$$;

revoke all on function public.ensure_direct_channel(uuid, uuid) from public;
grant execute on function public.ensure_direct_channel(uuid, uuid)
  to authenticated, service_role;
