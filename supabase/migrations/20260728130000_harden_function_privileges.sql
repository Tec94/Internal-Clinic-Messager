revoke execute on all functions in schema public from anon;

alter default privileges for role postgres in schema public
  revoke execute on functions from anon;
alter default privileges for role postgres in schema public
  revoke execute on functions from public;

revoke execute on function public.configure_development_mfa_bypass(
  uuid,
  text,
  timestamptz
) from authenticated;
revoke execute on function public.complete_attachment_dev_bypass(uuid)
  from authenticated;
revoke execute on function public.reject_attachment_upload(uuid, text)
  from authenticated;
revoke execute on function public.complete_attachment_clean(uuid, text, text)
  from authenticated;

grant execute on function public.configure_development_mfa_bypass(
  uuid,
  text,
  timestamptz
) to service_role;
grant execute on function public.complete_attachment_dev_bypass(uuid)
  to service_role;
grant execute on function public.reject_attachment_upload(uuid, text)
  to service_role;
grant execute on function public.complete_attachment_clean(uuid, text, text)
  to service_role;
