import {
  createContext,
  type PropsWithChildren,
  useContext,
  useState,
} from 'react'
import {
  announcements as seedAnnouncements,
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
  roleBindings,
  tasks as seedTasks,
  users,
} from '../data/seed'
import { canSendMessageInChannel, hasPermission } from '../services/permissions'
import { mockUploadAdapter } from '../services/uploadAdapter'
import type {
  Announcement,
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
  SendMessageInput,
  Task,
  Attachment,
  UpdateTaskInput,
  UploadTarget,
} from '../types/domain'

interface ClinicContextValue {
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
  attachments: Attachment[]
  meetings: Meeting[]
  meetingResponses: MeetingResponse[]
  announcements: Announcement[]
  currentUser: (typeof users)[number]
  currentBinding: (typeof roleBindings)[number]
  currentLocationId: string
  setCurrentUserId: (userId: string) => void
  setCurrentLocationId: (locationId: string) => void
  hasPermission: (permission: Permission) => boolean
  createChannel: (input: CreateChannelInput) => Channel
  canSendMessage: (channelId: string) => boolean
  ensureDirectChannel: (targetUserId: string) => Channel | null
  sendMessage: (input: SendMessageInput) => Message | null
  createTask: (input: CreateTaskInput) => Task
  updateTask: (taskId: string, patch: UpdateTaskInput) => void
  uploadAttachments: (files: File[], target: UploadTarget) => Promise<Attachment[]>
  createMeeting: (input: CreateMeetingInput) => Meeting
  respondToMeeting: (meetingId: string, status: MeetingResponseStatus) => void
  createAnnouncement: (input: CreateAnnouncementInput) => Announcement
}

const ClinicContext = createContext<ClinicContextValue | null>(null)

function getInitialUserId() {
  const saved = localStorage.getItem('clinic-persona')
  return users.some((user) => user.id === saved) ? saved! : 'user-employee'
}

export function ClinicProvider({ children }: PropsWithChildren) {
  const [currentUserId, setCurrentUserIdState] = useState(getInitialUserId)
  const [currentLocationId, setCurrentLocationId] = useState('loc-a')
  const [channels, setChannels] = useState(seedChannels)
  const [memberships, setMemberships] = useState(seedMemberships)
  const [messages, setMessages] = useState(seedMessages)
  const [tasks, setTasks] = useState(seedTasks)
  const [attachments, setAttachments] = useState(seedAttachments)
  const [meetings, setMeetings] = useState(seedMeetings)
  const [meetingResponses, setMeetingResponses] = useState(seedMeetingResponses)
  const [announcements, setAnnouncements] = useState(seedAnnouncements)

  const currentUser = users.find((user) => user.id === currentUserId) ?? users[3]
  const currentBinding =
    roleBindings.find((binding) =>
      currentUser.roleBindingIds.includes(binding.id),
    ) ?? roleBindings[3]

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
      collaboratorIds: input.collaboratorIds,
      dueAt: input.dueAt,
      status: 'open',
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

  const value: ClinicContextValue = {
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
    attachments,
    meetings,
    meetingResponses,
    announcements,
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
    uploadAttachments,
    createMeeting,
    respondToMeeting,
    createAnnouncement,
  }

  return <ClinicContext.Provider value={value}>{children}</ClinicContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useClinic() {
  const context = useContext(ClinicContext)
  if (!context) throw new Error('useClinic must be used inside ClinicProvider')
  return context
}
