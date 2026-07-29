import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.110.7'
import webpush from 'npm:web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  try {
    if (request.method !== 'POST') {
      return response({ error: 'Only POST is supported.' }, 405)
    }
    const authorization = request.headers.get('Authorization')
    const url = Deno.env.get('SUPABASE_URL')
    const publicKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY')
    const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')
    const vapidSubject = Deno.env.get('VAPID_SUBJECT')
    if (
      !authorization
      || !url
      || !publicKey
      || !serviceKey
      || !vapidPublic
      || !vapidPrivate
      || !vapidSubject
    ) {
      return response({ error: 'Notifications are not configured.' }, 503)
    }
    const body = await request.json() as { messageId?: unknown }
    if (
      typeof body.messageId !== 'string'
      || !/^[0-9a-f-]{36}$/i.test(body.messageId)
    ) {
      return response({ error: 'A valid messageId is required.' }, 400)
    }

    const user = createClient(url, publicKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    })
    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false },
    })
    const { data: authorizationRows, error: authorizationError } =
      await user.rpc('authorize_message_notification', {
        target_message_id: body.messageId,
      })
    const scope = authorizationRows?.[0] as {
      organization_id: string
      channel_id: string
      author_member_id: string
    } | undefined
    if (authorizationError || !scope) {
      return response({ error: 'Notification dispatch is not authorized.' }, 403)
    }

    const now = new Date()
    const { data: memberships, error: membershipsError } = await admin
      .from('channel_memberships')
      .select('member_id, expires_at')
      .eq('organization_id', scope.organization_id)
      .eq('channel_id', scope.channel_id)
      .is('archived_at', null)
    if (membershipsError) throw membershipsError
    const candidateIds = (memberships ?? [])
      .filter((item) => (
        item.member_id !== scope.author_member_id
        && (!item.expires_at || new Date(item.expires_at) > now)
      ))
      .map((item) => item.member_id)
    if (candidateIds.length === 0) return response({ sent: 0 })

    const [membersResult, subscriptionsResult, preferencesResult] =
      await Promise.all([
        admin
          .from('organization_members')
          .select('id, starts_at, expires_at, status')
          .eq('organization_id', scope.organization_id)
          .in('id', candidateIds),
        admin
          .from('push_subscriptions')
          .select('id, member_id, endpoint, p256dh, auth_secret')
          .eq('organization_id', scope.organization_id)
          .in('member_id', candidateIds)
          .is('revoked_at', null),
        admin
          .from('account_preferences')
          .select(`
            member_id,
            locale,
            notifications_enabled,
            quiet_hours_start,
            quiet_hours_end,
            timezone
          `)
          .eq('organization_id', scope.organization_id)
          .in('member_id', candidateIds),
      ])
    if (
      membersResult.error
      || subscriptionsResult.error
      || preferencesResult.error
    ) {
      throw (
        membersResult.error
        ?? subscriptionsResult.error
        ?? preferencesResult.error
      )
    }
    const members = membersResult.data
    const subscriptions = subscriptionsResult.data
    const preferences = preferencesResult.data
    const activeMembers = new Set((members ?? [])
      .filter((member) => (
        member.status === 'active'
        && new Date(member.starts_at) <= now
        && (!member.expires_at || new Date(member.expires_at) > now)
      ))
      .map((member) => member.id))
    const preferenceByMember = new Map(
      (preferences ?? []).map((preference) => [
        preference.member_id,
        preference,
      ]),
    )

    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)
    let sent = 0
    await Promise.all((subscriptions ?? []).map(async (subscription) => {
      const preference = preferenceByMember.get(subscription.member_id)
      if (
        !activeMembers.has(subscription.member_id)
        || !preference?.notifications_enabled
        || isQuietTime(preference, now)
      ) return
      const vietnamese = preference.locale === 'vi-VN'
      try {
        await webpush.sendNotification({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth_secret,
          },
        }, JSON.stringify({
          title: 'YKSG Messenger',
          body: vietnamese
            ? 'Bạn có cập nhật vận hành mới.'
            : 'You have a new operational update.',
          url: `/channels/${scope.channel_id}`,
          tag: `channel-${scope.channel_id}`,
        }), { TTL: 60 })
        sent += 1
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode
        if (statusCode === 404 || statusCode === 410) {
          const { error: revokeError } = await admin
            .from('push_subscriptions')
            .update({ revoked_at: new Date().toISOString() })
            .eq('id', subscription.id)
          if (revokeError) throw revokeError
        }
      }
    }))
    return response({ sent })
  } catch {
    return response({ error: 'Notification dispatch failed.' }, 500)
  }
})

function isQuietTime(
  preference: {
    quiet_hours_start: string | null
    quiet_hours_end: string | null
    timezone: string
  },
  now: Date,
) {
  const start = preference.quiet_hours_start?.slice(0, 5)
  const end = preference.quiet_hours_end?.slice(0, 5)
  if (!start || !end) return false
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: preference.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '00'
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '00'
  const current = `${hour}:${minute}`
  return start < end
    ? current >= start && current < end
    : current >= start || current < end
}

function response(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json',
    },
  })
}
