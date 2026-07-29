create table private.environment_settings (
  singleton boolean primary key default true check (singleton),
  environment text not null default 'production'
    check (environment in ('development', 'staging', 'production')),
  updated_at timestamptz not null default now()
);

insert into private.environment_settings (singleton, environment)
values (true, 'production');

revoke all on table private.environment_settings
  from public, anon, authenticated;
grant select, insert, update, delete
  on table private.environment_settings to service_role;

create or replace function private.session_satisfies_mfa()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and (
      coalesce((select auth.jwt()) ->> 'aal', 'aal1') = 'aal2'
      or (
        exists (
          select 1
          from private.environment_settings as setting
          where setting.singleton
            and setting.environment = 'development'
        )
        and exists (
          select 1
          from private.development_mfa_bypasses as bypass
          where bypass.user_id = (select auth.uid())
            and bypass.expires_at > now()
        )
      )
    );
$$;

create table public.account_preferences (
  organization_id uuid not null references public.organizations (id),
  member_id uuid primary key,
  locale text not null default 'vi-VN'
    check (locale in ('en-US', 'vi-VN')),
  default_location_id uuid,
  notifications_enabled boolean not null default false,
  quiet_hours_start time,
  quiet_hours_end time,
  timezone text not null default 'Asia/Ho_Chi_Minh',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, member_id)
    references public.organization_members (organization_id, id)
    on delete cascade,
  foreign key (organization_id, default_location_id)
    references public.locations (organization_id, id),
  check (
    (quiet_hours_start is null and quiet_hours_end is null)
    or
    (quiet_hours_start is not null and quiet_hours_end is not null)
  )
);

create index account_preferences_organization_id_idx
  on public.account_preferences (organization_id);
create index account_preferences_default_location_id_idx
  on public.account_preferences (default_location_id);

create trigger account_preferences_set_updated_at
  before update on public.account_preferences
  for each row execute function private.set_updated_at();

create function private.is_assigned_location(
  target_organization_id uuid,
  target_member_id uuid,
  target_location_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_location_id is null
    or exists (
      select 1
      from public.assignments as assignment
      where assignment.organization_id = target_organization_id
        and assignment.member_id = target_member_id
        and assignment.location_id = target_location_id
        and assignment.archived_at is null
        and assignment.starts_at <= now()
        and (
          assignment.ends_at is null
          or assignment.ends_at > now()
        )
    );
$$;

revoke all on function private.is_assigned_location(uuid, uuid, uuid)
  from public;
grant execute on function private.is_assigned_location(uuid, uuid, uuid)
  to authenticated, service_role;

alter table public.account_preferences enable row level security;

create policy "members can read their account preferences"
  on public.account_preferences for select
  to authenticated
  using (
    private.is_current_member(organization_id, member_id)
  );

create policy "members can create their account preferences"
  on public.account_preferences for insert
  to authenticated
  with check (
    private.is_current_member(organization_id, member_id)
    and private.is_assigned_location(
      organization_id,
      member_id,
      default_location_id
    )
  );

create policy "members can update their account preferences"
  on public.account_preferences for update
  to authenticated
  using (
    private.is_current_member(organization_id, member_id)
  )
  with check (
    private.is_current_member(organization_id, member_id)
    and private.is_assigned_location(
      organization_id,
      member_id,
      default_location_id
    )
  );

create policy "aal2 required for account preferences"
  on public.account_preferences
  as restrictive
  for all
  to authenticated
  using ((select private.session_satisfies_mfa()))
  with check ((select private.session_satisfies_mfa()));

revoke all on table public.account_preferences
  from public, anon, authenticated;
grant select, insert, update
  on table public.account_preferences to authenticated;
grant all on table public.account_preferences to service_role;

create function public.save_my_account_settings(
  target_organization_id uuid,
  target_member_id uuid,
  target_locale text,
  target_default_location_id uuid,
  target_notifications_enabled boolean,
  target_quiet_hours_start time,
  target_quiet_hours_end time,
  target_timezone text
)
returns setof public.account_preferences
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_preferences public.account_preferences%rowtype;
begin
  if not private.session_satisfies_mfa()
    or not private.is_current_member(
      target_organization_id,
      target_member_id
    )
  then
    raise insufficient_privilege using
      message = 'An active AAL2 membership is required.';
  end if;

  if target_locale not in ('en-US', 'vi-VN') then
    raise invalid_parameter_value using
      message = 'The selected language is not supported.';
  end if;

  if not private.is_assigned_location(
    target_organization_id,
    target_member_id,
    target_default_location_id
  ) then
    raise insufficient_privilege using
      message = 'The default location must be an active assignment.';
  end if;

  if (
    target_quiet_hours_start is null
    and target_quiet_hours_end is not null
  ) or (
    target_quiet_hours_start is not null
    and target_quiet_hours_end is null
  ) then
    raise invalid_parameter_value using
      message = 'Both quiet-hour values are required together.';
  end if;

  if length(trim(target_timezone)) not between 1 and 100 then
    raise invalid_parameter_value using
      message = 'The timezone is invalid.';
  end if;

  update public.profiles
  set locale = target_locale
  where id = (select auth.uid());

  insert into public.account_preferences (
    organization_id,
    member_id,
    locale,
    default_location_id,
    notifications_enabled,
    quiet_hours_start,
    quiet_hours_end,
    timezone
  )
  values (
    target_organization_id,
    target_member_id,
    target_locale,
    target_default_location_id,
    target_notifications_enabled,
    target_quiet_hours_start,
    target_quiet_hours_end,
    trim(target_timezone)
  )
  on conflict (member_id) do update
  set
    locale = excluded.locale,
    default_location_id = excluded.default_location_id,
    notifications_enabled = excluded.notifications_enabled,
    quiet_hours_start = excluded.quiet_hours_start,
    quiet_hours_end = excluded.quiet_hours_end,
    timezone = excluded.timezone
  where account_preferences.organization_id = excluded.organization_id
  returning * into saved_preferences;

  if saved_preferences.member_id is null then
    raise unique_violation using
      message = 'The preference row belongs to another organization.';
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
    target_organization_id,
    target_member_id,
    'account.preferences_updated',
    'organization_member',
    target_member_id,
    jsonb_build_object(
      'locale',
      target_locale,
      'notifications_enabled',
      target_notifications_enabled,
      'default_location_set',
      target_default_location_id is not null
    )
  );

  return next saved_preferences;
