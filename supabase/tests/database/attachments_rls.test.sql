begin;

select plan(32);

select has_table('public', 'attachments', 'attachments table exists');
select has_table(
  'public',
  'message_attachments',
  'message attachments table exists'
);
select has_function(
  'public',
  'create_attachment_upload',
  array['uuid', 'text', 'text', 'bigint', 'uuid'],
  'attachment initialization RPC exists'
);
select has_function(
  'public',
  'send_message_with_attachments',
  array['uuid', 'uuid', 'uuid', 'uuid', 'text', 'boolean', 'uuid[]'],
  'atomic message attachment RPC exists'
);
select is(
  (
    select count(*)
    from storage.buckets as bucket
    where bucket.id in (
      'operational-attachments',
      'operational-attachments-quarantine'
    )
      and bucket.public = false
      and bucket.file_size_limit = 10485760
      and (
        select array_agg(mime_type order by mime_type)
        from unnest(bucket.allowed_mime_types) as allowed(mime_type)
      ) = array[
        'application/msword',
        'application/pdf',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg',
        'image/png'
      ]::text[]
  ),
  2::bigint,
  'both private buckets use the exact 10 MiB MIME allowlist'
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
    '10000000-0000-0000-0000-000000000021',
    'authenticated',
    'authenticated',
    'attachment-sender@example.test',
    '',
    now(),
    '{}',
    '{}',
    now(),
    now()
  ),
  (
    '10000000-0000-0000-0000-000000000022',
    'authenticated',
    'authenticated',
    'attachment-viewer@example.test',
    '',
    now(),
    '{}',
    '{}',
    now(),
    now()
  ),
  (
    '10000000-0000-0000-0000-000000000023',
    'authenticated',
    'authenticated',
    'attachment-outsider@example.test',
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
    '00000000-0000-0000-0000-000000000021',
    'Attachment Clinic',
    'attachment-clinic'
  ),
  (
    '00000000-0000-0000-0000-000000000022',
    'Other Attachment Clinic',
    'other-attachment-clinic'
  );

insert into public.organization_members (
  id,
  organization_id,
  user_id,
  starts_at
)
values
  (
    '20000000-0000-0000-0000-000000000021',
    '00000000-0000-0000-0000-000000000021',
    '10000000-0000-0000-0000-000000000021',
    now() - interval '1 day'
  ),
  (
    '20000000-0000-0000-0000-000000000022',
    '00000000-0000-0000-0000-000000000021',
    '10000000-0000-0000-0000-000000000022',
    now() - interval '1 day'
  ),
  (
    '20000000-0000-0000-0000-000000000023',
    '00000000-0000-0000-0000-000000000022',
    '10000000-0000-0000-0000-000000000023',
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
    '50000000-0000-0000-0000-000000000021',
    '00000000-0000-0000-0000-000000000021',
    'attachment-operations',
    'Attachment operations',
    'Share approved operational attachments.',
    'department',
    '20000000-0000-0000-0000-000000000021'
  ),
  (
    '50000000-0000-0000-0000-000000000022',
    '00000000-0000-0000-0000-000000000022',
    'other-attachments',
    'Other attachments',
    'Share another organization attachment.',
    'department',
    '20000000-0000-0000-0000-000000000023'
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
values
  (
    '51000000-0000-0000-0000-000000000021',
    '00000000-0000-0000-0000-000000000021',
    '50000000-0000-0000-0000-000000000021',
    '20000000-0000-0000-0000-000000000021',
    'policy',
    true,
    now() - interval '1 day'
  ),
  (
    '51000000-0000-0000-0000-000000000022',
    '00000000-0000-0000-0000-000000000021',
    '50000000-0000-0000-0000-000000000021',
    '20000000-0000-0000-0000-000000000022',
    'policy',
    false,
    now() - interval '1 day'
  ),
  (
    '51000000-0000-0000-0000-000000000023',
    '00000000-0000-0000-0000-000000000022',
    '50000000-0000-0000-0000-000000000022',
    '20000000-0000-0000-0000-000000000023',
    'policy',
    true,
    now() - interval '1 day'
  );

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000021","role":"authenticated","aal":"aal2"}',
  true
);

