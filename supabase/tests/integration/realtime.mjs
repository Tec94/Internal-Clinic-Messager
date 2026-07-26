import { execFileSync } from 'node:child_process'
import { createHmac, randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const localStatus = readLocalStatus()
const apiUrl = localStatus.API_URL
const serviceRoleKey = localStatus.SERVICE_ROLE_KEY
const publishableKey = localStatus.PUBLISHABLE_KEY ?? localStatus.ANON_KEY
const apiHost = new URL(apiUrl).hostname

if (!['127.0.0.1', 'localhost'].includes(apiHost)) {
  throw new Error('Realtime integration tests must target local Supabase only.')
}

const admin = createClient(apiUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const user = createClient(apiUrl, publishableKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

await waitForLocalServices()

const ids = {
  user: randomUUID(),
  organization: randomUUID(),
  member: randomUUID(),
  onboarding: randomUUID(),
  channel: randomUUID(),
  membership: randomUUID(),
  message: randomUUID(),
  clientMessage: randomUUID(),
}
const email = `realtime-${ids.user}@example.test`
const password = 'Local-only-test-password-42!'
let realtimeChannel

try {
  await expectData(
    admin.auth.admin.createUser({
      id: ids.user,
      email,
      password,
      email_confirm: true,
    }),
    'create local auth user',
  )

  await insert('organizations', {
    id: ids.organization,
    name: 'Realtime Test Clinic',
    slug: `realtime-${ids.organization}`,
  })
  await insert('profiles', {
    id: ids.user,
    full_name: 'Realtime Test User',
    work_email: email,
  })
  await insert('organization_members', {
    id: ids.member,
    organization_id: ids.organization,
    user_id: ids.user,
  })
  await insert('onboarding_progress', {
    organization_id: ids.organization,
    member_id: ids.member,
    status: 'complete',
    accepted_policy_version: 'local-test',
    accepted_policy_at: new Date().toISOString(),
  })
  await insert('channels', {
    id: ids.channel,
    organization_id: ids.organization,
    name: `realtime-${ids.channel}`,
    display_name: 'Realtime verification',
    purpose: 'Verify authorized local Realtime delivery.',
    type: 'department',
    owner_member_id: ids.member,
  })
  await insert('channel_memberships', {
    id: ids.membership,
    organization_id: ids.organization,
    channel_id: ids.channel,
    member_id: ids.member,
    source: 'policy',
  })

  await expectData(
    user.auth.signInWithPassword({ email, password }),
    'sign in local auth user',
  )
  const enrollment = await expectData(
    user.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Local Realtime Test',
    }),
    'enroll local TOTP factor',
  )
  await expectData(
    user.auth.mfa.challengeAndVerify({
      factorId: enrollment.id,
      code: totp(enrollment.totp.secret),
    }),
    'verify local TOTP factor',
  )
  const restoredSession = await expectData(
    user.auth.getSession(),
    'restore the local AAL2 session',
  )
  const assurance = await expectData(
    user.auth.mfa.getAuthenticatorAssuranceLevel(),
    'read the local authenticator assurance level',
  )
  if (!restoredSession.session?.access_token || assurance.currentLevel !== 'aal2') {
    throw new Error('TOTP verification did not return an AAL2 session.')
  }
  await user.realtime.setAuth(restoredSession.session.access_token)

  const realtime = await subscribeToMessageInserts()
  realtimeChannel = realtime.channel
  await delay(1_500)

  const sentMessageIds = []
  let payload = null

  for (let attempt = 0; attempt < 3 && !payload; attempt += 1) {
    const messageId = attempt === 0 ? ids.message : randomUUID()
    const clientMessageId = attempt === 0 ? ids.clientMessage : randomUUID()
    const inserted = await expectData(
      user
        .from('messages')
        .insert({
          id: messageId,
          organization_id: ids.organization,
          channel_id: ids.channel,
          author_member_id: ids.member,
          client_message_id: clientMessageId,
          body: 'Local authorized Realtime verification.',
        })
        .select('id')
        .single(),
      'insert an RLS-authorized message',
    )
    sentMessageIds.push(inserted.id)
    payload = await Promise.race([
      realtime.event,
      delay(4_000).then(() => null),
    ])
  }

  if (
    !payload
    || !sentMessageIds.includes(payload.new.id)
    || payload.new.channel_id !== ids.channel
  ) {
    throw new Error('Realtime payload did not match the inserted message.')
  }

  console.log('Local AAL2 session restoration, RLS insert, and Realtime delivery passed.')
} finally {
  if (realtimeChannel) await user.removeChannel(realtimeChannel)
  await cleanup()
  user.realtime.disconnect()
}

async function insert(table, values) {
  await expectData(admin.from(table).insert(values), `insert ${table}`)
}

async function expectData(request, operation) {
  const { data, error } = await request
  if (error) throw new Error(`${operation} failed: ${error.message}`)
  return data
}

async function cleanup() {
  const deletions = [
    admin.from('messages').delete().eq('organization_id', ids.organization),
    admin.from('channel_memberships').delete().eq('organization_id', ids.organization),
    admin.from('channels').delete().eq('organization_id', ids.organization),
    admin.from('onboarding_progress').delete().eq('organization_id', ids.organization),
    admin.from('organization_members').delete().eq('organization_id', ids.organization),
    admin.from('organizations').delete().eq('id', ids.organization),
  ]

  for (const deletion of deletions) {
    await deletion
  }
  await admin.auth.admin.deleteUser(ids.user)
}

async function waitForLocalServices() {
  await Promise.all([
    waitForEndpoint('/auth/v1/settings', 'Auth'),
    waitForEndpoint('/realtime/v1/api/ping', 'Realtime'),
  ])
}

async function waitForEndpoint(path, serviceName) {
  let lastStatus = 'unreachable'

  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(`${apiUrl}${path}`, {
        headers: {
          apikey: publishableKey,
          Authorization: `Bearer ${publishableKey}`,
        },
      })
      if (response.ok) return
      lastStatus = `HTTP ${response.status}`
    } catch (error) {
      lastStatus = error instanceof Error ? error.message : 'unreachable'
    }
    await delay(500)
  }

  throw new Error(
    `${serviceName} did not become ready (${lastStatus}). Restart local Supabase.`,
  )
}