end;
$$;

revoke all on function public.save_my_account_settings(
  uuid,
  uuid,
  text,
  uuid,
  boolean,
  time,
  time,
  text
) from public;
grant execute on function public.save_my_account_settings(
  uuid,
  uuid,
  text,
  uuid,
  boolean,
  time,
  time,
  text
) to authenticated, service_role;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  member_id uuid not null,
  device_id uuid not null,
  endpoint text not null,
  p256dh text not null,
  auth_secret text not null,
  platform text not null default 'web'
    check (platform in ('web', 'android', 'ios', 'windows')),
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  unique (member_id, device_id),
  unique (endpoint),
  foreign key (organization_id, member_id)
    references public.organization_members (organization_id, id)
    on delete cascade
);

create index push_subscriptions_organization_id_idx
  on public.push_subscriptions (organization_id);
create index push_subscriptions_active_member_idx
  on public.push_subscriptions (member_id)
  where revoked_at is null;

create trigger push_subscriptions_set_updated_at
  before update on public.push_subscriptions
  for each row execute function private.set_updated_at();

alter table public.push_subscriptions enable row level security;

create policy "members can read their push subscriptions"
  on public.push_subscriptions for select
  to authenticated
  using (private.is_current_member(organization_id, member_id));

create policy "members can create their push subscriptions"
  on public.push_subscriptions for insert
  to authenticated
  with check (private.is_current_member(organization_id, member_id));

create policy "members can update their push subscriptions"
  on public.push_subscriptions for update
  to authenticated
  using (private.is_current_member(organization_id, member_id))
  with check (private.is_current_member(organization_id, member_id));

create policy "members can delete their push subscriptions"
  on public.push_subscriptions for delete
  to authenticated
  using (private.is_current_member(organization_id, member_id));

create policy "aal2 required for push subscriptions"
  on public.push_subscriptions
  as restrictive
  for all
  to authenticated
  using ((select private.session_satisfies_mfa()))
  with check ((select private.session_satisfies_mfa()));

revoke all on table public.push_subscriptions
  from public, anon, authenticated;
grant select, insert, update, delete
  on table public.push_subscriptions to authenticated;
grant all on table public.push_subscriptions to service_role;

create function public.configure_development_mfa_bypass(
  target_user_id uuid,
  target_reason text,
  target_expires_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from private.environment_settings as setting
    where setting.singleton
      and setting.environment = 'development'
  ) then
    raise insufficient_privilege using
      message = 'Development MFA bypass is disabled in this environment.';
  end if;

  if target_expires_at <= now()
    or target_expires_at > now() + interval '7 days'
  then
    raise invalid_parameter_value using
      message = 'The bypass expiry must be within the next seven days.';
  end if;

  insert into private.development_mfa_bypasses (
    user_id,
    reason,
    created_by,
    expires_at
  )
  values (
    target_user_id,
    trim(target_reason),
    null,
    target_expires_at
  )
  on conflict (user_id) do update
  set
    reason = excluded.reason,
    created_at = now(),
    created_by = null,
    expires_at = excluded.expires_at;
end;
$$;

revoke all on function public.configure_development_mfa_bypass(
  uuid,
  text,
  timestamptz
) from public;
grant execute on function public.configure_development_mfa_bypass(
  uuid,
  text,
  timestamptz
) to service_role;
