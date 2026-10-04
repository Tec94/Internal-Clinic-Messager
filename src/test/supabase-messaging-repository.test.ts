import { describe, expect, it, vi } from 'vitest'
import { createSupabaseMessagingRepository } from '../services/supabaseMessagingRepository'
import { supabase } from '../utils/supabase'

describe('Supabase messaging repository', () => {
  it('uses the atomic send RPC without a second notification request', async () => {
    const result = { data: messageRow('message-1', '2026-07-26T01:00:00.000Z'), error: null }
    const builder = createBuilder(result)
    const rpc = vi.fn(() => builder)
    const invoke = vi.fn()
    const client = {
      from: vi.fn(() => builder), rpc, functions: { invoke },
    } as unknown as typeof supabase
    const repository = createSupabaseMessagingRepository(client)

    const message = await repository.sendMessage({
      organizationId: 'organization-1', channelId: 'channel-1', authorMemberId: 'member-1',
      clientMessageId: 'message-1-client', body: ' message-1 ', isUrgent: false,
    })

    expect(message.id).toBe('message-1')
    expect(rpc).toHaveBeenCalledWith('send_message_with_attachments', {
      target_organization_id: 'organization-1', target_channel_id: 'channel-1',
      target_author_member_id: 'member-1', target_client_message_id: 'message-1-client',
      target_body: 'message-1', target_is_urgent: false, target_attachment_ids: [],
    })
    expect(invoke).not.toHaveBeenCalled()
  })

  it('maps scoped channels and current send access', async () => {
    const client = fakeClient({
      data: [
        {
          id: 'channel-1',
          organization_id: 'organization-1',
          name: 'operations',
          display_name: 'Operations',
          purpose: 'Coordinate operational work.',
          type: 'department',
          visibility: 'private',
          owner_member_id: 'member-1',
          is_urgent: false,
          archive_at: null,
          channel_locations: [{ location_id: 'location-1' }],
          channel_departments: [{ department_id: 'department-1' }],
          channel_memberships: [
            activeMembership('member-1', true),
            activeMembership('member-2', false),
          ],
        },
      ],
      error: null,
    })

    const repository = createSupabaseMessagingRepository(client)
    const channels = await repository.listChannels('organization-1', 'member-1')

    expect(channels).toEqual([
      expect.objectContaining({
        id: 'channel-1',
        locationIds: ['location-1'],
        departmentIds: ['department-1'],
        memberIds: ['member-1', 'member-2'],
        memberCount: 2,
        canSend: true,
      }),
    ])
  })

  it('joins organization members with shared profiles', async () => {
    const client = {
      from: vi.fn((table: string) => createBuilder(
        table === 'organization_members'
          ? {
              data: [{
                id: 'member-1',
                user_id: 'user-1',
                employment_type: 'employee',
                status: 'active',
              }],
              error: null,
            }
          : {
              data: [{
                id: 'user-1',
                full_name: 'Verified Staff',
                work_email: 'staff@example.test',
              }],
              error: null,
            },
      )),
    } as unknown as typeof supabase

    const repository = createSupabaseMessagingRepository(client)

    await expect(repository.listMembers('organization-1')).resolves.toEqual([
      {
        memberId: 'member-1',
        userId: 'user-1',
        fullName: 'Verified Staff',
        workEmail: 'staff@example.test',
        employmentType: 'employee',
        status: 'active',
      },
    ])
  })

  it('returns chronological keyset pages without exposing the extra row', async () => {
    const client = fakeClient({
      data: [
        messageRow('message-3', '2026-07-26T03:00:00.000Z'),
        messageRow('message-2', '2026-07-26T02:00:00.000Z'),
        messageRow('message-1', '2026-07-26T01:00:00.000Z'),
      ],
      error: null,
    })

    const repository = createSupabaseMessagingRepository(client)
    const page = await repository.listMessages(
      'organization-1',
      'channel-1',
      undefined,
      2,
    )

    expect(page.items.map((message) => message.id)).toEqual([
      'message-2',
      'message-3',
    ])
    expect(page.nextCursor).toEqual({
      createdAt: '2026-07-26T02:00:00.000Z',
      id: 'message-2',
    })
  })
})

function fakeClient(result: { data: unknown; error: unknown }) {
  const builder = createBuilder(result)
  return {
    from: vi.fn(() => builder),
  } as unknown as typeof supabase
}

function createBuilder(result: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    or: vi.fn(),
    in: vi.fn(),
    single: vi.fn().mockResolvedValue(result),
    then: (
      onFulfilled: (value: typeof result) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(onFulfilled, onRejected),
  }
  builder.select.mockReturnValue(builder)
  builder.eq.mockReturnValue(builder)
  builder.order.mockReturnValue(builder)
  builder.limit.mockReturnValue(builder)
  builder.or.mockReturnValue(builder)
  builder.in.mockReturnValue(builder)
  return builder
}

function activeMembership(memberId: string, canSend: boolean) {
  return {
    member_id: memberId,
    can_send: canSend,
    starts_at: '2026-01-01T00:00:00.000Z',
    expires_at: null,
    archived_at: null,
  }
}

function messageRow(id: string, createdAt: string) {
  return {
    id,
    organization_id: 'organization-1',
    channel_id: 'channel-1',
    author_member_id: 'member-1',
    client_message_id: `${id}-client`,
    body: id,
    is_urgent: false,
    created_at: createdAt,
  }
}
