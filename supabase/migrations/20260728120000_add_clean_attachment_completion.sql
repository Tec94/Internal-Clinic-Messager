create function public.complete_attachment_clean(
  target_attachment_id uuid,
  target_scanner text,
  target_signature text
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
      scan_status = 'clean'
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
    'attachment.scan_clean',
    'attachment',
    completed_attachment.id,
    jsonb_build_object(
      'scan_status',
      'clean',
      'scanner',
      left(target_scanner, 80),
      'signature',
      left(target_signature, 120)
    )
  );

  return next completed_attachment;
end;
$$;

revoke all on function public.complete_attachment_clean(
  uuid,
  text,
  text
) from public;
grant execute on function public.complete_attachment_clean(
  uuid,
  text,
  text
) to service_role;
