import { describe, expect, it, vi } from 'vitest'
import { createSupabaseClinicRepository } from '../services/supabaseClinicRepository'
import { supabase } from '../utils/supabase'

describe('Supabase clinic task repository', () => {
  it('coalesces overlapping refreshes and returns the newer snapshot to every caller', async () => {
    const harness = createSnapshotHarness()
    const first = harness.repository.loadSnapshot(harness.scope)
    const second = harness.repository.loadSnapshot(harness.scope)
    const third = harness.repository.loadSnapshot(harness.scope)

    expect(second).toBe(first)
    expect(third).toBe(first)
    expect(harness.from).toHaveBeenCalledTimes(30)
    harness.reads[0].resolve(snapshotOrganization('Before mutation'))
    await harness.nextRead()
    harness.reads[1].resolve(snapshotOrganization('After mutation'))

    const snapshots = await Promise.all([first, second, third])
    expect(snapshots.map((snapshot) => snapshot.organization.name)).toEqual([
      'After mutation', 'After mutation', 'After mutation',
    ])
    expect(harness.from).toHaveBeenCalledTimes(62)
  })

  it('retains a change arriving during the trailing refresh', async () => {
    const harness = createSnapshotHarness()
    const first = harness.repository.loadSnapshot(harness.scope)
    void harness.repository.loadSnapshot(harness.scope)
    harness.reads[0].resolve(snapshotOrganization('First'))
    await harness.nextRead()

    const newest = harness.repository.loadSnapshot(harness.scope)
    harness.reads[1].resolve(snapshotOrganization('Second'))
    await harness.nextRead()
    harness.reads[2].resolve(snapshotOrganization('Latest'))

    expect((await first).organization.name).toBe('Latest')
    expect((await newest).organization.name).toBe('Latest')
    expect(harness.from).toHaveBeenCalledTimes(93)
  })

  it('does not share snapshots across members or cache a completed read', async () => {
    const harness = createSnapshotHarness()
    const first = harness.repository.loadSnapshot(harness.scope)
    const other = harness.repository.loadSnapshot({ ...harness.scope, memberId: 'member-2' })
    expect(other).not.toBe(first)
    expect(harness.from).toHaveBeenCalledTimes(60)
    harness.reads[0].resolve(snapshotOrganization('First member'))
    harness.reads[1].resolve(snapshotOrganization('Other member'))
    expect((await first).organization.name).toBe('First member')
    expect((await other).organization.name).toBe('Other member')

    const fresh = harness.repository.loadSnapshot(harness.scope)
    harness.reads[2].resolve(snapshotOrganization('Fresh'))
    expect((await fresh).organization.name).toBe('Fresh')
    expect(harness.from).toHaveBeenCalledTimes(93)
  })

  it('releases failed refreshes so a subsequent request can recover', async () => {
    const harness = createSnapshotHarness()
    const first = harness.repository.loadSnapshot(harness.scope)
    const second = harness.repository.loadSnapshot(harness.scope)
    const failed = Promise.allSettled([first, second])
    harness.reads[0].resolve({ data: null, error: { message: 'Unavailable' } })
    expect((await failed).map((result) => result.status)).toEqual(['rejected', 'rejected'])

    const retry = harness.repository.loadSnapshot(harness.scope)
    harness.reads[1].resolve(snapshotOrganization('Recovered'))
    expect((await retry).organization.name).toBe('Recovered')
    expect(harness.from).toHaveBeenCalledTimes(61)
  })

  it('maps a bounded task page and returns a keyset cursor', async () => {
    const builder = createBuilder({
      data: [
        taskRow('task-1', '2026-08-04T01:00:00.000Z', [true, false]),
        taskRow('task-2', '2026-08-04T02:00:00.000Z', [true]),
        taskRow('task-3', '2026-08-04T03:00:00.000Z', []),
      ],
      error: null,
    })
    const repository = createSupabaseClinicRepository({
      from: vi.fn(() => builder),
    } as unknown as typeof supabase)

    const page = await repository.listTasks(
      { organizationId: 'organization-1', memberId: 'member-1' },
      {},
      undefined,
      2,
    )

    expect(page.items).toEqual([
      expect.objectContaining({ id: 'task-1', completedItems: 1, totalItems: 2 }),
      expect.objectContaining({ id: 'task-2', completedItems: 1, totalItems: 1 }),
    ])
    expect(page.nextCursor).toBe('2026-08-04T02:00:00.000Z::task-2')
    expect(builder.limit).toHaveBeenCalledWith(3)
  })

  it('applies task filters and advances from the supplied cursor', async () => {
    const builder = createBuilder({ data: [], error: null })
    const repository = createSupabaseClinicRepository({
      from: vi.fn(() => builder),
    } as unknown as typeof supabase)

    await repository.listTasks(
      { organizationId: 'organization-1', memberId: 'member-1' },
      {
        search: 'opening',
        ownerId: 'member-2',
        status: 'pendingAcceptance',
        dueFrom: '2026-08-04T00:00:00.000Z',
        dueTo: '2026-08-05T00:00:00.000Z',
      },
      '2026-08-04T02:00:00.000Z::task-2',
    )

    expect(builder.ilike).toHaveBeenCalledWith('title', '%opening%')
    expect(builder.eq).toHaveBeenCalledWith('owner_member_id', 'member-2')
    expect(builder.eq).toHaveBeenCalledWith('status', 'pending_acceptance')
    expect(builder.gte).toHaveBeenCalledWith('due_at', '2026-08-04T00:00:00.000Z')
    expect(builder.lt).toHaveBeenCalledWith('due_at', '2026-08-05T00:00:00.000Z')
    expect(builder.or).toHaveBeenCalledWith(
      'due_at.gt.2026-08-04T02:00:00.000Z,and(due_at.eq.2026-08-04T02:00:00.000Z,id.gt.task-2)',
    )
  })
})

