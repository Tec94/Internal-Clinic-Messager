create table private.development_mfa_bypasses (
  user_id uuid primary key references auth.users (id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz not null,
  constraint development_mfa_bypasses_reason_check
    check (length(trim(reason)) between 3 and 200),
  constraint development_mfa_bypasses_expiry_check
    check (expires_at > created_at),
  constraint development_mfa_bypasses_max_duration_check
    check (expires_at <= created_at + interval '7 days')
);

create table private.development_mfa_bypass_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id text not null,
  bypass_expires_at timestamptz not null,
  used_at timestamptz not null default now(),
  unique (user_id, session_id)
);

revoke all on table private.development_mfa_bypasses
  from public, anon, authenticated;
revoke all on table private.development_mfa_bypass_events
  from public, anon, authenticated;
grant select, insert, update, delete
  on table private.development_mfa_bypasses to service_role;
grant select, insert
  on table private.development_mfa_bypass_events to service_role;
grant usage, select
  on sequence private.development_mfa_bypass_events_id_seq to service_role;

create function private.session_satisfies_mfa()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and (
      coalesce((select auth.jwt()) ->> 'aal', 'aal1') = 'aal2'
      or exists (
        select 1
        from private.development_mfa_bypasses as bypass
        where bypass.user_id = (select auth.uid())
          and bypass.expires_at > now()
      )
    );
$$;

create function private.begin_development_mfa_bypass()
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  active_expires_at timestamptz;
  current_session_id text;
begin
  if (select auth.uid()) is null
    or coalesce((select auth.jwt()) ->> 'aal', 'aal1') = 'aal2'
  then
    return null;
  end if;

  select bypass.expires_at
  into active_expires_at
  from private.development_mfa_bypasses as bypass
  where bypass.user_id = (select auth.uid())
    and bypass.expires_at > now();

  if active_expires_at is null then
    return null;
  end if;

  current_session_id := coalesce(
    (select auth.jwt()) ->> 'session_id',
    'session-id-unavailable'
  );

  insert into private.development_mfa_bypass_events (
    user_id,
    session_id,
    bypass_expires_at
  )
  values (
    (select auth.uid()),
    current_session_id,
    active_expires_at
  )
  on conflict (user_id, session_id) do nothing;

  return active_expires_at;
end;
$$;

create function public.begin_development_mfa_bypass()
returns timestamptz
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.begin_development_mfa_bypass();
$$;

revoke all on function private.session_satisfies_mfa() from public;
revoke all on function private.begin_development_mfa_bypass() from public;
revoke all on function public.begin_development_mfa_bypass() from public;
grant execute on function private.session_satisfies_mfa()
  to authenticated, service_role;
grant execute on function private.begin_development_mfa_bypass()
  to authenticated, service_role;
grant execute on function public.begin_development_mfa_bypass()
  to authenticated, service_role;

do $$
declare
  target record;
begin
  for target in
    select *
    from (
      values
        ('public.organizations', 'aal2 required for organizations'),
        ('public.profiles', 'aal2 required for profiles'),
        ('public.organization_members', 'aal2 required for organization members'),
        ('public.locations', 'aal2 required for locations'),
        ('public.departments', 'aal2 required for departments'),
        ('public.assignments', 'aal2 required for assignments'),
        ('public.role_bindings', 'aal2 required for role bindings'),
        ('public.role_binding_locations', 'aal2 required for role location scopes'),
        ('public.role_binding_departments', 'aal2 required for role department scopes'),
        ('public.invitations', 'aal2 required for invitations'),
        ('public.onboarding_progress', 'aal2 required for onboarding progress'),
        ('public.channels', 'aal2 required for channels'),
        ('public.channel_locations', 'aal2 required for channel locations'),
        ('public.channel_departments', 'aal2 required for channel departments'),
        ('public.channel_memberships', 'aal2 required for channel memberships'),
        ('public.messages', 'aal2 required for messages'),
        ('public.message_receipts', 'aal2 required for message receipts'),
        ('public.audit_events', 'aal2 required for audit events'),
        ('public.attachments', 'aal2 required for attachments'),
        ('public.message_attachments', 'aal2 required for message attachments')
    ) as policies(table_name, policy_name)
  loop
    execute format(
      'alter policy %I on %s using ((select private.session_satisfies_mfa())) with check ((select private.session_satisfies_mfa()))',
      target.policy_name,
      target.table_name
    );
  end loop;
end;
$$;

