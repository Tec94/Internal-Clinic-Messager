-- Private operational attachment metadata, authorization, and message linkage.
alter table public.messages
  add constraint messages_organization_channel_id_key
  unique (organization_id, channel_id, id);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  channel_id uuid not null,
  uploader_member_id uuid not null,
  client_attachment_id uuid not null,
  original_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  object_path text not null unique,
  status text not null default 'uploading'
    check (status in ('uploading', 'available', 'rejected', 'failed')),
  scan_status text not null default 'pending'
    check (
      scan_status in ('pending', 'bypassed_dev', 'clean', 'rejected', 'failed')
    ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (organization_id, id),
  unique (organization_id, channel_id, id),
  unique (channel_id, client_attachment_id),
  foreign key (organization_id, channel_id)
    references public.channels (organization_id, id),
  foreign key (organization_id, uploader_member_id)
    references public.organization_members (organization_id, id),
  check (length(trim(original_name)) between 1 and 255),
  check (original_name !~ '[[:cntrl:]]'),
  check (position('/' in original_name) = 0),
  check (position(chr(92) in original_name) = 0),
  check (
    mime_type in (
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/png',
      'image/jpeg'
    )
  ),
  check (size_bytes between 1 and 10485760),
  check (
    (status = 'uploading' and scan_status = 'pending')
    or
    (status = 'available' and scan_status in ('bypassed_dev', 'clean'))
    or
    (status = 'rejected' and scan_status = 'rejected')
    or
    (status = 'failed' and scan_status = 'failed')
  )
);

create table public.message_attachments (
  organization_id uuid not null references public.organizations (id),
  channel_id uuid not null,
  message_id uuid not null,
  attachment_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (message_id, attachment_id),
  foreign key (organization_id, channel_id, message_id)
    references public.messages (organization_id, channel_id, id)
    on delete cascade,
  foreign key (organization_id, channel_id, attachment_id)
    references public.attachments (organization_id, channel_id, id)
);

create index attachments_organization_uploader_member_id_idx
  on public.attachments (organization_id, uploader_member_id);
create index message_attachments_organization_channel_message_id_idx
  on public.message_attachments (organization_id, channel_id, message_id);
create index message_attachments_organization_channel_attachment_id_idx
  on public.message_attachments (organization_id, channel_id, attachment_id);

create trigger attachments_set_updated_at
  before update on public.attachments
  for each row execute function private.set_updated_at();

