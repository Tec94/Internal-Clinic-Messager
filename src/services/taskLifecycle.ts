import type { Task, TaskStatus, TaskTransitionAction, UserRole } from '../types/domain'
import { isManager } from './permissions'

// Mirrors the task RPCs in supabase/migrations/20260803092157_add_task_delegation_work_agenda.sql.
export type TaskLifecycleAction = TaskTransitionAction | 'accept' | 'decline' | 'check' | 'reassign'

export interface TaskMember {
  id: string
  role: UserRole
}

type LifecycleTask = Pick<Task, 'status' | 'ownerId' | 'createdById' | 'collaboratorIds' | 'checklist'>

const active: TaskStatus[] = ['accepted', 'inProgress']
const reasonRequired: TaskLifecycleAction[] = ['decline', 'block', 'reopen', 'cancel', 'reassign']

const statusAfter = (task: LifecycleTask, action: TaskLifecycleAction): TaskStatus | null => {
  const completed = task.checklist.filter((item) => item.completed).length
  switch (action) {
    case 'accept': return task.status === 'pendingAcceptance' ? 'accepted' : null
    case 'decline': return task.status === 'pendingAcceptance' ? 'declined' : null
    // For 'check', pass the task with the checklist after the change.
    case 'check':
      if (!active.includes(task.status)) return null
      return task.checklist.length > 0 && completed === task.checklist.length ? 'done' : completed > 0 ? 'inProgress' : 'accepted'
    case 'block': return active.includes(task.status) ? 'blocked' : null
    case 'unblock': return task.status === 'blocked' ? (completed > 0 ? 'inProgress' : 'accepted') : null
    case 'complete': return active.includes(task.status) && task.checklist.length === 0 ? 'done' : null
    case 'reopen': return task.status === 'done' ? (task.checklist.length > 0 ? 'inProgress' : 'accepted') : null
    case 'cancel': return ['done', 'canceled'].includes(task.status) ? null : 'canceled'
    // Becomes 'accepted' when the manager reassigns the task to themselves.
    case 'reassign': return ['done', 'canceled'].includes(task.status) ? null : 'pendingAcceptance'
  }
}

export const nextStatus = (task: LifecycleTask, action: TaskLifecycleAction, reason?: string): TaskStatus | null =>
  reasonRequired.includes(action) && !reason?.trim() ? null : statusAfter(task, action)

export const allowedActions = (task: LifecycleTask, member: TaskMember): TaskLifecycleAction[] => {
  const isOwner = task.ownerId === member.id
  // shortcut: SQL also limits location managers and department leads to their scope, the server enforces it.
  const canManage = task.createdById === member.id || isManager(member)
  const permitted: Record<TaskLifecycleAction, boolean> = {
    accept: isOwner,
    decline: isOwner,
    check: isOwner || task.collaboratorIds.includes(member.id),
    block: isOwner || canManage,
    unblock: isOwner || canManage,
    complete: isOwner,
    reopen: canManage,
    cancel: canManage,
    reassign: canManage,
  }
  return (Object.keys(permitted) as TaskLifecycleAction[])
    .filter((action) => permitted[action] && statusAfter(task, action) !== null)
}
