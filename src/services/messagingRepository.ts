import type { Attachment } from '../types/domain'

export interface MessagingChannel {
  id: string
  organizationId: string
  name: string
  displayName: string
  purpose: string
  type:
    | 'department'
    | 'interface'
    | 'project'
    | 'location'
    | 'announcement'
    | 'leadership'
    | 'incident'
    | 'direct'
  visibility: 'public' | 'private' | 'restricted'
  ownerMemberId: string
  locationIds: string[]
  departmentIds: string[]
  memberIds: string[]
  memberCount: number
  canSend: boolean
  isUrgent: boolean
  archiveAt: string | null
}

export interface MessagingMember {
  memberId: string
  userId: string
  fullName: string
  workEmail: string
  employmentType: 'employee' | 'contractor' | 'locum' | 'vendor'
  status: 'active' | 'suspended' | 'offboarded'
}

export interface MessagingMessage {
  id: string
  organizationId: string
  channelId: string
  authorMemberId: string
  clientMessageId: string
  body: string
  isUrgent: boolean
  taskId?: string
  meetingId?: string
  createdAt: string
  attachmentIds: string[]
  attachments: Attachment[]
}

export interface MessageCursor {
  createdAt: string
  id: string
}

export interface MessagePage {
  items: MessagingMessage[]
  nextCursor: MessageCursor | null
}

export interface SendMessageCommand {
  organizationId: string
  channelId: string
  authorMemberId: string
  body: string
  isUrgent: boolean
  clientMessageId?: string
  attachmentIds?: string[]
}

export interface MessageSubscription {
  unsubscribe: () => Promise<void>
}

export interface MessagingRepository {
  listChannels: (
    organizationId: string,
    currentMemberId: string,
  ) => Promise<MessagingChannel[]>
  listMembers: (organizationId: string) => Promise<MessagingMember[]>
  listMessages: (
    organizationId: string,
    channelId: string,
    cursor?: MessageCursor,
    pageSize?: number,
  ) => Promise<MessagePage>
  sendMessage: (command: SendMessageCommand) => Promise<MessagingMessage>
  subscribeToMessages: (
    channelId: string,
    onMessage: (message: MessagingMessage) => void,
    onError?: (message: string) => void,
  ) => MessageSubscription
}
