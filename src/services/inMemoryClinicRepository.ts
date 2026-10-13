import * as seed from '../data/seed'
import type {
  Channel,
  Message,
  Task,
  TaskEvent,
  TaskTransitionAction,
} from '../types/domain'
import type {
  ClinicRepository,
  ClinicSnapshot,
  PreviewChatRepository,
  PreviewChatState,
  RepositoryScope,
} from './clinicRepository'
import { canSendMessageInChannel } from './permissions'
import { allowedActions, nextStatus, type TaskLifecycleAction } from './taskLifecycle'
import { mockUploadAdapter } from './uploadAdapter'

export type PreviewSnapshot = ClinicSnapshot & { chat: PreviewChatState }

export interface InMemoryClinicRepository extends ClinicRepository, PreviewChatRepository {
  loadSnapshot: (scope?: RepositoryScope) => Promise<PreviewSnapshot>
  // Synchronous read, so Preview mode renders without a loading state.
  peekSnapshot: () => PreviewSnapshot
}

const eventTypes: Record<TaskTransitionAction, TaskEvent['type']> = {
  block: 'blocked', unblock: 'unblocked', complete: 'completed', reopen: 'reopened', cancel: 'canceled',
}

// Preview mode adapter: synthetic seed data, held in memory. Nothing is durable.
export function createInMemoryClinicRepository(): InMemoryClinicRepository {
  let state: PreviewSnapshot = {
    organization: seed.organization,
    locations: seed.locations,
    departments: seed.departments,
    users: seed.users,
    assignments: seed.assignments,
    roleBindings: seed.roleBindings,
    tasks: seed.tasks,
    taskEvents: [],
    taskTemplates: [],
    taskSchedules: [],
    attachments: seed.attachments,
    meetings: seed.meetings,
    meetingResponses: seed.meetingResponses,
    announcements: seed.announcements,
    accessRequests: seed.accessRequests,
    auditEvents: seed.auditEvents,
    chat: { channels: seed.channels, memberships: seed.memberships, messages: seed.messages },
  }
  const update = (patch: Partial<PreviewSnapshot>) => { state = { ...state, ...patch } }
  const updateChat = (patch: Partial<PreviewChatState>) => update({ chat: { ...state.chat, ...patch } })

  const member = (scope: RepositoryScope) => {
    const binding = state.roleBindings.find((item) => item.userId === scope.memberId)
    if (!binding) throw new Error('The account has no active role assignment.')
    return { id: scope.memberId, role: binding.role, binding }
  }
  const findTask = (taskId: string) => {
    const task = state.tasks.find((item) => item.id === taskId)
    if (!task) throw new Error('The task could not be found.')
    return task
  }
  const requireAction = (scope: RepositoryScope, task: Task, action: TaskLifecycleAction, reason?: string) => {
    const next = allowedActions(task, member(scope)).includes(action) ? nextStatus(task, action, reason) : null
    if (!next) throw new Error(`The task cannot ${action} now.`)
    return next
  }
  const patchTask = (taskId: string, patch: Partial<Task>) => {
    update({ tasks: state.tasks.map((item) => item.id === taskId ? { ...item, ...patch } : item) })
  }
  const appendTaskEvent = (
    scope: RepositoryScope,
    task: Task,
    type: TaskEvent['type'],
    toStatus: Task['status'],
    reason?: string,
  ) => {
    const createdAt = new Date().toISOString()
    update({ taskEvents: [...state.taskEvents, {
      id: `task-event-${Date.now()}-${type}`,
      taskId: task.id,
      actorId: scope.memberId,
      type,
      fromStatus: task.status,
      toStatus,
      reason,
      metadata: {},
      createdAt,
    }] })
    if (type === 'started') return
    updateChat({ messages: [...state.chat.messages, {
      id: `message-${Date.now()}-${type}`,
      channelId: task.channelId,
      authorId: scope.memberId,
      body: `${type === 'completed' ? 'Task completed' : `Task ${type}`}: ${task.title}${reason ? ` — ${reason}` : ''}`,
      createdAt,
      isUrgent: false,
      attachmentIds: [],
      taskId: task.id,
    }] })
  }
  const addChannel = (channel: Channel, joinedAt: string) => updateChat({
    channels: [...state.chat.channels, channel],
    memberships: [
      ...state.chat.memberships,
      ...channel.memberIds.map((userId, index) => ({
        id: `${channel.id}-member-${index}`,
        channelId: channel.id,
        userId,
        source: 'invitation' as const,
        joinedAt,
        expiresAt: channel.archiveAt,
      })),
    ],
  })

  return {
    peekSnapshot: () => state,
    loadSnapshot: async () => state,

    async createChannel(scope, input) {
      const channel: Channel = {
        id: `${input.name}-${Date.now()}`,
        name: input.name,
        displayName: input.name
          .split('-')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' '),
        purpose: input.purpose,
        type: 'interface',
        visibility: input.visibility,
        locationIds: [input.locationId],
        departmentIds: input.departmentIds,
        ownerId: scope.memberId,
        memberIds: state.users
          .filter((user) => state.assignments.some((assignment) =>
            assignment.userId === user.id && input.departmentIds.includes(assignment.departmentId)))
          .map((user) => user.id),
        unreadCount: 0,
        isUrgent: input.urgent,
        archiveAt: input.archivePolicy === 'indefinite'
          ? undefined
          : new Date(Date.now() + (input.archivePolicy === '24h' ? 1 : 7) * 86_400_000).toISOString(),
      }
      addChannel(channel, new Date().toISOString())
      return channel.id
    },

    async ensureDirectChannel(scope, targetMemberId) {
      const targetUser = state.users.find((user) => user.id === targetMemberId)
      if (!targetUser || targetMemberId === scope.memberId) {
        throw new Error('Could not open the direct conversation.')
      }
      const participantIds = [scope.memberId, targetMemberId].sort()
      const directId = `dm-${participantIds.join('-')}`
      if (state.chat.channels.some((channel) => channel.id === directId)) return directId
      const primary = (userId: string) =>
        state.assignments.find((assignment) => assignment.userId === userId && assignment.isPrimary)
      const assigned = [primary(scope.memberId), primary(targetMemberId)]
      addChannel({
        id: directId,
        name: `dm-${targetUser.name.toLowerCase().replace(/\s+/g, '-')}`,
        displayName: targetUser.name,
        purpose: `Direct operational conversation with ${targetUser.name}.`,
        type: 'direct',
        visibility: 'private',
        locationIds: Array.from(new Set(assigned.flatMap((item) => item ? [item.locationId] : []))),
        departmentIds: Array.from(new Set(assigned.flatMap((item) => item ? [item.departmentId] : []))),
        ownerId: scope.memberId,
        memberIds: participantIds,
        unreadCount: 0,
        isUrgent: false,
      }, new Date().toISOString())
      return directId
    },

    async createTask(scope, input) {
      const createdAt = new Date().toISOString()
      const taskId = `task-${Date.now()}`
      const messageId = `message-${Date.now()}-task`
      const selfAssigned = input.ownerId === scope.memberId
      const attachmentIds = input.attachmentIds ?? []
      update({
        tasks: [{
          id: taskId,
          title: input.title,
          channelId: input.channelId,
          ownerId: input.ownerId,
          createdById: scope.memberId,
          collaboratorIds: input.collaboratorIds,
          dueAt: input.dueAt,
          status: selfAssigned ? 'accepted' : 'pendingAcceptance',
          acceptedAt: selfAssigned ? createdAt : undefined,
          statusChangedAt: createdAt,
          checklist: input.checklist.map((label, index) => ({
            id: `${taskId}-check-${index}`,
            label,
            completed: false,
          })),
          attachmentIds,
          sourceMessageId: input.sourceMessageId ?? messageId,
        }, ...state.tasks],
        attachments: state.attachments.map((attachment) => attachmentIds.includes(attachment.id)
          ? { ...attachment, channelId: input.channelId, taskId, messageId }
          : attachment),
      })
      updateChat({ messages: [...state.chat.messages, {
        id: messageId,
        channelId: input.channelId,
        authorId: scope.memberId,
        body: `Assigned task: ${input.title}`,
        createdAt,
        isUrgent: false,
        attachmentIds,
        taskId,
      }] })
      return taskId
    },

    async setTaskChecklistItem(scope, taskId, itemId, completed) {
      const task = findTask(taskId)
      const checklist = task.checklist.map((item) => item.id === itemId
        ? { ...item, completed, completedAt: completed ? new Date().toISOString() : undefined, completedById: completed ? scope.memberId : undefined }
        : item)
      const status = requireAction(scope, { ...task, checklist }, 'check')
      patchTask(taskId, { checklist, status })
    },

    async respondToTask(scope, taskId, response, reason) {
      const task = findTask(taskId)
      const next = requireAction(scope, task, response, reason)
      const changedAt = new Date().toISOString()
      patchTask(taskId, {
        status: next,
        acceptedAt: response === 'accept' ? changedAt : undefined,
        declinedAt: response === 'decline' ? changedAt : undefined,
        statusReason: response === 'decline' ? reason : undefined,
        statusChangedAt: changedAt,
      })
      appendTaskEvent(scope, task, response === 'accept' ? 'accepted' : 'declined', next, reason)
    },

    async transitionTask(scope, taskId, action, reason, reopenItemId) {
      const task = findTask(taskId)
      const next = requireAction(scope, task, action, reason)
      if (action === 'reopen' && task.checklist.length > 0
        && !task.checklist.some((check) => check.id === reopenItemId && check.completed)) {
        throw new Error('Choose a completed checklist item to reopen.')
      }
      const changedAt = new Date().toISOString()
      patchTask(taskId, {
        status: next,
        checklist: action === 'reopen' && reopenItemId
          ? task.checklist.map((check) => check.id === reopenItemId
            ? { ...check, completed: false, completedAt: undefined, completedById: undefined }
            : check)
          : task.checklist,
        blockedAt: action === 'block' ? changedAt : undefined,
        completedAt: action === 'complete' ? changedAt : undefined,
        canceledAt: action === 'cancel' ? changedAt : undefined,
        statusReason: action === 'block' || action === 'cancel' ? reason : undefined,
        statusChangedAt: changedAt,
      })
      appendTaskEvent(scope, task, eventTypes[action], next, reason)
    },

    async reassignTask(scope, taskId, ownerId, reason) {
      const task = findTask(taskId)
      requireAction(scope, task, 'reassign', reason)
      const selfAssigned = ownerId === scope.memberId
      const next = selfAssigned ? 'accepted' : 'pendingAcceptance'
      const changedAt = new Date().toISOString()
      patchTask(taskId, {
        ownerId,
        status: next,
        acceptedAt: selfAssigned ? changedAt : undefined,
        statusReason: undefined,
        statusChangedAt: changedAt,
      })
      appendTaskEvent(scope, task, 'reassigned', next, reason)
    },

    async setTaskScheduleActive(_scope, scheduleId, active) {
      update({ taskSchedules: state.taskSchedules.map((item) => item.id === scheduleId ? { ...item, active } : item) })
    },

    async createMeeting(scope, input) {
      const createdAt = new Date().toISOString()
      const meetingId = `meeting-${Date.now()}`
      const messageId = `message-${Date.now()}-meeting`
      const channel = state.chat.channels.find((item) => item.id === input.channelId)
      update({
        meetings: [...state.meetings, {
          id: meetingId,
          channelId: input.channelId,
          messageId,
          organizerId: scope.memberId,
          title: input.title,
          provider: input.provider,
          joinUrl: input.joinUrl,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          timezone: input.timezone,
          attendeeIds: channel?.memberIds ?? [scope.memberId],
          createdAt,
        }],
        meetingResponses: [...state.meetingResponses, {
          id: `response-${meetingId}-${scope.memberId}`,
          meetingId,
          userId: scope.memberId,
          status: 'accepted',
          respondedAt: createdAt,
        }],
      })
      updateChat({ messages: [...state.chat.messages, {
        id: messageId,
        channelId: input.channelId,
        authorId: scope.memberId,
        body: input.body,
        createdAt,
        isUrgent: false,
        attachmentIds: [],
        meetingId,
      }] })
      return meetingId
    },

    async respondToMeeting(scope, meetingId, status) {
      update({ meetingResponses: [
        ...state.meetingResponses.filter((item) => !(item.meetingId === meetingId && item.userId === scope.memberId)),
        {
          id: `response-${meetingId}-${scope.memberId}`,
          meetingId,
          userId: scope.memberId,
          status,
          respondedAt: new Date().toISOString(),
        },
      ] })
    },

    async createAnnouncement(scope, input) {
      const id = `announcement-${Date.now()}`
      update({ announcements: [{
        ...input,
        id,
        authorId: scope.memberId,
        publishedAt: input.status === 'published' ? new Date().toISOString() : undefined,
        attachmentIds: [],
      }, ...state.announcements] })
      return id
    },

    // shortcut: Preview mode does not keep organization, location, or member assignment edits; persist them if demos need them.
    async saveOrganizationSettings() {},
    async saveLocation(_scope, input) {
      if (input.id && state.locations.some((location) => location.id === input.id)) return input.id
      const id = input.id ?? `location-${Date.now()}`
      update({ locations: [...state.locations, { ...input, id, departmentIds: [] }] })
      return id
    },
    async saveMemberAssignment() {},

    async resolveAccessRequest(_scope, requestId, status) {
      update({ accessRequests: state.accessRequests.map((request) => request.id === requestId ? { ...request, status } : request) })
    },

    async sendMessage(scope, input) {
      const binding = member(scope).binding
      if (!canSendMessageInChannel(binding, scope.memberId, state.chat.channels.find((item) => item.id === input.channelId))) {
        return null
      }
      const message: Message = {
        id: `message-${Date.now()}`,
        channelId: input.channelId,
        authorId: scope.memberId,
        body: input.body,
        createdAt: new Date().toISOString(),
        isUrgent: input.urgent,
        attachmentIds: input.attachmentIds ?? [],
        taskId: input.taskId,
        meetingId: input.meetingId,
      }
      updateChat({ messages: [...state.chat.messages, message] })
      if (message.attachmentIds.length > 0) {
        update({ attachments: state.attachments.map((attachment) => message.attachmentIds.includes(attachment.id)
          ? { ...attachment, messageId: message.id, channelId: message.channelId }
          : attachment) })
      }
      return message
    },

    async uploadAttachments(scope, files, target) {
      const uploaded = await mockUploadAdapter.upload(files, target, scope.memberId)
      update({ attachments: [...uploaded, ...state.attachments] })
      return uploaded
    },
  }
}