select lives_ok(
  $$
    select public.create_attachment_upload(
      '50000000-0000-0000-0000-000000000021',
      'handoff.pdf',
      'application/pdf',
      10485760,
      '70000000-0000-0000-0000-000000000021'
    )
  $$,
  'a writable AAL2 member can initialize a 10 MiB attachment'
);
select is(
  (
    select object_path like
      '00000000-0000-0000-0000-000000000021/' ||
      '50000000-0000-0000-0000-000000000021/%/original.pdf'
    from public.attachments
  ),
  true,
  'attachment paths are opaque and derived from trusted identifiers'
);
select throws_ok(
  $$
    select public.create_attachment_upload(
      '50000000-0000-0000-0000-000000000021',
      'script.exe',
      'application/x-msdownload',
      100,
      '70000000-0000-0000-0000-000000000022'
    )
  $$,
  '22023',
  'The attachment filename and MIME type are not allowed.',
  'unsupported MIME types are rejected'
);
select throws_ok(
  $$
    select public.create_attachment_upload(
      '50000000-0000-0000-0000-000000000021',
      'large.pdf',
      'application/pdf',
      10485761,
      '70000000-0000-0000-0000-000000000023'
    )
  $$,
  '22023',
  'Attachments must be between 1 byte and 10 MiB.',
  'oversized attachments are rejected'
);
select throws_ok(
  $$
    select public.create_attachment_upload(
      '50000000-0000-0000-0000-000000000021',
      'mismatch.jpg',
      'application/pdf',
      100,
      '70000000-0000-0000-0000-000000000024'
    )
  $$,
  '22023',
  'The attachment filename and MIME type are not allowed.',
  'filename and MIME mismatches are rejected'
);
select lives_ok(
  $$
    insert into storage.objects (id, bucket_id, name, owner_id)
    select
      gen_random_uuid(),
      'operational-attachments-quarantine',
      attachment.object_path,
      '10000000-0000-0000-0000-000000000021'
    from public.attachments as attachment
  $$,
  'the authorized object path can be inserted into quarantine'
);
select is(
  (select count(*) from storage.objects),
  0::bigint,
  'quarantine objects cannot be read by authenticated clients'
);
select throws_ok(
  $$
    insert into storage.objects (id, bucket_id, name, owner_id)
    values (
      gen_random_uuid(),
      'operational-attachments-quarantine',
      'spoofed/path/original.pdf',
      '10000000-0000-0000-0000-000000000021'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "objects"',
  'an unregistered quarantine path is rejected'
);
select throws_ok(
  $$
    insert into storage.objects (id, bucket_id, name, owner_id)
    values (
      gen_random_uuid(),
      'operational-attachments',
      'spoofed/path/original.pdf',
      '10000000-0000-0000-0000-000000000021'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "objects"',
  'clients cannot write directly to the available bucket'
);
select throws_ok(
  $$
    insert into public.attachments (
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
      '00000000-0000-0000-0000-000000000021',
      '50000000-0000-0000-0000-000000000021',
      '20000000-0000-0000-0000-000000000021',
      gen_random_uuid(),
      'direct.pdf',
      'application/pdf',
      100,
      'direct/write/original.pdf'
    )
  $$,
  '42501',
  'permission denied for table attachments',
  'clients cannot bypass attachment initialization'
);
reset role;

update public.attachments
set status = 'available',
    scan_status = 'bypassed_dev';

insert into public.attachments (
  id,
  organization_id,
  channel_id,
  uploader_member_id,
  client_attachment_id,
  original_name,
  mime_type,
  size_bytes,
  object_path,
  status,
  scan_status
)
values (
  '71000000-0000-0000-0000-000000000023',
  '00000000-0000-0000-0000-000000000022',
  '50000000-0000-0000-0000-000000000022',
  '20000000-0000-0000-0000-000000000023',
  '70000000-0000-0000-0000-000000000023',
  'other.pdf',
  'application/pdf',
  100,
  '00000000-0000-0000-0000-000000000022/' ||
    '50000000-0000-0000-0000-000000000022/' ||
    '71000000-0000-0000-0000-000000000023/original.pdf',
  'available',
  'clean'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000021","role":"authenticated","aal":"aal2"}',
  true
);

select lives_ok(
  $$
    select public.send_message_with_attachments(
      '00000000-0000-0000-0000-000000000021',
      '50000000-0000-0000-0000-000000000021',
      '20000000-0000-0000-0000-000000000021',
      '61000000-0000-0000-0000-000000000021',
      'Shared the approved handoff.',
      false,
      array[(select id from public.attachments
        where organization_id =
          '00000000-0000-0000-0000-000000000021')]
    )
  $$,
  'a sender can atomically send an available attachment'
);
select is(
  (select count(*) from public.messages),
  1::bigint,
  'the atomic send creates one message'
);
select is(
  (select count(*) from public.message_attachments),
  1::bigint,
  'the atomic send creates one attachment link'
);
select lives_ok(
  $$
    select public.send_message_with_attachments(
      '00000000-0000-0000-0000-000000000021',
      '50000000-0000-0000-0000-000000000021',
      '20000000-0000-0000-0000-000000000021',
      '61000000-0000-0000-0000-000000000021',
      'Shared the approved handoff.',
      false,
      array[(select id from public.attachments
        where organization_id =
          '00000000-0000-0000-0000-000000000021')]
    )
  $$,
  'an identical send retry returns the existing message'
);
select is(
  (select count(*) from public.messages),
  1::bigint,
  'an identical retry does not duplicate the message'
);
select throws_ok(
  $$
    select public.send_message_with_attachments(
      '00000000-0000-0000-0000-000000000021',
      '50000000-0000-0000-0000-000000000021',
      '20000000-0000-0000-0000-000000000021',
      '61000000-0000-0000-0000-000000000021',
      'Changed retry body.',
      false,
      array[(select id from public.attachments
        where organization_id =
          '00000000-0000-0000-0000-000000000021')]
    )
  $$,
  '23505',
  'client_message_id already represents another message.',
  'a conflicting retry is rejected'
);
select throws_ok(
  $$
    select public.send_message_with_attachments(
      '00000000-0000-0000-0000-000000000021',
      '50000000-0000-0000-0000-000000000021',
      '20000000-0000-0000-0000-000000000021',
      '61000000-0000-0000-0000-000000000022',
      'Too many attachments.',
      false,
      array[
        '72000000-0000-0000-0000-000000000001'::uuid,
        '72000000-0000-0000-0000-000000000002'::uuid,
        '72000000-0000-0000-0000-000000000003'::uuid,
        '72000000-0000-0000-0000-000000000004'::uuid,
        '72000000-0000-0000-0000-000000000005'::uuid,
        '72000000-0000-0000-0000-000000000006'::uuid
      ]
    )
  $$,
  '23514',
  'A message can contain at most five attachments.',
  'the database rejects more than five message attachments'
);
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000022","role":"authenticated","aal":"aal2"}',
  true
);
select is(
  (select count(*) from public.attachments),
  1::bigint,
  'a view-only member can read channel attachment metadata'
);
select is(
  (
    select count(*)
    from public.authorize_attachment_finalize(
      (select id from public.attachments limit 1)
    )
  ),
  0::bigint,
  'a view-only member cannot finalize an attachment'
);
select is(
  (
    select count(*)
    from public.authorize_attachment_download(
      (select id from public.attachments limit 1)
    )
  ),
  1::bigint,
  'a view-only member can authorize a linked attachment download'
);
select throws_ok(
  $$
    select public.create_attachment_upload(
      '50000000-0000-0000-0000-000000000021',
      'viewer.pdf',
      'application/pdf',
      100,
      '70000000-0000-0000-0000-000000000025'
    )
  $$,
  '42501',
  'The current member cannot upload to this channel.',
  'a view-only member cannot initialize uploads'
);
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000021","role":"authenticated","aal":"aal1"}',
  true
);
select is(
  (select count(*) from public.attachments),
  0::bigint,
  'AAL1 sessions cannot read attachment metadata'
);
select is(
  (
    select count(*)
    from public.authorize_attachment_download(
      '71000000-0000-0000-0000-000000000023'
    )
  ),
  0::bigint,
  'AAL1 sessions cannot authorize downloads'
);
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000023","role":"authenticated","aal":"aal2"}',
  true
);
select is(
  (select count(*) from public.attachments),
  1::bigint,
  'an outsider sees only attachments in their own organization'
);
select is(
  (
    select count(*)
    from public.authorize_attachment_download(
      (select id from public.attachments
        where organization_id =
          '00000000-0000-0000-0000-000000000022')
    )
  ),
  0::bigint,
  'an unlinked attachment cannot be downloaded'
);
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000021","role":"authenticated","aal":"aal2"}',
  true
);
select throws_ok(
  $$
    select public.send_message_with_attachments(
      '00000000-0000-0000-0000-000000000021',
      '50000000-0000-0000-0000-000000000021',
      '20000000-0000-0000-0000-000000000021',
      '61000000-0000-0000-0000-000000000023',
      'Cross-organization attachment.',
      false,
      array['71000000-0000-0000-0000-000000000023'::uuid]
    )
  $$,
  '42501',
  'Every attachment must be available in this channel and owned by the sender.',
  'cross-organization attachments cannot be linked'
);
select throws_ok(
  $$
    update public.attachments
    set status = 'failed',
        scan_status = 'failed'
  $$,
  '42501',
  'permission denied for table attachments',
  'clients cannot mutate attachment status'
);
reset role;

select * from finish();
rollback;
