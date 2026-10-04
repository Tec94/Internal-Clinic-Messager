-- Run after the notification migration, worker deployment, and secret setup.
-- Vault entries: notification_project_url (HTTPS project origin) and
-- notification_worker_secret (same value as the worker's PUSH_WORKER_SECRET).
-- Do not put secret values in this file or in the cron command text.
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron')
    or not exists (select 1 from pg_extension where extname = 'pg_net')
    or not exists (select 1 from pg_extension where extname = 'supabase_vault') then
    raise exception 'Enable pg_cron, pg_net, and Vault before scheduling notifications.';
  end if;
  if not exists (select 1 from vault.decrypted_secrets where name = 'notification_project_url')
    or not exists (select 1 from vault.decrypted_secrets where name = 'notification_worker_secret') then
    raise exception 'Configure the notification project URL and worker secret in Vault first.';
  end if;
end;
$$;

-- Owner delegated timing selection on October 4, 2026. One-minute scheduling
-- balances alert latency and polling overhead; retries use the same interval.
-- The due-work index keeps idle checks cheap; idle ticks make no HTTP request.
select cron.schedule(
  'deliver-operational-notifications',
  '* * * * *',
  $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets
        where name = 'notification_project_url') || '/functions/v1/deliver-operational-notifications',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-notification-worker-secret', (select decrypted_secret from vault.decrypted_secrets
          where name = 'notification_worker_secret')
      ),
      body := '{}'::jsonb,
      -- Supabase's documented request idle timeout is 150 seconds.
      timeout_milliseconds := 150000
    )
    where exists (
      select 1 from private.notification_deliveries
      where status = 'pending' and next_attempt_at <= now()
        and (lease_expires_at is null or lease_expires_at <= now())
    );
  $job$
);
