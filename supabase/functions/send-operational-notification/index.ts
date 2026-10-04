import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.110.7'
import { notificationConfig, notificationResponse } from '../_shared/notifications.ts'

Deno.serve(async (request: Request) => {
  const reply = (body: Record<string, unknown>, status = 200) => notificationResponse(body, status, true)
  if (request.method === 'OPTIONS') return reply({})
  if (request.method !== 'POST') return reply({ error: 'Only POST is supported.' }, 405)
  try {
    const authorization = request.headers.get('Authorization')
    if (!authorization?.startsWith('Bearer ')) return reply({ error: 'Authentication is required.' }, 401)
    const config = notificationConfig((name) => Deno.env.get(name))
    if (!config) return reply({ error: 'Notifications are not configured.' }, 503)
    let body: { messageId?: unknown } | null
    try { body = await request.json() } catch { return reply({ error: 'Invalid JSON.' }, 400) }
    if (typeof body?.messageId !== 'string'
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.messageId)) {
      return reply({ error: 'A valid messageId is required.' }, 400)
    }
    const user = createClient(config.url, config.publicKey, {
      global: { headers: { Authorization: authorization } }, auth: { persistSession: false },
    })
    const { data: scope, error: authorizationError } = await user.rpc('authorize_message_notification', {
      target_message_id: body.messageId,
    })
    if (authorizationError || !scope?.[0]) return reply({ error: 'Notification dispatch is not authorized.' }, 403)
    const admin = createClient(config.url, config.serviceKey, { auth: { persistSession: false } })
    const { data: queued, error } = await admin.rpc('enqueue_message_notification', {
      target_message_id: body.messageId,
    })
    if (error) throw error
    return reply({ queued })
  } catch {
    return reply({ error: 'Notification enqueue failed.' }, 500)
  }
})
