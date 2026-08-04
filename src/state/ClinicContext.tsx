import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { QueryClient, useQuery } from '@tanstack/react-query'
import {
  announcements as seedAnnouncements,
  accessRequests as seedAccessRequests,
  attachments as seedAttachments,
  assignments,
  channels as seedChannels,
  departments,
  locations,
  messages as seedMessages,
  meetingResponses as seedMeetingResponses,
  meetings as seedMeetings,
  memberships as seedMemberships,
  organization,
  auditEvents as seedAuditEvents,
  roleBindings,
  tasks as seedTasks,
  users,
} from '../data/seed'
import { canSendMessageInChannel, hasPermission } from '../services/permissions'
import { createSupabaseClinicRepository } from '../services/supabaseClinicRepository'
import { mockUploadAdapter } from '../services/uploadAdapter'
import type {
  Announcement,
  AccessRequest,
  Channel,
  ChannelMembership,
  CreateMeetingInput,
  CreateAnnouncementInput,
  CreateChannelInput,
  CreateTaskInput,
  Message,
  Meeting,
  MeetingResponse,
  MeetingResponseStatus,
  Permission,
  SaveLocationInput,
  SaveMemberAssignmentInput,
  SaveOrganizationSettingsInput,
  SendMessageInput,
  Task,
  TaskEvent,
  TaskSchedule,
  TaskTemplate,
  TaskTransitionAction,
  Attachment,
  UpdateTaskInput,
  UploadTarget,
  AuditEvent,
} from '../types/domain'
import { supabase } from '../utils/supabase'
import { useOptionalAuth } from './AuthContext'

const clinicQueryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 30_000 } },
})

export interface ClinicContextValue {
  organization: typeof organization
  locations: typeof locations
  departments: typeof departments
  users: typeof users
  assignments: typeof assignments
  roleBindings: typeof roleBindings
  channels: Channel[]
  memberships: ChannelMembership[]
  messages: Message[]
  tasks: Task[]
  taskEvents: TaskEvent[]
  taskTemplates: TaskTemplate[]
  taskSchedules: TaskSchedule[]
  attachments: Attachment[]
  meetings: Meeting[]
  meetingResponses: MeetingResponse[]
  announcements: Announcement[]
  accessRequests: AccessRequest[]
  auditEvents: AuditEvent[]
  currentUser: (typeof users)[number]
  currentBinding: (typeof roleBindings)[number]
  currentLocationId: string
  setCurrentUserId: (userId: string) => void
  setCurrentLocationId: (locationId: string) => void
  hasPermission: (permission: Permission) => boolean
  createChannel: (input: CreateChannelInput) => Channel | Promise<Channel>
  canSendMessage: (channelId: string) => boolean
  ensureDirectChannel: (targetUserId: string) => Channel | null
  sendMessage: (input: SendMessageInput) => Message | null
  createTask: (input: CreateTaskInput) => Task | Promise<Task>
  updateTask: (
    taskId: string,
    patch: UpdateTaskInput,
  ) => void | Promise<void>
  respondToTask: (
    taskId: string,
    response: 'accept' | 'decline',
    reason?: string,
  ) => void | Promise<void>
  transitionTask: (
    taskId: string,
    action: TaskTransitionAction,
    reason?: string,
    reopenItemId?: string,
  ) => void | Promise<void>
  reassignTask: (
    taskId: string,
    ownerId: string,
    reason: string,
  ) => void | Promise<void>
  setTaskScheduleActive: (
    scheduleId: string,
    active: boolean,
  ) => void | Promise<void>
  uploadAttachments: (files: File[], target: UploadTarget) => Promise<Attachment[]>
  createMeeting: (input: CreateMeetingInput) => Meeting | Promise<Meeting>
  respondToMeeting: (
    meetingId: string,
    status: MeetingResponseStatus,
  ) => void | Promise<void>
  createAnnouncement: (
    input: CreateAnnouncementInput,
  ) => Announcement | Promise<Announcement>
  saveOrganizationSettings: (
    input: SaveOrganizationSettingsInput,
  ) => void | Promise<void>
  saveLocation: (
    input: SaveLocationInput,
  ) => (typeof locations)[number] | Promise<(typeof locations)[number]>
  saveMemberAssignment: (
    input: SaveMemberAssignmentInput,
  ) => void | Promise<void>
  resolveAccessRequest: (
    requestId: string,
    status: 'approved' | 'denied',
  ) => void | Promise<void>
}

