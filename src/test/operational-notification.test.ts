/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { webcrypto } from 'node:crypto'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { describe, expect, it, vi } from 'vitest'

function handlerCode(name: string) {
  const shared = readFileSync(resolve('supabase/functions/_shared/notifications.ts'), 'utf8')
  const source = readFileSync(resolve(`supabase/functions/${name}/index.ts`), 'utf8')
  return ts.transpile(`${shared}\n${source}`.replace(/^import .*$/gm, '').replace(/^export /gm, ''), {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None,
  })
}
const enqueueCode = handlerCode('send-operational-notification')
const workerCode = handlerCode('deliver-operational-notifications')
const messageId = '11111111-1111-4111-8111-111111111111'

function harness(worker = true) {
  // Values below are test inputs, not deployment defaults or recommendations.
  const env: Record<string, string> = {
    SUPABASE_URL: 'https://backend.example.test', SUPABASE_ANON_KEY: 'test-public',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service', VAPID_PUBLIC_KEY: 'test-public',
    VAPID_PRIVATE_KEY: 'test-private', VAPID_SUBJECT: 'mailto:test@example.test',
    PUSH_ALLOWED_ORIGINS: 'https://push.example.test', PUSH_WORKER_SECRET: 'test-worker-secret',
    PUSH_DELIVERY_LEASE_SECONDS: '30', PUSH_DELIVERY_RETRY_SECONDS: '60',
  }
  const delivery = {
    message_id: messageId, subscription_id: 'subscription', lease_token: 'lease',
    lease_expires_at: new Date(Date.now() + 30000).toISOString(), channel_id: 'channel',
    endpoint: 'https://push.example.test/subscription', p256dh: 'test-key', auth_secret: 'test-auth',
    locale: 'en-US', quiet_hours_start: null as string | null,
    quiet_hours_end: null as string | null, timezone: 'UTC',
  }
  const claims: typeof delivery[] = [delivery]
  const rpc = vi.fn(async (name: string): Promise<{ data: unknown; error: unknown }> => {
    if (name === 'authorize_message_notification') return { data: [{ channel_id: 'channel' }], error: null }
    if (name === 'enqueue_message_notification') return { data: 1, error: null }
    if (name === 'claim_notification_delivery') return { data: claims.shift() ?? null, error: null }
    if (name === 'finish_notification_delivery') return { data: true, error: null }
    throw new Error(`Unexpected RPC ${name}`)
  })
  const sendNotification = vi.fn().mockResolvedValue(undefined)
  const createClient = vi.fn(() => ({ rpc }))
  let serve: (request: Request) => Promise<Response>
  runInNewContext(worker ? workerCode : enqueueCode, {
    Deno: { env: { get: (key: string) => env[key] }, serve: (handler: typeof serve) => { serve = handler } },
    createClient, webpush: { setVapidDetails: vi.fn(), sendNotification },
    Request, Response, URL, Date, Intl, Map, Set, TextEncoder, crypto: webcrypto,
  })
  return {
    env, delivery, claims, rpc, sendNotification, createClient,
    dispatch: (secret = 'test-worker-secret') => serve(new Request('https://edge.example.test', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json', 'x-notification-worker-secret': secret },
      body: JSON.stringify({ messageId }),
    })),
  }
}

describe('notification enqueue Edge Function', () => {
  it('authorizes before durable enqueue and does not contact a push provider', async () => {
    const app = harness(false)
    expect(await (await app.dispatch()).json()).toEqual({ queued: 1 })
    expect(app.rpc.mock.calls.map(([name]) => name)).toEqual([
      'authorize_message_notification', 'enqueue_message_notification',
    ])
    expect(app.rpc).toHaveBeenLastCalledWith('enqueue_message_notification', { target_message_id: messageId })
    expect(app.sendNotification).not.toHaveBeenCalled()
  })

  it('does not enqueue on database authorization failure', async () => {
    const app = harness(false)
    app.rpc.mockResolvedValue({ data: null, error: { message: 'Forbidden' } })
    expect((await app.dispatch()).status).toBe(403)
    expect(app.rpc).toHaveBeenCalledTimes(1)
  })
})

