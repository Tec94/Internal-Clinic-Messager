create or replace function public.authorize_message_notification(
  target_message_id uuid
)
returns table (
  organization_id uuid,
  channel_id uuid,
  author_member_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_message public.messages%rowtype;
  current_member uuid;
begin
  if not private.session_satisfies_mfa() then
    raise insufficient_privilege using
      message = 'AAL2 is required to send notifications.';
  end if;

  select message.*
  into target_message
  from public.messages as message
  where message.id = target_message_id;

  if not found then
    raise insufficient_privilege using
      message = 'The message is unavailable.';
  end if;

  current_member := private.current_member_id(
    target_message.organization_id
  );
  if current_member is null
    or current_member <> target_message.author_member_id
    or not private.has_channel_access(
      target_message.organization_id,
      target_message.channel_id,
      true
    )
  then
    raise insufficient_privilege using
      message = 'The current member cannot notify this channel.';
  end if;

  return query select
    target_message.organization_id,
    target_message.channel_id,
    target_message.author_member_id;
end;
$$;

revoke all on function public.authorize_message_notification(uuid)
  from public, anon;
grant execute on function public.authorize_message_notification(uuid)
  to authenticated, service_role;