type QueryResult = { data: unknown; error: unknown }

function createBuilder(result: QueryResult | Promise<QueryResult>) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    ilike: vi.fn(),
    gte: vi.fn(),
    lt: vi.fn(),
    or: vi.fn(),
    single: vi.fn(),
    in: vi.fn(),
    then: (
      onFulfilled: (value: QueryResult) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(onFulfilled, onRejected),
  }
  for (const method of ['select', 'eq', 'is', 'order', 'limit', 'ilike', 'gte', 'lt', 'or', 'single', 'in'] as const) {
    builder[method].mockReturnValue(builder)
  }
  return builder
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((settle) => { resolve = settle })
  return { promise, resolve }
}

function snapshotOrganization(name: string): QueryResult {
  return { data: { id: 'organization-1', name }, error: null }
}

function createSnapshotHarness() {
  const reads: ReturnType<typeof deferred<QueryResult>>[] = []
  let nextRead = deferred<void>()
  const from = vi.fn((table: string) => {
    if (table === 'organizations') {
      const read = deferred<QueryResult>()
      reads.push(read)
      nextRead.resolve()
      nextRead = deferred<void>()
      return createBuilder(read.promise)
    }
    const data = table === 'organization_members'
      ? [{ id: 'member-1', user_id: 'user-1' }]
      : table === 'profiles'
        ? [{ id: 'user-1', full_name: 'Staff', work_email: 'staff@example.test' }]
        : []
    return createBuilder({ data, error: null })
  })
  return {
    repository: createSupabaseClinicRepository({ from } as unknown as typeof supabase),
    scope: { organizationId: 'organization-1', memberId: 'member-1' },
    reads,
    from,
    nextRead: () => nextRead.promise,
  }
}

function taskRow(id: string, dueAt: string, checklist: boolean[]) {
  return {
    id,
    title: id,
    channel_id: 'channel-1',
    owner_member_id: 'member-2',
    created_by_member_id: 'member-1',
    due_at: dueAt,
    status: 'pending_acceptance',
    status_reason: null,
    status_changed_at: '2026-08-03T00:00:00.000Z',
    task_checklist_items: checklist.map((completed) => ({ completed })),
  }
}