describe('durable notification worker Edge Function', () => {
  it('delivers generic content and durably acknowledges the exact lease', async () => {
    const app = harness()
    expect(await (await app.dispatch()).json()).toEqual({ delivered: 1, retried: 0, cancelled: 0 })
    expect(app.sendNotification).toHaveBeenCalledWith({
      endpoint: app.delivery.endpoint, keys: { p256dh: 'test-key', auth: 'test-auth' },
    }, JSON.stringify({ title: 'YKSG Messenger', body: 'You have a new operational update.',
      url: '/channels/channel', tag: 'channel-channel' }), { TTL: 60, timeout: expect.any(Number) })
    expect(app.rpc).toHaveBeenCalledWith('finish_notification_delivery', expect.objectContaining({
      target_message_id: messageId, target_subscription_id: 'subscription', target_lease_token: 'lease',
      target_outcome: 'delivered', target_retry_seconds: null,
    }))
  })

  it.each(['', 'wrong-secret'])('rejects missing or incorrect worker secret', async (secret) => {
    const app = harness()
    expect((await app.dispatch(secret)).status).toBe(401)
    expect(app.createClient).not.toHaveBeenCalled()
    expect(app.sendNotification).not.toHaveBeenCalled()
  })

  it.each([
    ['PUSH_ALLOWED_ORIGINS', ''], ['PUSH_ALLOWED_ORIGINS', 'http://push.example.test'],
    ['PUSH_ALLOWED_ORIGINS', 'https://push.example.test/path'], ['PUSH_ALLOWED_ORIGINS', '*'],
    ['PUSH_WORKER_SECRET', ''], ['PUSH_DELIVERY_LEASE_SECONDS', ''],
    ['PUSH_DELIVERY_RETRY_SECONDS', ''], ['PUSH_DELIVERY_RETRY_SECONDS', '-1'],
  ])('requires explicit valid configuration %s=%s', async (key, value) => {
    const app = harness()
    app.env[key] = value
    expect((await app.dispatch()).status).toBe(503)
    expect(app.createClient).not.toHaveBeenCalled()
  })

  it.each([
    'https://127.0.0.1:8443/private', 'https://push.example.test.attacker.test/subscription',
    'https://push.example.test@attacker.test/subscription', 'https://user:password@push.example.test/subscription',
    'https://push.example.test:8443/subscription', 'http://push.example.test/subscription', 'not-a-url',
  ])('cancels untrusted endpoint without sending: %s', async (endpoint) => {
    const app = harness()
    app.delivery.endpoint = endpoint
    expect(await (await app.dispatch()).json()).toEqual({ delivered: 0, retried: 0, cancelled: 1 })
    expect(app.sendNotification).not.toHaveBeenCalled()
  })

  it('cancels invalid timezone independently and continues the next delivery', async () => {
    const app = harness()
    app.claims.push({ ...app.delivery, subscription_id: 'valid-subscription' })
    Object.assign(app.delivery, { quiet_hours_start: '09:00', quiet_hours_end: '10:00', timezone: 'Invalid/Zone' })
    expect(await (await app.dispatch()).json()).toEqual({ delivered: 1, retried: 0, cancelled: 1 })
    expect(app.sendNotification).toHaveBeenCalledTimes(1)
  })

  it('suppresses quiet-hours delivery without sending or retrying', async () => {
    const app = harness()
    app.delivery.quiet_hours_start = '00:00'
    app.delivery.quiet_hours_end = '00:00'
    expect(await (await app.dispatch()).json()).toEqual({ delivered: 0, retried: 0, cancelled: 1 })
    expect(app.sendNotification).not.toHaveBeenCalled()
    expect(app.rpc).toHaveBeenCalledWith('finish_notification_delivery', expect.objectContaining({
      target_outcome: 'cancelled', target_retry_seconds: null, target_result: 'quiet_hours',
    }))
  })

  it.each([404, 410])('durably revokes terminal provider response %s', async (statusCode) => {
    const app = harness()
    app.sendNotification.mockRejectedValue({ statusCode })
    expect(await (await app.dispatch()).json()).toEqual({ delivered: 0, retried: 0, cancelled: 1 })
    expect(app.rpc).toHaveBeenCalledWith('finish_notification_delivery', expect.objectContaining({ target_outcome: 'revoked' }))
  })

  it('honors provider Retry-After and durably reschedules instead of repeating now', async () => {
    const app = harness()
    app.sendNotification.mockRejectedValue({ statusCode: 429, headers: { 'Retry-After': '120' } })
    expect(await (await app.dispatch()).json()).toEqual({ delivered: 0, retried: 1, cancelled: 0 })
    expect(app.rpc).toHaveBeenCalledWith('finish_notification_delivery', expect.objectContaining({
      target_outcome: 'retry', target_retry_seconds: 120,
    }))
  })

  it('uses configured retry interval for transient transport failures', async () => {
    const app = harness()
    app.sendNotification.mockRejectedValue(new Error('Transport failed'))
    expect(await (await app.dispatch()).json()).toEqual({ delivered: 0, retried: 1, cancelled: 0 })
    expect(app.rpc).toHaveBeenCalledWith('finish_notification_delivery', expect.objectContaining({
      target_outcome: 'retry', target_retry_seconds: 60,
    }))
  })

  it('cancels a provider 400 without repeated retries', async () => {
    const app = harness()
    app.sendNotification.mockRejectedValue({ statusCode: 400 })
    expect(await (await app.dispatch()).json()).toEqual({ delivered: 0, retried: 0, cancelled: 1 })
    expect(app.rpc).toHaveBeenCalledWith('finish_notification_delivery', expect.objectContaining({
      target_outcome: 'cancelled', target_result: 'provider_400',
    }))
  })

  it.each([401, 403])('defers provider configuration failure %s and stops fan-out', async (statusCode) => {
    const app = harness()
    app.claims.push({ ...app.delivery, subscription_id: 'second-subscription' })
    app.sendNotification.mockRejectedValue({ statusCode })
    expect(await (await app.dispatch()).json()).toEqual({ delivered: 0, retried: 1, cancelled: 0 })
    expect(app.sendNotification).toHaveBeenCalledTimes(1)
    expect(app.claims).toHaveLength(1)
  })

  it('uses the same invocation cutoff for every claim, leaving retries to a later run', async () => {
    const app = harness()
    app.sendNotification.mockRejectedValue({ statusCode: 503 })
    await app.dispatch()
    const claims = app.rpc.mock.calls.filter(([name]) => name === 'claim_notification_delivery')
    expect(claims).toHaveLength(2)
    expect(claims[0]).toEqual(claims[1])
    expect(app.rpc).toHaveBeenCalledWith('claim_notification_delivery', {
      target_lease_seconds: 30, target_due_before: expect.any(String),
    })
  })

  it('does not claim success after lease fencing rejects completion', async () => {
    const app = harness()
    app.rpc.mockImplementation(async (name) => ({
      data: name === 'claim_notification_delivery' ? app.claims.shift() ?? null : false, error: null,
    }))
    expect(await (await app.dispatch()).json()).toEqual({ delivered: 0, retried: 0, cancelled: 0 })
  })
})
