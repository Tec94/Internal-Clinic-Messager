import { supabase } from '../utils/supabase'

export type SupportedLocale = 'en-US' | 'vi-VN'

export interface AccountLocation {
  id: string
  name: string
  shortName: string
  timezone: string
}

export interface AccountSettings {
  locale: SupportedLocale
  defaultLocationId: string | null
  notificationsEnabled: boolean
  quietHoursStart: string
  quietHoursEnd: string
  timezone: string
  locations: AccountLocation[]
}

export interface SaveAccountSettingsCommand
  extends Omit<AccountSettings, 'locations'> {
  organizationId: string
  memberId: string
}

interface PreferenceRow {
  locale: SupportedLocale
  default_location_id: string | null
  notifications_enabled: boolean
  quiet_hours_start: string | null
  quiet_hours_end: string | null
  timezone: string
}

interface AssignmentRow {
  location_id: string
  is_primary: boolean
}

interface LocationRow {
  id: string
  name: string
  short_name: string
  timezone: string
}

export async function loadAccountSettings(
  organizationId: string,
  memberId: string,
): Promise<AccountSettings> {
  const [profileResult, preferenceResult, assignmentResult] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('locale')
        .eq('id', (await supabase.auth.getUser()).data.user?.id ?? '')
        .single(),
      supabase
        .from('account_preferences')
        .select(`
          locale,
          default_location_id,
          notifications_enabled,
          quiet_hours_start,
          quiet_hours_end,
          timezone
        `)
        .eq('organization_id', organizationId)
        .eq('member_id', memberId)
        .maybeSingle(),
      supabase
        .from('assignments')
        .select('location_id, is_primary')
        .eq('organization_id', organizationId)
        .eq('member_id', memberId)
        .is('archived_at', null),
    ])

  if (profileResult.error) {
    throw new Error(`Could not load your profile: ${profileResult.error.message}`)
  }
  if (preferenceResult.error) {
    throw new Error(
      `Could not load your settings: ${preferenceResult.error.message}`,
    )
  }
  if (assignmentResult.error) {
    throw new Error(
      `Could not load your assigned locations: ${assignmentResult.error.message}`,
    )
  }

  const assignments = (assignmentResult.data ?? []) as AssignmentRow[]
  const locationIds = Array.from(
    new Set(assignments.map((assignment) => assignment.location_id)),
  )
  const locationResult = locationIds.length === 0
    ? { data: [] as LocationRow[], error: null }
    : await supabase
        .from('locations')
        .select('id, name, short_name, timezone')
        .eq('organization_id', organizationId)
        .in('id', locationIds)
        .is('archived_at', null)
        .order('name')

  if (locationResult.error) {
    throw new Error(
      `Could not load your assigned locations: ${locationResult.error.message}`,
    )
  }

  const preference = preferenceResult.data as PreferenceRow | null
  const primaryAssignment = assignments.find(
    (assignment) => assignment.is_primary,
  )
  const locations = (locationResult.data ?? []).map(mapLocation)
  const fallbackLocation = locations.find(
    (location) => location.id === primaryAssignment?.location_id,
  ) ?? locations[0]

  return {
    locale:
      preference?.locale
      ?? (profileResult.data.locale as SupportedLocale)
      ?? 'vi-VN',
    defaultLocationId:
      preference?.default_location_id
      ?? fallbackLocation?.id
      ?? null,
    notificationsEnabled: preference?.notifications_enabled ?? false,
    quietHoursStart: normalizeTime(preference?.quiet_hours_start),
    quietHoursEnd: normalizeTime(preference?.quiet_hours_end),
    timezone:
      preference?.timezone
      ?? fallbackLocation?.timezone
      ?? 'Asia/Ho_Chi_Minh',
    locations,
  }
}

export async function saveAccountSettings(
  command: SaveAccountSettingsCommand,
): Promise<void> {
  const { error } = await supabase.rpc('save_my_account_settings', {
    target_organization_id: command.organizationId,
    target_member_id: command.memberId,
    target_locale: command.locale,
    target_default_location_id: command.defaultLocationId,
    target_notifications_enabled: command.notificationsEnabled,
    target_quiet_hours_start: command.quietHoursStart || null,
    target_quiet_hours_end: command.quietHoursEnd || null,
    target_timezone: command.timezone,
  })

  if (error) throw new Error(`Could not save your settings: ${error.message}`)
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const { error } = await supabase.auth.updateUser({
    current_password: currentPassword,
    password: newPassword,
  })
  if (error) throw new Error(error.message)
}

export async function syncPushSubscription(
  organizationId: string,
  memberId: string,
  enabled: boolean,
): Promise<void> {
  if (
    !('serviceWorker' in navigator)
    || !('PushManager' in window)
    || !('Notification' in window)
  ) {
    if (enabled) throw new Error('Push notifications are not supported here.')
    return
  }

  const registration = await navigator.serviceWorker.ready
  const existing = await registration.pushManager.getSubscription()
  if (!enabled) {
    if (existing) {
      const { error } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('endpoint', existing.endpoint)
      if (error) throw new Error(`Could not disable notifications: ${error.message}`)
      await existing.unsubscribe()
    }
    return
  }

  const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim()
  if (!publicKey) {
    throw new Error('Push notifications are not configured for this deployment.')
  }
  const permission = Notification.permission === 'granted'
    ? 'granted'
    : await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted.')
  }

  const subscription = existing ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: decodeApplicationServerKey(publicKey),
  })
  const serialized = subscription.toJSON()
  if (!serialized.keys?.p256dh || !serialized.keys.auth) {
    throw new Error('The browser returned an invalid push subscription.')
  }
  const deviceId = getDeviceId()
  const { error } = await supabase.from('push_subscriptions').upsert({
    organization_id: organizationId,
    member_id: memberId,
    device_id: deviceId,
    endpoint: subscription.endpoint,
    p256dh: serialized.keys.p256dh,
    auth_secret: serialized.keys.auth,
    platform: 'web',
    user_agent: navigator.userAgent.slice(0, 500),
    revoked_at: null,
  }, { onConflict: 'member_id,device_id' })
  if (error) throw new Error(`Could not enable notifications: ${error.message}`)
}

function getDeviceId() {
  const key = 'yksg-push-device-id'
  const stored = localStorage.getItem(key)
  if (stored) return stored
  const created = crypto.randomUUID()
  localStorage.setItem(key, created)
  return created
}

function decodeApplicationServerKey(value: string) {
  const padding = '='.repeat((4 - value.length % 4) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))
}

function mapLocation(row: LocationRow): AccountLocation {
  return {
    id: row.id,
    name: row.name,
    shortName: row.short_name,
    timezone: row.timezone,
  }
}

function normalizeTime(value: string | null | undefined) {
  return value?.slice(0, 5) ?? ''
}