export const ClinicContext = createContext<ClinicContextValue | null>(null)

function getInitialUserId() {
  const saved = localStorage.getItem('clinic-persona')
  return users.some((user) => user.id === saved) ? saved! : 'user-employee'
}

export function ClinicProvider({
  children,
  authEnabled = false,
}: PropsWithChildren<{ authEnabled?: boolean }>) {
  const auth = useOptionalAuth()
  const repository = useMemo(() => createSupabaseClinicRepository(), [])
  const productionEnabled = (
    authEnabled
    && auth?.status === 'active'
    && auth.membership !== null
  )
  const snapshotQuery = useQuery({
    queryKey: [
      'clinic',
      'snapshot',
      auth?.membership?.organizationId,
      auth?.membership?.id,
    ],
    queryFn: () => repository.loadSnapshot({
      organizationId: auth!.membership!.organizationId,
      memberId: auth!.membership!.id,
    }),
    enabled: productionEnabled,
  }, clinicQueryClient)
  const [currentUserId, setCurrentUserIdState] = useState(getInitialUserId)
  const [currentLocationId, setCurrentLocationId] = useState('loc-a')
  const [channels, setChannels] = useState(seedChannels)
  const [memberships, setMemberships] = useState(seedMemberships)
  const [messages, setMessages] = useState(seedMessages)
  const [tasks, setTasks] = useState(seedTasks)
  const [taskEvents, setTaskEvents] = useState<TaskEvent[]>([])
  const [taskTemplates] = useState<TaskTemplate[]>([])
  const [taskSchedules, setTaskSchedules] = useState<TaskSchedule[]>([])
  const [attachments, setAttachments] = useState(seedAttachments)
  const [meetings, setMeetings] = useState(seedMeetings)
  const [meetingResponses, setMeetingResponses] = useState(seedMeetingResponses)
  const [announcements, setAnnouncements] = useState(seedAnnouncements)
  const [accessRequests, setAccessRequests] = useState(seedAccessRequests)
  const refetchSnapshot = snapshotQuery.refetch
  const realtimeOrganizationId = auth?.membership?.organizationId

  const currentUser = users.find((user) => user.id === currentUserId) ?? users[3]
  const currentBinding =
    roleBindings.find((binding) =>
      currentUser.roleBindingIds.includes(binding.id),
    ) ?? roleBindings[3]

  useEffect(() => {
    if (!productionEnabled || !realtimeOrganizationId) return
    const organizationId = realtimeOrganizationId
    const refresh = () => { void refetchSnapshot() }
    const channel = supabase
      .channel(`task-work-agenda:${organizationId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `organization_id=eq.${organizationId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_checklist_items', filter: `organization_id=eq.${organizationId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_events', filter: `organization_id=eq.${organizationId}` }, refresh)
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [productionEnabled, realtimeOrganizationId, refetchSnapshot])

  const setCurrentUserId = (userId: string) => {
    const nextUser = users.find((user) => user.id === userId)
    if (!nextUser) return
    setCurrentUserIdState(userId)
    localStorage.setItem('clinic-persona', userId)
    const nextBinding = roleBindings.find((binding) =>
      nextUser.roleBindingIds.includes(binding.id),
    )
    if (nextBinding && !nextBinding.locationIds.includes(currentLocationId)) {
      setCurrentLocationId(nextBinding.locationIds[0] ?? 'loc-a')
    }
  }

  const createChannel = (input: CreateChannelInput) => {
    const newChannel: Channel = {
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
      ownerId: currentUser.id,
      memberIds: users
        .filter((user) =>
          assignments.some(
            (assignment) =>
              assignment.userId === user.id &&
              input.departmentIds.includes(assignment.departmentId),
          ),
        )
        .map((user) => user.id),
      unreadCount: 0,
      isUrgent: input.urgent,
      archiveAt:
        input.archivePolicy === 'indefinite'
          ? undefined
          : new Date(
              Date.now() +
                (input.archivePolicy === '24h' ? 1 : 7) * 86_400_000,
            ).toISOString(),
    }
    setChannels((items) => [...items, newChannel])
    setMemberships((items) => [
      ...items,
      ...newChannel.memberIds.map((userId, index) => ({
        id: `${newChannel.id}-member-${index}`,
        channelId: newChannel.id,
        userId,
        source: 'invitation' as const,
        joinedAt: new Date().toISOString(),
        expiresAt: newChannel.archiveAt,
      })),
    ])
    return newChannel
  }

  const canSendMessage = (channelId: string) =>
    canSendMessageInChannel(
      currentBinding,
      currentUser.id,
      channels.find((item) => item.id === channelId),
    )

  const ensureDirectChannel = (targetUserId: string) => {
    if (targetUserId === currentUser.id) return null
    const targetUser = users.find((user) => user.id === targetUserId)
    if (!targetUser) return null
    const participantIds = [currentUser.id, targetUserId].sort()
    const directId = `dm-${participantIds.join('-')}`
    const existing = channels.find((channel) => channel.id === directId)
    if (existing) return existing
    const targetAssignment = assignments.find((assignment) => assignment.userId === targetUserId && assignment.isPrimary)
    const currentAssignment = assignments.find((assignment) => assignment.userId === currentUser.id && assignment.isPrimary)
    const locationIds = [currentAssignment?.locationId, targetAssignment?.locationId].filter(
      (locationId): locationId is string => Boolean(locationId),
    )
    const departmentIds = [currentAssignment?.departmentId, targetAssignment?.departmentId].filter(
      (departmentId): departmentId is string => Boolean(departmentId),
    )
    const createdAt = new Date().toISOString()
    const newChannel: Channel = {
      id: directId,
      name: `dm-${targetUser.name.toLowerCase().replace(/\s+/g, '-')}`,
      displayName: targetUser.name,
      purpose: `Direct operational conversation with ${targetUser.name}.`,
      type: 'direct',
      visibility: 'private',
      locationIds: Array.from(new Set(locationIds)),
      departmentIds: Array.from(new Set(departmentIds)),
      ownerId: currentUser.id,
      memberIds: participantIds,
      unreadCount: 0,
      isUrgent: false,
    }
    setChannels((items) => [...items, newChannel])
    setMemberships((items) => [
      ...items,
      ...participantIds.map((userId, index) => ({
        id: `${directId}-member-${index}`,
        channelId: directId,
        userId,
        source: 'invitation' as const,
        joinedAt: createdAt,
      })),
    ])
    return newChannel
  }

  const sendMessage = (input: SendMessageInput) => {
    if (!canSendMessage(input.channelId)) return null
    const message: Message = {
      id: `message-${Date.now()}`,
      channelId: input.channelId,
      authorId: currentUser.id,
      body: input.body,
      createdAt: new Date().toISOString(),
      isUrgent: input.urgent,
      attachmentIds: input.attachmentIds ?? [],
      taskId: input.taskId,
      meetingId: input.meetingId,
    }
    setMessages((items) => [...items, message])
    if (message.attachmentIds.length > 0) {
      setAttachments((items) =>
        items.map((attachment) =>
          message.attachmentIds.includes(attachment.id)
            ? { ...attachment, messageId: message.id, channelId: message.channelId }
            : attachment,
        ),
      )
    }
    return message
  }

  const createTask = (input: CreateTaskInput) => {
    const createdAt = new Date().toISOString()
    const taskId = `task-${Date.now()}`
    const messageId = `message-${Date.now()}-task`
    const task: Task = {
      id: taskId,
      title: input.title,
      channelId: input.channelId,
      ownerId: input.ownerId,
      createdById: currentUser.id,
      collaboratorIds: input.collaboratorIds,
      dueAt: input.dueAt,
      status: input.ownerId === currentUser.id ? 'accepted' : 'pendingAcceptance',
      acceptedAt: input.ownerId === currentUser.id ? createdAt : undefined,
      statusChangedAt: createdAt,
      checklist: input.checklist.map((label, index) => ({
        id: `${taskId}-check-${index}`,
        label,
        completed: false,
      })),
      attachmentIds: input.attachmentIds ?? [],
      sourceMessageId: input.sourceMessageId ?? messageId,
    }
    const message: Message = {
      id: messageId,
      channelId: input.channelId,
      authorId: currentUser.id,
      body: `Assigned task: ${input.title}`,
      createdAt,
      isUrgent: false,
      attachmentIds: input.attachmentIds ?? [],
      taskId,
    }
    setTasks((items) => [task, ...items])
    setMessages((items) => [...items, message])
    if (task.attachmentIds.length > 0) {
      setAttachments((items) =>
        items.map((attachment) =>
          task.attachmentIds.includes(attachment.id)
            ? { ...attachment, channelId: input.channelId, taskId, messageId }
            : attachment,
        ),
      )
    }
    return task
  }

  const updateTask = (taskId: string, patch: UpdateTaskInput) => {
    setTasks((items) =>
      items.map((task) => (task.id === taskId ? { ...task, ...patch } : task)),
    )
  }

  const appendTaskEvent = (
    task: Task,
    type: TaskEvent['type'],
    fromStatus: Task['status'],
    toStatus: Task['status'],
    reason?: string,
  ) => {
    const createdAt = new Date().toISOString()
    setTaskEvents((items) => [...items, {
      id: `task-event-${Date.now()}-${type}`,
      taskId: task.id,
      actorId: currentUser.id,
      type,
      fromStatus,
      toStatus,
      reason,
      metadata: {},
      createdAt,
    }])
    if (!['started'].includes(type)) {
      setMessages((items) => [...items, {
        id: `message-${Date.now()}-${type}`,
        channelId: task.channelId,
        authorId: currentUser.id,
        body: `${type === 'completed' ? 'Task completed' : `Task ${type}`}: ${task.title}${reason ? ` — ${reason}` : ''}`,
        createdAt,
        isUrgent: false,
        attachmentIds: [],
        taskId: task.id,
      }])
    }
  }

  const respondToTask = (taskId: string, response: 'accept' | 'decline', reason?: string) => {
    const task = tasks.find((item) => item.id === taskId)
    if (!task || task.ownerId !== currentUser.id || task.status !== 'pendingAcceptance') return
    const nextStatus = response === 'accept' ? 'accepted' : 'declined'
    const changedAt = new Date().toISOString()
    setTasks((items) => items.map((item) => item.id === taskId ? {
      ...item,
      status: nextStatus,
      acceptedAt: response === 'accept' ? changedAt : undefined,
      declinedAt: response === 'decline' ? changedAt : undefined,
      statusReason: response === 'decline' ? reason : undefined,
      statusChangedAt: changedAt,
    } : item))
    appendTaskEvent(task, response === 'accept' ? 'accepted' : 'declined', task.status, nextStatus, reason)
  }

  const transitionTask = (taskId: string, action: TaskTransitionAction, reason?: string, reopenItemId?: string) => {
    const task = tasks.find((item) => item.id === taskId)
    if (!task) return
    const completedCount = task.checklist.filter((item) => item.completed).length
    const nextStatus: Task['status'] = action === 'block'
      ? 'blocked'
      : action === 'unblock'
        ? completedCount > 0 ? 'inProgress' : 'accepted'
        : action === 'complete'
          ? 'done'
          : action === 'cancel'
            ? 'canceled'
            : task.checklist.length > 0 ? 'inProgress' : 'accepted'
    const changedAt = new Date().toISOString()
    setTasks((items) => items.map((item) => item.id === taskId ? {
      ...item,
      status: nextStatus,
      checklist: action === 'reopen' && reopenItemId
        ? item.checklist.map((check) => check.id === reopenItemId ? { ...check, completed: false, completedAt: undefined, completedById: undefined } : check)
        : item.checklist,
      blockedAt: action === 'block' ? changedAt : undefined,
      completedAt: action === 'complete' ? changedAt : undefined,
      canceledAt: action === 'cancel' ? changedAt : undefined,
      statusReason: ['block', 'cancel'].includes(action) ? reason : undefined,
      statusChangedAt: changedAt,
    } : item))
    const eventTypes: Record<TaskTransitionAction, TaskEvent['type']> = {
      block: 'blocked', unblock: 'unblocked', complete: 'completed', reopen: 'reopened', cancel: 'canceled',
    }
    appendTaskEvent(task, eventTypes[action], task.status, nextStatus, reason)
  }

  const reassignTask = (taskId: string, ownerId: string, reason: string) => {
    const task = tasks.find((item) => item.id === taskId)
    if (!task) return
    const nextStatus = ownerId === currentUser.id ? 'accepted' : 'pendingAcceptance'
    const changedAt = new Date().toISOString()
    setTasks((items) => items.map((item) => item.id === taskId ? {
      ...item,
      ownerId,
      status: nextStatus,
      acceptedAt: ownerId === currentUser.id ? changedAt : undefined,
      statusReason: undefined,
      statusChangedAt: changedAt,
    } : item))
    appendTaskEvent(task, 'reassigned', task.status, nextStatus, reason)
  }

  const uploadAttachments = async (files: File[], target: UploadTarget) => {
    const uploaded = await mockUploadAdapter.upload(files, target, currentUser.id)
    setAttachments((items) => [...uploaded, ...items])
    return uploaded
  }

  const createAnnouncement = (input: CreateAnnouncementInput) => {
    const announcement: Announcement = {
      ...input,
      id: `announcement-${Date.now()}`,
      authorId: currentUser.id,
      publishedAt: input.status === 'published' ? new Date().toISOString() : undefined,
      attachmentIds: [],
    }
    setAnnouncements((items) => [announcement, ...items])
    return announcement
  }

  const createMeeting = (input: CreateMeetingInput) => {
    const createdAt = new Date().toISOString()
    const meetingId = `meeting-${Date.now()}`
    const messageId = `message-${Date.now()}-meeting`
    const channel = channels.find((item) => item.id === input.channelId)
    const meeting: Meeting = {
      id: meetingId,
      channelId: input.channelId,
      messageId,
      organizerId: currentUser.id,
      title: input.title,
      provider: input.provider,
      joinUrl: input.joinUrl,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      timezone: input.timezone,
      attendeeIds: channel?.memberIds ?? [currentUser.id],
      createdAt,
    }
    const message: Message = {
      id: messageId,
      channelId: input.channelId,
      authorId: currentUser.id,
      body: input.body,
      createdAt,
      isUrgent: false,
      attachmentIds: [],
      meetingId,
    }
    const organizerResponse: MeetingResponse = {
      id: `response-${meetingId}-${currentUser.id}`,
      meetingId,
      userId: currentUser.id,
      status: 'accepted',
      respondedAt: createdAt,
    }
    setMeetings((items) => [...items, meeting])
    setMessages((items) => [...items, message])
    setMeetingResponses((items) => [...items, organizerResponse])
    return meeting
  }

  const respondToMeeting = (meetingId: string, status: MeetingResponseStatus) => {
    setMeetingResponses((items) => [
      ...items.filter(
        (item) => !(item.meetingId === meetingId && item.userId === currentUser.id),
      ),
      {
        id: `response-${meetingId}-${currentUser.id}`,
        meetingId,
        userId: currentUser.id,
        status,
        respondedAt: new Date().toISOString(),
      },
    ])
  }

  const previewValue: ClinicContextValue = {
    organization,
    locations,
    departments,
    users,
    assignments,
    roleBindings,
    channels,
    memberships,
    messages,
    tasks,
    taskEvents,
    taskTemplates,
    taskSchedules,
    attachments,
    meetings,
    meetingResponses,
    announcements,
    accessRequests,
    auditEvents: seedAuditEvents,
    currentUser,
    currentBinding,
    currentLocationId,
    setCurrentUserId,
    setCurrentLocationId,
    hasPermission: (permission) => hasPermission(currentBinding, permission),
    createChannel,
    canSendMessage,
    ensureDirectChannel,
    sendMessage,
    createTask,
    updateTask,
    respondToTask,
    transitionTask,
    reassignTask,
    setTaskScheduleActive: (scheduleId, active) => {
      setTaskSchedules((items) => items.map((item) => item.id === scheduleId ? { ...item, active } : item))
    },
    uploadAttachments,
    createMeeting,
    respondToMeeting,
    createAnnouncement,
    saveOrganizationSettings: () => {},
    saveLocation: (input) => {
      const existing = locations.find((location) => location.id === input.id)
      return existing ?? {
        ...input,
        id: input.id ?? `location-${Date.now()}`,
        departmentIds: [],
      }
    },
    saveMemberAssignment: () => {},
    resolveAccessRequest: (requestId, status) => {
      setAccessRequests((items) => items.map((request) => (
        request.id === requestId ? { ...request, status } : request
      )))
    },
  }

  if (productionEnabled) {
    if (snapshotQuery.isPending) {
      return <div className="route-loading" role="status">Loading…</div>
    }
    if (snapshotQuery.error || !snapshotQuery.data || !auth?.membership) {
      return (
        <div className="route-loading" role="alert">
          {snapshotQuery.error instanceof Error
            ? snapshotQuery.error.message
            : 'Could not load the workspace.'}
        </div>
      )
    }

    const snapshot = snapshotQuery.data
    const productionCurrentUser = snapshot.users.find(
      (user) => user.id === auth.membership!.id,
    )
    const productionCurrentBinding = snapshot.roleBindings.find(
      (binding) => binding.userId === auth.membership!.id,
    )
    if (!productionCurrentUser || !productionCurrentBinding) {
      return (
        <div className="route-loading" role="alert">
          The account has no active role assignment.
        </div>
      )
    }
    const scope = {
      organizationId: auth.membership.organizationId,
      memberId: auth.membership.id,
    }
    const productionValue: ClinicContextValue = {
      ...snapshot,
      messages: [],
      currentUser: productionCurrentUser,
      currentBinding: productionCurrentBinding,
      currentLocationId: 'all',
      setCurrentUserId: () => {},
      setCurrentLocationId,
      hasPermission: (permission) => hasPermission(
        productionCurrentBinding,
        permission,
      ),
      createChannel: async (input) => {
        const id = await repository.createChannel(scope, input)
        const refreshed = await snapshotQuery.refetch()
        const channel = refreshed.data?.channels.find((item) => item.id === id)
        if (!channel) throw new Error('The created channel could not be loaded.')
        return channel
      },
      canSendMessage: (channelId) => snapshot.memberships.some(
        (membership) => (
          membership.channelId === channelId
          && membership.userId === auth.membership!.id
        ),
      ),
      ensureDirectChannel: () => null,
      sendMessage: () => null,
      createTask: async (input) => {
        const id = await repository.createTask(scope, input)
        const refreshed = await snapshotQuery.refetch()
        const task = refreshed.data?.tasks.find((item) => item.id === id)
        if (!task) throw new Error('The created task could not be loaded.')
        return task
      },
      updateTask: async (taskId, patch) => {
        const task = snapshot.tasks.find((item) => item.id === taskId)
        if (!task || !patch.checklist) return
        const changes = patch.checklist.filter((item) => (
          task.checklist.find((current) => current.id === item.id)?.completed
          !== item.completed
        ))
        await Promise.all(changes.map((item) =>
          repository.setTaskChecklistItem(
            scope,
            taskId,
            item.id,
            item.completed,
          ),
        ))
        await snapshotQuery.refetch()
      },
      respondToTask: async (taskId, response, reason) => {
        await repository.respondToTask(scope, taskId, response, reason)
        await snapshotQuery.refetch()
      },
      transitionTask: async (taskId, action, reason, reopenItemId) => {
        await repository.transitionTask(scope, taskId, action, reason, reopenItemId)
        await snapshotQuery.refetch()
      },
      reassignTask: async (taskId, ownerId, reason) => {
        await repository.reassignTask(scope, taskId, ownerId, reason)
        await snapshotQuery.refetch()
      },
      setTaskScheduleActive: async (scheduleId, active) => {
        await repository.setTaskScheduleActive(scope, scheduleId, active)
        await snapshotQuery.refetch()
      },
      uploadAttachments: async () => {
        throw new Error('Use the authenticated attachment uploader.')
      },
      createMeeting: async (input) => {
        const id = await repository.createMeeting(scope, input)
        const refreshed = await snapshotQuery.refetch()
        const meeting = refreshed.data?.meetings.find((item) => item.id === id)
        if (!meeting) {
          throw new Error('The created meeting could not be loaded.')
        }
        return meeting
      },
      respondToMeeting: async (meetingId, status) => {
        await repository.respondToMeeting(scope, meetingId, status)
        await snapshotQuery.refetch()
      },
      createAnnouncement: async (input) => {
        const id = await repository.createAnnouncement(scope, input)
        const refreshed = await snapshotQuery.refetch()
        const announcement = refreshed.data?.announcements.find(
          (item) => item.id === id,
        )
        if (!announcement) {
          throw new Error('The created announcement could not be loaded.')
        }
        return announcement
      },
      saveOrganizationSettings: async (input) => {
        await repository.saveOrganizationSettings(scope, input)
        await snapshotQuery.refetch()
      },
      saveLocation: async (input) => {
        const id = await repository.saveLocation(scope, input)
        const refreshed = await snapshotQuery.refetch()
        const location = refreshed.data?.locations.find(
          (item) => item.id === id,
        )
        if (!location) {
          throw new Error('The saved location could not be loaded.')
        }
        return location
      },
      saveMemberAssignment: async (input) => {
        await repository.saveMemberAssignment(scope, input)
        await snapshotQuery.refetch()
      },
      resolveAccessRequest: async (requestId, status) => {
        await repository.resolveAccessRequest(scope, requestId, status)
        await snapshotQuery.refetch()
      },
    }
    return (
      <ClinicContext.Provider value={productionValue}>
        {children}
      </ClinicContext.Provider>
    )
  }

  return (
    <ClinicContext.Provider value={previewValue}>
      {children}
    </ClinicContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useClinic() {
  const context = useContext(ClinicContext)
  if (!context) throw new Error('useClinic must be used inside ClinicProvider')
  return context
}
