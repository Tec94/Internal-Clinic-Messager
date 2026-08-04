import { describe, expect, it, vi } from 'vitest'
import { createSupabaseClinicRepository } from '../services/supabaseClinicRepository'
import { supabase } from '../utils/supabase'

describe('Supabase clinic task repository', () => {
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

function createBuilder(result: { data: unknown; error: unknown }) {
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
    then: (
      onFulfilled: (value: typeof result) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(onFulfilled, onRejected),
  }
  for (const method of ['select', 'eq', 'is', 'order', 'limit', 'ilike', 'gte', 'lt', 'or'] as const) {
    builder[method].mockReturnValue(builder)
  }
  return builder
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
