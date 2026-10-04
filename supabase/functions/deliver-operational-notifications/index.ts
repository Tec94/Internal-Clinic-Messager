import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.110.7'
import webpush from 'npm:web-push@3.6.7'
import { type NotificationDelivery, notificationConfig, notificationEndpoint, isNotificationQuietTime, notificationRetrySeconds, matchesNotificationWorkerSecret, notificationResponse } from '../_shared/notifications.ts'

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return notificationResponse({ error: 'Only POST is supported.' }, 405)
  try {
    const config = notificationConfig((name) => Deno.env.get(name))
    if (!config) return notificationResponse({ error: 'Notifications are not configured.' }, 503)
    if (!await matchesNotificationWorkerSecret(request.headers.get('x-notification-worker-secret'), config.workerSecret)) {
      return notificationResponse({ error: 'Worker authentication is required.' }, 401)
    }
    const admin = createClient(config.url, config.serviceKey, { auth: { persistSession: false } })
    webpush.setVapidDetails(config.vapidSubject, config.vapidPublic, config.vapidPrivate)
    let delivered = 0
    let retried = 0
    let cancelled = 0
    const dueBefore = new Date().toISOString()
    // Drain this invocation's due work; retries/new arrivals belong to a later run.
    while (true) {
      const { data, error } = await admin.rpc('claim_notification_delivery', {
        target_lease_seconds: config.leaseSeconds,
        target_due_before: dueBefore,
      })
      if (error) throw error
      if (!data) break
      const delivery = data as NotificationDelivery
      let outcome = 'retry'
      let result = 'transport_failure'
      let retrySeconds = config.retrySeconds
      let stopDrain = false
      const endpoint = notificationEndpoint(delivery.endpoint, config.allowedOrigins)
      if (!endpoint) {
        outcome = 'cancelled'
        result = 'untrusted_endpoint'
      } else {
        let quiet = false
        try {
          quiet = isNotificationQuietTime(delivery, new Date())
        } catch {
          outcome = 'cancelled'
          result = 'invalid_preferences'
        }
        try {
          if (quiet) {
            outcome = 'cancelled'
            result = 'quiet_hours'
          } else if (outcome !== 'cancelled') {
            const remainingLeaseMs = new Date(delivery.lease_expires_at).getTime() - Date.now()
            if (remainingLeaseMs <= 0) break
            const vietnamese = delivery.locale === 'vi-VN'
            await webpush.sendNotification({
              endpoint, keys: { p256dh: delivery.p256dh, auth: delivery.auth_secret },
            }, JSON.stringify({
              title: 'YKSG Messenger',
              body: vietnamese ? 'Bạn có cập nhật vận hành mới.' : 'You have a new operational update.',
              url: `/channels/${delivery.channel_id}`, tag: `channel-${delivery.channel_id}`,
            }), { TTL: 60, timeout: remainingLeaseMs })
            outcome = 'delivered'
            result = 'delivered'
          }
        } catch (error) {
          const failure = error as { statusCode?: number; headers?: Record<string, string> }
          if (failure.statusCode === 404 || failure.statusCode === 410) {
            outcome = 'revoked'
            result = `provider_${failure.statusCode}`
          } else if (failure.statusCode === 400) {
            outcome = 'cancelled'
            result = 'provider_400'
          } else {
            result = failure.statusCode ? `provider_${failure.statusCode}` : 'delivery_error'
            retrySeconds = notificationRetrySeconds(failure.headers, config.retrySeconds)
            stopDrain = failure.statusCode === 401 || failure.statusCode === 403
          }
        }
      }
      const { data: finished, error: finishError } = await admin.rpc('finish_notification_delivery', {
        target_message_id: delivery.message_id, target_subscription_id: delivery.subscription_id,
        target_lease_token: delivery.lease_token, target_outcome: outcome,
        target_retry_seconds: outcome === 'retry' ? retrySeconds : null, target_result: result,
      })
      if (finishError) throw finishError
      if (finished) {
        if (outcome === 'delivered') delivered += 1
        else if (outcome === 'retry') retried += 1
        else cancelled += 1
      }
      if (stopDrain) break
    }
    return notificationResponse({ delivered, retried, cancelled })
  } catch {
    return notificationResponse({ error: 'Notification worker failed.' }, 500)
  }
})
