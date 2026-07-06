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
  organization,
  roleBindings,
  tasks as seedTasks,
  users,
} from '../data/seed'
import { hasPermission } from '../services/permissions'
import type {
  Announcement,
  Channel,
  CreateMeetingInput,
  CreateAnnouncementInput,
  CreateChannelInput,
  Message,
  Meeting,
  MeetingResponse,
  MeetingResponseStatus,
  Permission,
  Task,
  Attachment,
} from '../types/domain'

interface ClinicContextValue {
  organization: typeof organization
  locations: typeof locations
  departments: typeof departments
  users: typeof users
  assignments: typeof assignments
  roleBindings: typeof roleBindings
  channels: Channel[]
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
  sendMessage: (channelId: string, body: string, urgent: boolean) => Message
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
  const [messages, setMessages] = useState(seedMessages)
  const [tasks] = useState(seedTasks)
  const [attachments] = useState(seedAttachments)
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
    return newChannel
  }

  const sendMessage = (channelId: string, body: string, urgent: boolean) => {
    const message: Message = {
      id: `message-${Date.now()}`,
      channelId,
      authorId: currentUser.id,
      body,
      createdAt: new Date().toISOString(),
      isUrgent: urgent,
      attachmentIds: [],
    }
    setMessages((items) => [...items, message])
    return message
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
    sendMessage,
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
