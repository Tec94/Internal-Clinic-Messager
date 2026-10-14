import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ClinicRepository } from '../services/clinicRepository'
import {
  createInMemoryClinicRepository,
  type InMemoryClinicRepository,
} from '../services/inMemoryClinicRepository'
import { ClinicProvider, useClinic } from '../state/ClinicContext'

const harness = vi.hoisted(() => ({
  auth: null as null | { status: 'active'; membership: { id: string; organizationId: string } },
  backend: null as unknown,
}))

vi.mock('../state/AuthContext', () => ({
  useOptionalAuth: () => harness.auth,
}))

// The signed-in adapter, backed by in-memory data instead of a Supabase client.
// Like production, its snapshot has no Chat: Channels come from the messaging query.
vi.mock('../services/supabaseClinicRepository', () => ({
  createSupabaseClinicRepository: (): ClinicRepository => {
    const backend = harness.backend as InMemoryClinicRepository
    return {
      ...backend,
      loadSnapshot: async (scope) => {
        const snapshot = await backend.loadSnapshot(scope)
        return { ...snapshot, chat: undefined }
      },
    }
  },
}))

const memberId = 'user-employee'
const organizationId = 'org-yksg'

function renderClinic(mode: 'preview' | 'signed in') {
  const backend = createInMemoryClinicRepository()
  harness.backend = backend
  harness.auth = mode === 'signed in'
    ? { status: 'active', membership: { id: memberId, organizationId } }
    : null
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  if (mode === 'signed in') {
    void queryClient.prefetchQuery({
      queryKey: ['messaging', 'channels', organizationId, memberId],
      queryFn: () => backend.peekSnapshot().chat.channels,
    })
  }
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>
      <ClinicProvider authEnabled={mode === 'signed in'}>{children}</ClinicProvider>
    </QueryClientProvider>
  )
  return { backend, ...renderHook(() => useClinic(), { wrapper }) }
}

describe.each(['preview', 'signed in'] as const)('ClinicProvider (%s)', (mode) => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('shows a created task in the snapshot', async () => {
    const { result } = renderClinic(mode)
    await waitFor(() => expect(result.current).toBeTruthy())
    expect(result.current.preview === null).toBe(mode === 'signed in')

    let created: Awaited<ReturnType<typeof result.current.createTask>> | undefined
    await act(async () => {
      created = await result.current.createTask({
        title: 'Restock the front desk',
        channelId: 'front-desk-home',
        ownerId: 'user-lead',
        collaboratorIds: [],
        dueAt: '2026-07-07T10:00:00+07:00',
        checklist: ['Count forms'],
      })
    })

    expect(created?.status).toBe('pendingAcceptance')
    expect(created?.createdById).toBe(memberId)
    await waitFor(() => expect(result.current.tasks.find((task) => task.id === created?.id)?.title)
      .toBe('Restock the front desk'))
  })

  it('rejects a transition that the task lifecycle does not allow', async () => {
    const { result } = renderClinic(mode)
    await waitFor(() => expect(result.current).toBeTruthy())

    // The owner is not a manager or the creator, so the owner cannot cancel.
    await expect(
      result.current.transitionTask('task-terminal', 'cancel', 'Not needed'),
    ).rejects.toThrow()
    expect(result.current.tasks.find((task) => task.id === 'task-terminal')?.status)
      .toBe('inProgress')
  })

  it('reuses the direct channel when it is opened again', async () => {
    const { result, backend } = renderClinic(mode)
    const channels = () => result.current.preview?.channels ?? backend.peekSnapshot().chat.channels
    await waitFor(() => expect(result.current).toBeTruthy())

    const opened: Array<string | null> = []
    await act(async () => {
      opened.push(await result.current.ensureDirectChannel('user-manager'))
      opened.push(await result.current.ensureDirectChannel('user-manager'))
    })

    expect(opened).toEqual(['dm-user-employee-user-manager', 'dm-user-employee-user-manager'])
    await waitFor(() => expect(channels().filter((channel) => channel.type === 'direct')).toHaveLength(1))
    expect(await result.current.ensureDirectChannel(memberId)).toBeNull()
  })

  it('completes a task when the last checklist item is checked', async () => {
    const { result } = renderClinic(mode)
    await waitFor(() => expect(result.current).toBeTruthy())
    const task = result.current.tasks.find((item) => item.id === 'task-terminal')!

    await act(async () => {
      await result.current.updateTask(task.id, {
        checklist: task.checklist.map((item) => ({ ...item, completed: true })),
      })
    })

    await waitFor(() => expect(result.current.tasks.find((item) => item.id === task.id)?.status).toBe('done'))
  })
})

describe('ClinicProvider Preview mode capabilities', () => {
  it('switches the persona and keeps the Location in the persona scope', async () => {
    const { result } = renderClinic('preview')
    act(() => result.current.setCurrentLocationId('loc-b'))
    act(() => result.current.preview!.setCurrentUserId('user-manager'))

    expect(result.current.currentUser.id).toBe('user-manager')
    expect(result.current.currentBinding.role).toBe('locationManager')
    expect(result.current.currentLocationId).toBe('loc-a')
  })

  it('sends a preview message only where the persona can send', async () => {
    const { result } = renderClinic('preview')
    let sent: Awaited<ReturnType<NonNullable<typeof result.current.preview>['sendMessage']>> = null
    await act(async () => {
      sent = await result.current.preview!.sendMessage({
        channelId: 'front-desk-home',
        body: 'Front desk is open.',
        urgent: false,
      })
    })
    await waitFor(() => expect(result.current.preview!.messages.some((message) => message.id === sent?.id)).toBe(true))
    expect(await result.current.preview!.sendMessage({
      channelId: 'exec-briefing',
      body: 'Not a member here.',
      urgent: false,
    })).toBeNull()
  })
})