create function private.attachment_extension(target_mime_type text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select case target_mime_type
    when 'application/pdf' then 'pdf'
    when 'application/msword' then 'doc'
    when 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      then 'docx'
    when 'application/vnd.ms-excel' then 'xls'
    when 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      then 'xlsx'
    when 'image/png' then 'png'
    when 'image/jpeg' then 'jpg'
  end;
$$;

create function private.is_attachment_filename_compatible(
  target_original_name text,
  target_mime_type text
)
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select case target_mime_type
    when 'image/jpeg' then lower(target_original_name) ~ '\.jpe?g$'
    else lower(target_original_name) like
      '%.' || private.attachment_extension(target_mime_type)
  end;
$$;

create function private.create_attachment_upload(
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
  if (select auth.uid()) is null
    or coalesce((select auth.jwt()) ->> 'aal', '') <> 'aal2'
  then
    raise insufficient_privilege using
      message = 'An authenticated AAL2 session is required.';
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

create function public.create_attachment_upload(
  target_channel_id uuid,
  target_original_name text,
  target_mime_type text,
  target_size_bytes bigint,
  target_client_attachment_id uuid
)
returns setof public.attachments
language sql
security invoker
set search_path = ''
as $$
  select *
  from private.create_attachment_upload(
    target_channel_id,
    target_original_name,
    target_mime_type,
    target_size_bytes,
    target_client_attachment_id
  );
$$;

create function public.authorize_attachment_finalize(
  target_attachment_id uuid
)
returns setof public.attachments
language sql
stable
security invoker
set search_path = ''
as $$
  select attachment.*
  from public.attachments as attachment
  where attachment.id = target_attachment_id
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
    );
$$;

create function public.authorize_attachment_download(
  target_attachment_id uuid
)
returns setof public.attachments
language sql
stable
security invoker
set search_path = ''
as $$
  select attachment.*
  from public.attachments as attachment
  where attachment.id = target_attachment_id
    and attachment.status = 'available'
    and attachment.scan_status in ('bypassed_dev', 'clean')
    and attachment.archived_at is null
    and private.has_channel_access(
      attachment.organization_id,
      attachment.channel_id
    )
    and exists (
      select 1
      from public.message_attachments as message_attachment
      where message_attachment.organization_id = attachment.organization_id
        and message_attachment.channel_id = attachment.channel_id
        and message_attachment.attachment_id = attachment.id
    );
$$;

create function private.enforce_message_attachment_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform 1
  from public.messages as message
  where message.organization_id = new.organization_id
    and message.channel_id = new.channel_id
    and message.id = new.message_id
  for update;

  if (
    select count(*)
    from public.message_attachments as message_attachment
    where message_attachment.message_id = new.message_id
  ) >= 5
  then
    raise check_violation using
      message = 'A message can contain at most five attachments.';
  end if;

  return new;
end;
$$;

create trigger message_attachments_limit
  before insert on public.message_attachments
  for each row execute function private.enforce_message_attachment_limit();

create function private.send_message_with_attachments(
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
  if (select auth.uid()) is null
    or coalesce((select auth.jwt()) ->> 'aal', '') <> 'aal2'
  then
    raise insufficient_privilege using
      message = 'An authenticated AAL2 session is required.';
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

create function public.send_message_with_attachments(
  target_organization_id uuid,
  target_channel_id uuid,
  target_author_member_id uuid,
  target_client_message_id uuid,
  target_body text,
  target_is_urgent boolean,
  target_attachment_ids uuid[] default '{}'::uuid[]
)
returns setof public.messages
language sql
security invoker
set search_path = ''
as $$
  select *
  from private.send_message_with_attachments(
    target_organization_id,
    target_channel_id,
    target_author_member_id,
    target_client_message_id,
    target_body,
    target_is_urgent,
    target_attachment_ids
  );
$$;

revoke all on function private.attachment_extension(text) from public;
revoke all on function private.is_attachment_filename_compatible(text, text)
  from public;
revoke all on function private.create_attachment_upload(
  uuid,
  text,
  text,
  bigint,
  uuid
) from public;
revoke all on function private.enforce_message_attachment_limit()
  from public;
revoke all on function private.send_message_with_attachments(
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  boolean,
  uuid[]
) from public;

revoke all on function public.create_attachment_upload(
  uuid,
  text,
  text,
  bigint,
  uuid
) from public;
revoke all on function public.authorize_attachment_finalize(uuid) from public;
revoke all on function public.authorize_attachment_download(uuid) from public;
revoke all on function public.send_message_with_attachments(
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  boolean,
  uuid[]
) from public;

grant execute on function private.create_attachment_upload(
  uuid,
  text,
  text,
  bigint,
  uuid
) to authenticated, service_role;
grant execute on function private.send_message_with_attachments(
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  boolean,
  uuid[]
) to authenticated, service_role;

grant execute on function public.create_attachment_upload(
  uuid,
  text,
  text,
  bigint,
  uuid
) to authenticated, service_role;
grant execute on function public.authorize_attachment_finalize(uuid)
  to authenticated, service_role;
grant execute on function public.authorize_attachment_download(uuid)
  to authenticated, service_role;
grant execute on function public.send_message_with_attachments(
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  boolean,
  uuid[]
) to authenticated, service_role;

alter table public.attachments enable row level security;
alter table public.message_attachments enable row level security;

create policy "channel members can read attachments"
  on public.attachments for select
  to authenticated
  using (
    archived_at is null
    and private.has_channel_access(organization_id, channel_id)
  );

create policy "channel members can read message attachment links"
  on public.message_attachments for select
  to authenticated
  using (private.has_channel_access(organization_id, channel_id));

create policy "aal2 required for attachments"
  on public.attachments as restrictive for all
  to authenticated
  using (((select auth.jwt()) ->> 'aal') = 'aal2')
  with check (((select auth.jwt()) ->> 'aal') = 'aal2');

create policy "aal2 required for message attachments"
  on public.message_attachments as restrictive for all
  to authenticated
  using (((select auth.jwt()) ->> 'aal') = 'aal2')
  with check (((select auth.jwt()) ->> 'aal') = 'aal2');

create policy "authorized senders can upload attachment quarantine"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'operational-attachments-quarantine'
    and ((select auth.jwt()) ->> 'aal') = 'aal2'
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

revoke all on table public.attachments from anon;
revoke all on table public.message_attachments from anon;

grant select on table public.attachments to authenticated;
grant select on table public.message_attachments to authenticated;

grant all on table public.attachments to service_role;
grant all on table public.message_attachments to service_role;

create function public.complete_attachment_dev_bypass(
  target_attachment_id uuid
)
returns setof public.attachments
language plpgsql
security invoker
set search_path = ''
as $$
declare
  completed_attachment public.attachments%rowtype;
begin
  update public.attachments
  set status = 'available',
      scan_status = 'bypassed_dev'
  where id = target_attachment_id
    and status = 'uploading'
    and scan_status = 'pending'
    and archived_at is null
  returning * into completed_attachment;

  if not found then
    raise invalid_parameter_value using
      message = 'The attachment is not pending finalization.';
  end if;

  insert into public.audit_events (
    organization_id,
    actor_member_id,
    action,
    target_type,
    target_id,
    metadata
  )
  values (
    completed_attachment.organization_id,
    completed_attachment.uploader_member_id,
    'attachment.scan_bypassed_dev',
    'attachment',
    completed_attachment.id,
    jsonb_build_object(
      'scan_status',
      'bypassed_dev',
      'source_bucket',
      'operational-attachments-quarantine',
      'destination_bucket',
      'operational-attachments'
    )
  );

  return next completed_attachment;
end;
$$;

create function public.reject_attachment_upload(
  target_attachment_id uuid,
  target_reason text
)
returns setof public.attachments
language plpgsql
security invoker
set search_path = ''
as $$
declare
  rejected_attachment public.attachments%rowtype;
begin
  update public.attachments
  set status = 'rejected',
      scan_status = 'rejected'
  where id = target_attachment_id
    and status = 'uploading'
    and scan_status = 'pending'
    and archived_at is null
  returning * into rejected_attachment;

  if not found then
    raise invalid_parameter_value using
      message = 'The attachment is not pending rejection.';
  end if;

  insert into public.audit_events (
    organization_id,
    actor_member_id,
    action,
    target_type,
    target_id,
    metadata
  )
  values (
    rejected_attachment.organization_id,
    rejected_attachment.uploader_member_id,
    'attachment.rejected',
    'attachment',
    rejected_attachment.id,
    jsonb_build_object('reason', left(coalesce(target_reason, 'unknown'), 120))
  );

  return next rejected_attachment;
end;
$$;

revoke all on function public.complete_attachment_dev_bypass(uuid)
  from public;
revoke all on function public.reject_attachment_upload(uuid, text)
  from public;
grant execute on function public.complete_attachment_dev_bypass(uuid)
  to service_role;
grant execute on function public.reject_attachment_upload(uuid, text)
  to service_role;
