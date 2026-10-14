import { describe, expect, it } from 'vitest'
import { allowedActions, nextStatus, type TaskLifecycleAction } from '../services/taskLifecycle'
import type { Task, TaskStatus } from '../types/domain'

const item = (id: string, completed: boolean) => ({ id, label: id, completed })
const task = (status: TaskStatus, checklist: Task['checklist'] = []) => ({
  status, ownerId: 'owner', createdById: 'manager', collaboratorIds: ['helper'], checklist,
})
const reason = 'Reason'

// Mirrors supabase/tests/database/task_delegation.test.sql and the RPC guards it exercises.
describe('task lifecycle status rules', () => {
  const statuses: TaskStatus[] = ['pendingAcceptance', 'accepted', 'inProgress', 'blocked', 'done', 'declined', 'canceled']
  const expected: Record<Exclude<TaskLifecycleAction, 'check'>, Partial<Record<TaskStatus, TaskStatus>>> = {
    accept: { pendingAcceptance: 'accepted' },
    decline: { pendingAcceptance: 'declined' },
    block: { accepted: 'blocked', inProgress: 'blocked' },
    unblock: { blocked: 'accepted' },
    complete: { accepted: 'done', inProgress: 'done' },
    reopen: { done: 'accepted' },
    cancel: { pendingAcceptance: 'canceled', accepted: 'canceled', inProgress: 'canceled', blocked: 'canceled', declined: 'canceled' },
    reassign: { pendingAcceptance: 'pendingAcceptance', accepted: 'pendingAcceptance', inProgress: 'pendingAcceptance', blocked: 'pendingAcceptance', declined: 'pendingAcceptance' },
  }
  for (const [action, table] of Object.entries(expected) as [Exclude<TaskLifecycleAction, 'check'>, Partial<Record<TaskStatus, TaskStatus>>][]) {
    for (const status of statuses) {
      it(`${status} × ${action} → ${table[status] ?? 'rejected'}`, () => {
        expect(nextStatus(task(status), action, reason)).toBe(table[status] ?? null)
      })
    }
  }

  it.each([
    ['accepted', [item('a', true), item('b', false)], 'inProgress'],
    ['inProgress', [item('a', true), item('b', true)], 'done'],
    ['inProgress', [item('a', false), item('b', false)], 'accepted'],
    ['blocked', [item('a', true), item('b', false)], null],
    ['done', [item('a', false), item('b', true)], null],
    ['pendingAcceptance', [item('a', true)], null],
  ] as const)('check on %s with %o → %s', (status, checklist, result) => {
    expect(nextStatus(task(status, [...checklist]), 'check')).toBe(result)
  })

  it('cannot complete a checklist task directly', () => {
    expect(nextStatus(task('inProgress', [item('a', true), item('b', false)]), 'complete')).toBeNull()
  })

  it('unblocks to the status held before the block', () => {
    // A task reopened into progress with nothing checked must not fall back to accepted.
    const reopened = { ...task('blocked', [item('a', false)]), statusBeforeBlock: 'inProgress' as const }
    expect(nextStatus(reopened, 'unblock')).toBe('inProgress')
  })

  it('unblocks to in progress when checklist work is complete', () => {
    expect(nextStatus(task('blocked', [item('a', true), item('b', false)]), 'unblock')).toBe('inProgress')
  })

  it('reopens a checklist task to in progress', () => {
    expect(nextStatus(task('done', [item('a', true)]), 'reopen', reason)).toBe('inProgress')
  })

  it.each(['decline', 'block', 'reopen', 'cancel', 'reassign'] as const)('rejects %s without a reason', (action) => {
    const status = { decline: 'pendingAcceptance', block: 'accepted', reopen: 'done', cancel: 'accepted', reassign: 'accepted' } as const
    expect(nextStatus(task(status[action]), action, ' ')).toBeNull()
  })
})

describe('task lifecycle member rules', () => {
  const owner = { id: 'owner', role: 'staff' as const }
  const helper = { id: 'helper', role: 'staff' as const }
  const creator = { id: 'manager', role: 'staff' as const }
  const lead = { id: 'lead', role: 'departmentLead' as const }
  const stranger = { id: 'other', role: 'staff' as const }

  it.each([
    ['pendingAcceptance', owner, ['accept', 'decline']],
    ['pendingAcceptance', creator, ['cancel', 'reassign']],
    ['accepted', owner, ['check', 'block', 'complete']],
    ['accepted', helper, ['check']],
    ['accepted', lead, ['block', 'cancel', 'reassign']],
    ['blocked', owner, ['unblock']],
    ['blocked', creator, ['unblock', 'cancel', 'reassign']],
    ['done', owner, []],
    ['done', creator, ['reopen']],
    ['declined', creator, ['cancel', 'reassign']],
    ['canceled', creator, []],
    ['accepted', stranger, []],
  ] as const)('%s for %o allows %o', (status, member, actions) => {
    expect(allowedActions(task(status), member)).toEqual(actions)
  })

  it('a manager cannot accept for the assigned owner', () => {
    expect(allowedActions(task('pendingAcceptance'), creator)).not.toContain('accept')
  })
})
