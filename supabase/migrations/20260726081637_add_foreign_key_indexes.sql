create index assignments_org_member_idx
  on public.assignments (organization_id, member_id);
create index assignments_org_location_idx
  on public.assignments (organization_id, location_id);
create index assignments_org_department_idx
  on public.assignments (organization_id, department_id);

create index audit_events_org_actor_idx
  on public.audit_events (organization_id, actor_member_id);
create index audit_events_org_location_idx
  on public.audit_events (organization_id, location_id);

create index channel_departments_org_channel_idx
  on public.channel_departments (organization_id, channel_id);
create index channel_departments_org_department_idx
  on public.channel_departments (organization_id, department_id);

create index channel_locations_org_channel_idx
  on public.channel_locations (organization_id, channel_id);
create index channel_locations_org_location_idx
  on public.channel_locations (organization_id, location_id);

create index channels_org_owner_idx
  on public.channels (organization_id, owner_member_id);

create index invitations_org_department_idx
  on public.invitations (organization_id, department_id);
create index invitations_org_location_idx
  on public.invitations (organization_id, location_id);

create index message_receipts_org_message_idx
  on public.message_receipts (organization_id, message_id);
create index message_receipts_org_member_idx
  on public.message_receipts (organization_id, member_id);

create index messages_org_author_idx
  on public.messages (organization_id, author_member_id);

create index onboarding_progress_org_member_idx
  on public.onboarding_progress (organization_id, member_id);

create index role_binding_departments_org_binding_idx
  on public.role_binding_departments (organization_id, role_binding_id);
create index role_binding_departments_org_department_idx
  on public.role_binding_departments (organization_id, department_id);

create index role_binding_locations_org_binding_idx
  on public.role_binding_locations (organization_id, role_binding_id);
create index role_binding_locations_org_location_idx
  on public.role_binding_locations (organization_id, location_id);

create index role_bindings_org_member_idx
  on public.role_bindings (organization_id, member_id);