alter policy "authorized senders can upload attachment quarantine"
  on storage.objects
  with check (
    bucket_id = 'operational-attachments-quarantine'
    and (select private.session_satisfies_mfa())
    and exists (
      select 1
      from public.attachments as attachment
      where attachment.object_path = name
        and attachment.status = 'uploading'
        and attachment.scan_status = 'pending'
        and attachment.archived_at is null
        and private.is_current_member(
          attachment.organization_id,
          attachment.uploader_member_id
        )
        and private.has_channel_access(
          attachment.organization_id,
          attachment.channel_id,
          true
        )
    )
  );

create or replace function private.create_attachment_upload(
  target_channel_id uuid,
  target_original_name text,
  target_mime_type text,
  target_size_bytes bigint,
  target_client_attachment_id uuid
)
returns setof public.attachments
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_organization_id uuid;
  target_uploader_member_id uuid;
  generated_attachment_id uuid;
  generated_object_path text;
  existing_attachment public.attachments%rowtype;
  created_attachment public.attachments%rowtype;
begin
  if not private.session_satisfies_mfa() then
    raise insufficient_privilege using
      message = 'An AAL2 session or active development MFA bypass is required.';
  end if;

  if target_client_attachment_id is null then
    raise invalid_parameter_value using
      message = 'client_attachment_id is required.';
  end if;

  if length(trim(target_original_name)) not between 1 and 255
    or target_original_name ~ '[[:cntrl:]]'
    or position('/' in target_original_name) > 0
    or position(chr(92) in target_original_name) > 0
  then
    raise invalid_parameter_value using
      message = 'The attachment filename is invalid.';
  end if;

  if private.attachment_extension(target_mime_type) is null
    or not private.is_attachment_filename_compatible(
      target_original_name,
      target_mime_type
    )
  then
    raise invalid_parameter_value using
      message = 'The attachment filename and MIME type are not allowed.';
  end if;

  if target_size_bytes not between 1 and 10485760 then
    raise invalid_parameter_value using
      message = 'Attachments must be between 1 byte and 10 MiB.';
  end if;

  select channel.organization_id, member.id
  into target_organization_id, target_uploader_member_id
  from public.channels as channel
  join public.organization_members as member
    on member.organization_id = channel.organization_id
    and member.user_id = (select auth.uid())
  where channel.id = target_channel_id
    and channel.type <> 'announcement'
    and private.is_current_member(channel.organization_id, member.id)
    and private.has_channel_access(
      channel.organization_id,
      channel.id,
      true
    );

  if target_organization_id is null then
    raise insufficient_privilege using
      message = 'The current member cannot upload to this channel.';
  end if;

  select attachment.*
  into existing_attachment
  from public.attachments as attachment
  where attachment.channel_id = target_channel_id
    and attachment.client_attachment_id = target_client_attachment_id;

  if found then
    if existing_attachment.organization_id <> target_organization_id
      or existing_attachment.uploader_member_id <> target_uploader_member_id
      or existing_attachment.original_name <> trim(target_original_name)
      or existing_attachment.mime_type <> target_mime_type
      or existing_attachment.size_bytes <> target_size_bytes
    then
      raise unique_violation using
        message = 'client_attachment_id already represents another upload.';
    end if;

    return next existing_attachment;
    return;
  end if;

  generated_attachment_id := gen_random_uuid();
  generated_object_path :=
    target_organization_id::text || '/' ||
    target_channel_id::text || '/' ||
    generated_attachment_id::text || '/original.' ||
    private.attachment_extension(target_mime_type);

  insert into public.attachments (
    id,
    organization_id,
    channel_id,
    uploader_member_id,
    client_attachment_id,
    original_name,
    mime_type,
    size_bytes,
    object_path
  )
  values (
    generated_attachment_id,
    target_organization_id,
    target_channel_id,
    target_uploader_member_id,
    target_client_attachment_id,
    trim(target_original_name),
    target_mime_type,
    target_size_bytes,
    generated_object_path
  )
  returning * into created_attachment;

  return next created_attachment;
end;
$$;

create or replace function private.send_message_with_attachments(
  target_organization_id uuid,
  target_channel_id uuid,
  target_author_member_id uuid,
  target_client_message_id uuid,
  target_body text,
  target_is_urgent boolean,
  target_attachment_ids uuid[] default '{}'::uuid[]
)
returns setof public.messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_attachment_ids uuid[];
  existing_attachment_ids uuid[];
  attachment_count integer;
  matched_attachment_count integer;
  existing_message public.messages%rowtype;
  created_message public.messages%rowtype;