async function subscribeToMessageInserts() {
  let lastError

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    let resolveEvent
    const receivedEvent = new Promise((resolve) => {
      resolveEvent = resolve
    })
    const channel = user
      .channel(`roadmap-realtime-${ids.channel}-${attempt}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => resolveEvent(payload),
      )

    try {
      await waitForSubscription(channel)
      return {
        channel,
        event: withTimeout(
          receivedEvent,
          15_000,
          'Timed out waiting for the Realtime insert.',
        ),
      }
    } catch (error) {
      lastError = error
      await user.removeChannel(channel)
      await delay(attempt * 1_000)
    }
  }

  throw lastError ?? new Error('Could not join the Realtime channel.')
}

function waitForSubscription(channel) {
  return new Promise((resolveSubscription, rejectSubscription) => {
    const timeout = setTimeout(
      () => rejectSubscription(new Error('Timed out joining the Realtime channel.')),
      10_000,
    )
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timeout)
        resolveSubscription()
      }
      if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) {
        clearTimeout(timeout)
        rejectSubscription(new Error(`Realtime subscription ended with ${status}.`))
      }
    })
  })
}

function withTimeout(promise, duration, message) {
  return new Promise((resolvePromise, rejectPromise) => {
    const timeout = setTimeout(
      () => rejectPromise(new Error(message)),
      duration,
    )
    promise.then(
      (value) => {
        clearTimeout(timeout)
        resolvePromise(value)
      },
      (error) => {
        clearTimeout(timeout)
        rejectPromise(error)
      },
    )
  })
}

function delay(duration) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, duration))
}

function readLocalStatus() {
  const executable = resolve(
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'supabase.cmd' : 'supabase',
  )
  const command = process.platform === 'win32'
    ? (process.env.ComSpec ?? 'cmd.exe')
    : executable
  const args = process.platform === 'win32'
    ? ['/d', '/s', '/c', `${executable} status --output json`]
    : ['status', '--output', 'json']
  const output = execFileSync(
    command,
    args,
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  )
  return JSON.parse(output)
}

function totp(secret) {
  const key = decodeBase32(secret)
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)))
  const digest = createHmac('sha1', key).update(counter).digest()
  const offset = digest[digest.length - 1] & 0x0f
  const binary = (
    ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff)
  )
  return String(binary % 1_000_000).padStart(6, '0')
}

function decodeBase32(value) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const normalized = value.toUpperCase().replace(/=+$/u, '').replace(/\s+/gu, '')
  let bits = ''
  for (const character of normalized) {
    const index = alphabet.indexOf(character)
    if (index < 0) throw new Error('TOTP secret is not valid base32.')
    bits += index.toString(2).padStart(5, '0')
  }
  const bytes = []
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2))
  }
  return Buffer.from(bytes)
}
