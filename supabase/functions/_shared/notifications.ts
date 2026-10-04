export interface NotificationDelivery {
  message_id: string
  subscription_id: string
  lease_token: string
  lease_expires_at: string
  channel_id: string
  endpoint: string
  p256dh: string
  auth_secret: string
  locale: string
  quiet_hours_start: string | null
  quiet_hours_end: string | null
  timezone: string
}

export function notificationConfig(get: (name: string) => string | undefined) {
  const url = get('SUPABASE_URL')
  const publicKey = get('SUPABASE_ANON_KEY')
  const serviceKey = get('SUPABASE_SERVICE_ROLE_KEY')
  const vapidPublic = get('VAPID_PUBLIC_KEY')
  const vapidPrivate = get('VAPID_PRIVATE_KEY')
  const vapidSubject = get('VAPID_SUBJECT')
  const workerSecret = get('PUSH_WORKER_SECRET')
  const origins = get('PUSH_ALLOWED_ORIGINS')
  const leaseSeconds = Number(get('PUSH_DELIVERY_LEASE_SECONDS'))
  const retrySeconds = Number(get('PUSH_DELIVERY_RETRY_SECONDS'))
  if (
    !url || !publicKey || !serviceKey || !vapidPublic || !vapidPrivate
    || !vapidSubject || !workerSecret || !origins?.trim()
    || !Number.isSafeInteger(leaseSeconds) || leaseSeconds <= 0
    // Node-compatible socket timeout is a signed 32-bit millisecond integer.
    || leaseSeconds * 1000 > 2147483647
    || !Number.isSafeInteger(retrySeconds) || retrySeconds <= 0
    // The SQL RPC parameter is a PostgreSQL integer.
    || retrySeconds > 2147483647
  ) return null
  try {
    const allowedOrigins = new Set(origins.split(',').map((origin) => origin.trim()))
    for (const origin of allowedOrigins) {
      const parsed = new URL(origin)
      if (parsed.protocol !== 'https:' || parsed.origin !== origin) return null
    }
    return { url, publicKey, serviceKey, vapidPublic, vapidPrivate, vapidSubject,
      workerSecret, allowedOrigins, leaseSeconds, retrySeconds }
  } catch {
    return null
  }
}

export function notificationEndpoint(value: string, allowedOrigins: Set<string>) {
  try {
    const endpoint = new URL(value)
    if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password
      || !allowedOrigins.has(endpoint.origin)) return null
    return endpoint.href
  } catch {
    return null
  }
}

export function isNotificationQuietTime(preference: NotificationDelivery, now: Date) {
  const start = preference.quiet_hours_start?.slice(0, 5)
  const end = preference.quiet_hours_end?.slice(0, 5)
  if (!start || !end) return false
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: preference.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now)
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '00'
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '00'
  const current = `${hour}:${minute}`
  return start < end ? current >= start && current < end : current >= start || current < end
}

export function notificationRetrySeconds(headers: Record<string, string> | undefined, fallback: number) {
  const value = Object.entries(headers ?? {})
    .find(([name]) => name.toLowerCase() === 'retry-after')?.[1]
  if (!value) return fallback
  const seconds = /^\d+$/.test(value.trim())
    ? Number(value)
    : Math.ceil((Date.parse(value) - Date.now()) / 1000)
  if (!Number.isSafeInteger(seconds) || seconds <= 0) return fallback
  // Preserve provider delay within PostgreSQL's integer parameter representation.
  return Math.max(fallback, Math.min(seconds, 2147483647))
}

export async function matchesNotificationWorkerSecret(supplied: string | null, expected: string) {
  if (!supplied) return false
  const encoder = new TextEncoder()
  const [left, right] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(supplied)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ])
  const a = new Uint8Array(left)
  const b = new Uint8Array(right)
  let difference = 0
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index]
  return difference === 0
}

export function notificationResponse(body: Record<string, unknown>, status = 200, cors = false) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Cache-Control': 'no-store', 'Content-Type': 'application/json',
      ...(cors ? {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      } : {}),
    },
  })
}