begin
  if not private.session_satisfies_mfa() then
    raise insufficient_privilege using
      message = 'An AAL2 session or active development MFA bypass is required.';
  end if;

  if target_client_message_id is null then
    raise invalid_parameter_value using
      message = 'client_message_id is required.';
  end if;

  if length(trim(target_body)) not between 1 and 10000 then
    raise invalid_parameter_value using
      message = 'Message body must contain between 1 and 10000 characters.';
  end if;

  if not private.can_insert_message(
    target_organization_id,
    target_channel_id,
    target_author_member_id
  ) then
    raise insufficient_privilege using
      message = 'The current member cannot send to this channel.';
  end if;

  select coalesce(
    array_agg(attachment_id order by attachment_id),
    '{}'::uuid[]
  )
  into normalized_attachment_ids
  from (
    select distinct attachment_id
    from unnest(coalesce(target_attachment_ids, '{}'::uuid[]))
      as requested(attachment_id)
  ) as normalized;

  attachment_count := cardinality(
    coalesce(target_attachment_ids, '{}'::uuid[])
  );

  if attachment_count > 5 then
    raise check_violation using
      message = 'A message can contain at most five attachments.';
  end if;

  if cardinality(normalized_attachment_ids) <> attachment_count then
    raise invalid_parameter_value using
      message = 'Attachment identifiers must be unique.';
  end if;

  select message.*
  into existing_message
  from public.messages as message
  where message.channel_id = target_channel_id
    and message.client_message_id = target_client_message_id;

  if found then
    select coalesce(
      array_agg(message_attachment.attachment_id
        order by message_attachment.attachment_id),
      '{}'::uuid[]
    )
    into existing_attachment_ids
    from public.message_attachments as message_attachment
    where message_attachment.message_id = existing_message.id;

    if existing_message.organization_id <> target_organization_id
      or existing_message.author_member_id <> target_author_member_id
      or existing_message.body <> trim(target_body)
      or existing_message.is_urgent <> target_is_urgent
      or existing_attachment_ids <> normalized_attachment_ids
    then
      raise unique_violation using
        message = 'client_message_id already represents another message.';
    end if;

    return next existing_message;
    return;
  end if;

  if attachment_count > 0 then
    select count(*)
    into matched_attachment_count
    from public.attachments as attachment
    where attachment.id = any(normalized_attachment_ids)
      and attachment.organization_id = target_organization_id
      and attachment.channel_id = target_channel_id
      and attachment.uploader_member_id = target_author_member_id
      and attachment.status = 'available'
      and attachment.scan_status in ('bypassed_dev', 'clean')
      and attachment.archived_at is null;

    if matched_attachment_count <> attachment_count then
      raise insufficient_privilege using
        message = 'Every attachment must be available in this channel and owned by the sender.';
    end if;
  end if;

  insert into public.messages (
    organization_id,
    channel_id,
    author_member_id,
    client_message_id,
    body,
    is_urgent
  )
  values (
    target_organization_id,
    target_channel_id,
    target_author_member_id,
    target_client_message_id,
    trim(target_body),
    target_is_urgent
  )
  on conflict (channel_id, client_message_id) do nothing
  returning * into created_message;

  if not found then
    select message.*
    into existing_message
    from public.messages as message
    where message.channel_id = target_channel_id
      and message.client_message_id = target_client_message_id;

    select coalesce(
      array_agg(message_attachment.attachment_id
        order by message_attachment.attachment_id),
      '{}'::uuid[]
    )
    into existing_attachment_ids
    from public.message_attachments as message_attachment
    where message_attachment.message_id = existing_message.id;

    if existing_message.organization_id <> target_organization_id
      or existing_message.author_member_id <> target_author_member_id
      or existing_message.body <> trim(target_body)
      or existing_message.is_urgent <> target_is_urgent
      or existing_attachment_ids <> normalized_attachment_ids
    then
      raise unique_violation using
        message = 'client_message_id already represents another message.';
    end if;

    return next existing_message;
    return;
  end if;

  insert into public.message_attachments (
    organization_id,
    channel_id,
    message_id,
    attachment_id
  )
  select
    target_organization_id,
    target_channel_id,
    created_message.id,
    requested.attachment_id
  from unnest(normalized_attachment_ids) as requested(attachment_id);

  return next created_message;
end;
$$;
