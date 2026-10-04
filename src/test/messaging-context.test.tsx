import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  MessagingMessage,
  MessagingRepository,
} from '../services/messagingRepository'
import { ClinicProvider } from '../state/ClinicContext'
import {
  MessagingProvider,
  useMessaging,
  useMessagingThread,
} from '../state/MessagingContext'

const authState = vi.hoisted(() => ({
  status: 'active',
  membership: {
    id: 'member-1',
    organizationId: 'organization-1',
  },
}))

vi.mock('../state/AuthContext', () => ({
  useAuth: () => authState,
  useOptionalAuth: () => ({
    status: 'active',
    membership: {
      id: 'member-1',
      organizationId: 'organization-1',
    },
  }),
}))

describe('authenticated messaging context', () => {
  let realtimeMessage: ((message: MessagingMessage) => void) | undefined
  let repository: MessagingRepository

  beforeEach(() => {
    authState.status = 'active'
    authState.membership.id = 'member-1'
    realtimeMessage = undefined
    repository = {
      listChannels: vi.fn().mockResolvedValue([{
        id: 'channel-1',
        organizationId: 'organization-1',
        name: 'operations',
        displayName: 'Operations',
        purpose: 'Coordinate operational work.',
        type: 'department',
        visibility: 'private',
        ownerMemberId: 'member-1',
        locationIds: [],
        departmentIds: [],
        memberIds: ['member-1'],
        memberCount: 1,
        canSend: true,
        isUrgent: false,
        archiveAt: null,
      }]),
      listMembers: vi.fn().mockResolvedValue([{
        memberId: 'member-1',
        userId: 'user-1',
        fullName: 'Verified Staff',
        workEmail: 'staff@example.test',
        employmentType: 'employee',
        status: 'active',
      }]),
      listMessages: vi.fn().mockResolvedValue({
        items: [message('message-1', 'Initial message')],
        nextCursor: null,
      }),
      sendMessage: vi.fn().mockResolvedValue(
        message('message-2', 'Sent message'),
      ),
      subscribeToMessages: vi.fn((_channelId, onMessage) => {
        realtimeMessage = onMessage
        return { unsubscribe: vi.fn().mockResolvedValue(undefined) }
      }),
    }
  })

  it('discards private cached data when access ends and refetches on return', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 30_000 } },
    })
    const tree = () => (
      <QueryClientProvider client={queryClient}>
        <ClinicProvider>
          <MessagingProvider authEnabled repository={repository}>
            <MessagingProbe />
          </MessagingProvider>
        </ClinicProvider>
      </QueryClientProvider>
    )
    const view = render(tree())
    expect(await screen.findByText('Initial message')).toBeInTheDocument()
    authState.status = 'signedOut'
    view.rerender(tree())
    await waitFor(() => expect(
      queryClient.getQueryCache().findAll({ queryKey: ['messaging'] })
        .some((query) => query.state.data !== undefined),
    ).toBe(false))
    realtimeMessage?.(message('message-9', 'Late message'))
    expect(queryClient.getQueryCache().findAll({ queryKey: ['messaging'] })
      .some((query) => query.state.data !== undefined)).toBe(false)
    expect(screen.queryByText('Initial message')).not.toBeInTheDocument()
    vi.mocked(repository.listMessages).mockResolvedValue({ items: [], nextCursor: null })
    authState.status = 'active'
    view.rerender(tree())
    await waitFor(() => expect(repository.listMessages).toHaveBeenCalledTimes(2))
    expect(screen.queryByText('Initial message')).not.toBeInTheDocument()
  })

  it('loads authenticated data, sends, and deduplicates Realtime inserts', async () => {
    const user = userEvent.setup()
    renderMessaging(<MessagingProbe />, repository)

    expect(await screen.findByText('Operations')).toBeInTheDocument()
    expect(await screen.findByText('Verified Staff')).toBeInTheDocument()
    expect(await screen.findByText('Initial message')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Send test message' }))
    expect(await screen.findByText('Sent message')).toBeInTheDocument()

    realtimeMessage?.(message('message-2', 'Sent message'))
    realtimeMessage?.(message('message-3', 'Realtime message'))

    expect(await screen.findByText('Realtime message')).toBeInTheDocument()
    expect(screen.getAllByText('Sent message')).toHaveLength(1)
    expect(repository.sendMessage).toHaveBeenCalledWith({
      organizationId: 'organization-1',
      channelId: 'channel-1',
      authorMemberId: 'member-1',
      body: 'Sent message',
      isUrgent: false,
      attachmentIds: [],
    })
  })
})

function MessagingProbe() {
  const messaging = useMessaging()
  const thread = useMessagingThread('channel-1')
  return (
    <div>
      <span>{messaging.channels[0]?.displayName}</span>
      <span>{messaging.members[0]?.fullName}</span>
      {thread.messages.map((item) => <p key={item.id}>{item.body}</p>)}
      <button
        type="button"
        onClick={() => void messaging.sendMessage({
          channelId: 'channel-1',
          body: 'Sent message',
          urgent: false,
        })}
      >
        Send test message
      </button>
    </div>
  )
}

function renderMessaging(
  children: React.ReactNode,
  repository: MessagingRepository,
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <ClinicProvider>
        <MessagingProvider authEnabled repository={repository}>
          {children}
        </MessagingProvider>
      </ClinicProvider>
    </QueryClientProvider>,
  )
}

function message(id: string, body: string): MessagingMessage {
  return {
    id,
    organizationId: 'organization-1',
    channelId: 'channel-1',
    authorMemberId: 'member-1',
    clientMessageId: `${id}-client`,
    body,
    isUrgent: false,
    createdAt: `2026-07-26T03:00:0${id.at(-1)}.000Z`,
    attachmentIds: [],
    attachments: [],
  }
}
