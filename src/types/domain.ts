export type UserRole =
  | 'owner'
  | 'orgAdmin'
  | 'locationManager'
  | 'departmentLead'
  | 'staff'
  | 'contractor'
  | 'itSupport'

export type Permission =
  | 'viewAdmin'
  | 'manageOrganization'
  | 'manageLocations'
  | 'managePeople'
  | 'manageChannels'
  | 'sendOrganizationAnnouncement'
  | 'sendLocationAnnouncement'
  | 'sendDepartmentAnnouncement'
  | 'viewStaffing'
  | 'viewAudit'
  | 'manageIncidents'

export type ChannelType =
  | 'department'
  | 'interface'
  | 'project'
  | 'location'
  | 'announcement'
  | 'leadership'
  | 'incident'
  | 'direct'

export type ChannelVisibility = 'public' | 'private' | 'restricted'
export type Presence = 'online' | 'away' | 'offline'
export type EmploymentType = 'fullTime' | 'partTime' | 'perDiem' | 'contractor'
export type AnnouncementStatus = 'draft' | 'scheduled' | 'published' | 'expired'
export type AnnouncementPriority = 'standard' | 'urgent'
export type MeetingProvider = 'zoom' | 'googleMeet'
export type MeetingResponseStatus = 'accepted' | 'declined'
export type TaskStatus =
  | 'pendingAcceptance'
  | 'accepted'
  | 'inProgress'
  | 'blocked'
  | 'done'
  | 'declined'
  | 'canceled'
export type TaskEventType =
  | 'assigned'
  | 'selfCreated'
  | 'accepted'
  | 'declined'
  | 'started'
  | 'blocked'
  | 'unblocked'
  | 'completed'
  | 'reassigned'
  | 'reopened'
  | 'canceled'
export type TaskRecurrence = 'daily' | 'weekly' | 'monthly'

export interface Organization {
  id: string
  name: string
  shortName: string
  legalName: string
  defaultLocale: 'en-US' | 'vi-VN'
  locationIds: string[]
  timezone?: string
  retentionDays?: 30 | 90 | 365
  operationalWarningDefault?: boolean
}

export interface Location {
  id: string
  name: string
  shortName: string
  address: string
  timezone: string
  status: 'active' | 'opening' | 'archived'
  departmentIds: string[]
}

export interface Department {
  id: string
  name: string
  code: string
  locationIds: string[]
}

export interface RoleBinding {
  id: string
  userId: string
  role: UserRole
  organizationId: string
  locationIds: string[]
  departmentIds: string[]
  startsAt: string
  expiresAt?: string
}

export interface Assignment {
  id: string
  userId: string
  locationId: string
  departmentId: string
  employmentType: EmploymentType
  isPrimary: boolean
  startsAt: string
  endsAt?: string
}

export interface User {
  id: string
  name: string
  initials: string
  title: string
  email: string
  presence: Presence
  roleBindingIds: string[]
  assignmentIds: string[]
  avatarUrl?: string
}

export interface Channel {
  id: string
  name: string
  displayName: string
  purpose: string
  type: ChannelType
  visibility: ChannelVisibility
  locationIds: string[]
  departmentIds: string[]
  ownerId: string
  memberIds: string[]
  unreadCount: number
  isUrgent: boolean
  isPinned?: boolean
  archiveAt?: string
}

export interface ChannelMembership {
  id: string
  channelId: string
  userId: string
  source: 'policy' | 'invitation' | 'accessRequest'
  joinedAt: string
  expiresAt?: string
}

export interface AccessRequest {
  id: string
  channelId: string
  requesterId: string
  approverId?: string
  reason: string
  status: 'pending' | 'approved' | 'denied' | 'expired'
  requestedAt: string
  expiresAt?: string
}

export interface Attachment {
  id: string
  name: string
  type: string
  sizeLabel: string
  sizeBytes?: number
  uploadedBy: string
  uploadedAt: string
  channelId: string
  messageId?: string
  taskId?: string
  previewUrl?: string
  downloadUrl?: string
  status?: 'uploading' | 'available' | 'rejected' | 'failed'
  scanStatus?: 'pending' | 'bypassed_dev' | 'clean' | 'rejected' | 'failed'
}

export interface Message {
  id: string
  channelId: string
  authorId: string
  body: string
  createdAt: string
  isUrgent: boolean
  attachmentIds: string[]
  attachments?: Attachment[]
  taskId?: string
  meetingId?: string
}

export interface TaskChecklistItem {
  id: string
  label: string
  completed: boolean
  completedById?: string
  completedAt?: string
}

export interface Task {
  id: string
  title: string
  channelId: string
  ownerId: string
  createdById: string
  collaboratorIds: string[]
  dueAt: string
  status: TaskStatus
  checklist: TaskChecklistItem[]
  attachmentIds: string[]
  sourceMessageId?: string
  acceptedAt?: string
  declinedAt?: string
  blockedAt?: string
  completedAt?: string
  canceledAt?: string
  statusReason?: string
  statusChangedAt: string
  templateId?: string
  scheduleId?: string
  occurrenceDueAt?: string
}

export type TaskSummary = Pick<
  Task,
  | 'id'
  | 'title'
  | 'channelId'
  | 'ownerId'
  | 'createdById'
  | 'dueAt'
  | 'status'
  | 'statusReason'
  | 'statusChangedAt'
> & { completedItems: number; totalItems: number }

export interface TaskEvent {
  id: string
  taskId: string
  actorId?: string
  type: TaskEventType
  fromStatus?: TaskStatus
  toStatus: TaskStatus
  reason?: string
  metadata: Record<string, string | number | boolean>
  createdAt: string
}

export interface TaskDetail extends Task {
  events: TaskEvent[]
}

export interface TaskTemplate {
  id: string
  name: string
  title: string
  createdById: string
  visibility: 'private' | 'organization' | 'location' | 'department'
  locationId?: string
  departmentId?: string
  checklist: string[]
}

export interface TaskSchedule {
  id: string
  templateId: string
  createdById: string
  channelId: string
  ownerId: string
  frequency: TaskRecurrence
  weekdays: number[]
  monthDay?: number
  dueLocalTime: string
  timezone: string
  createLeadMinutes: number
  nextDueAt: string
  active: boolean
}

export type WorkAgendaItem =
  | { kind: 'task'; startsAt: string; task: TaskSummary }
  | { kind: 'meeting'; startsAt: string; meeting: Meeting }

export interface Meeting {
  id: string
  channelId: string
  messageId: string
  organizerId: string
  title: string
  provider: MeetingProvider
  joinUrl: string
  startsAt: string
  endsAt: string
  timezone: string
  attendeeIds: string[]
  createdAt: string
}

export interface MeetingResponse {
  id: string
  meetingId: string
  userId: string
  status: MeetingResponseStatus
  respondedAt: string
}

export interface MeetingCandidate {
  provider: MeetingProvider
  joinUrl: string
  title?: string
  startsAt?: string
  endsAt?: string
  timezone: string
}

export interface CreateMeetingInput {
  channelId: string
  body: string
  title: string
  provider: MeetingProvider
  joinUrl: string
  startsAt: string
  endsAt: string
  timezone: string
}

export interface SendMessageInput {
  channelId: string
  body: string
  urgent: boolean
  attachmentIds?: string[]
  taskId?: string
  meetingId?: string
}

export interface CreateTaskInput {
  channelId: string
  title: string
  ownerId: string
  collaboratorIds: string[]
  dueAt: string
  checklist: string[]
  attachmentIds?: string[]
  sourceMessageId?: string
  recurrence?: {
    frequency: TaskRecurrence
    weekdays: number[]
    monthDay?: number
    timezone: string
    createLeadMinutes: number
  }
}

export type TaskTransitionAction = 'block' | 'unblock' | 'complete' | 'reopen' | 'cancel'

export interface UpdateTaskInput {
  title?: string
  ownerId?: string
  collaboratorIds?: string[]
  dueAt?: string
  status?: Task['status']
  checklist?: Task['checklist']
  attachmentIds?: string[]
  sourceMessageId?: string
}

export type UploadTarget =
  | { kind: 'message'; channelId: string; messageId?: string }
  | { kind: 'task'; channelId: string; taskId?: string; messageId?: string }

export interface UploadAttachmentAdapter {
  upload: (
    files: File[],
    target: UploadTarget,
    uploadedBy: string,
  ) => Promise<Attachment[]>
}

export interface AnnouncementAudience {
  organizationWide: boolean
  locationIds: string[]
  departmentIds: string[]
}

export interface Announcement {
  id: string
  title: string
  body: string
  authorId: string
  audience: AnnouncementAudience
  priority: AnnouncementPriority
  requireAcknowledgement: boolean
  status: AnnouncementStatus
  scheduledAt?: string
  publishedAt?: string
  expiresAt?: string
  attachmentIds: string[]
}

export interface StaffingSnapshot {
  locationId: string
  capturedAt: string
  scheduled: number
  required: number
  departmentCoverage: Array<{
    departmentId: string
    scheduled: number
    required: number
  }>
}

export interface PolicyWarning {
  id: string
  field: 'channelName' | 'purpose' | 'message' | 'attachment'
  ruleId: string
  messageKey: string
  matchedText?: string
  createdAt: string
}

export interface AuditEvent {
  id: string
  actorId: string
  action: string
  targetType: string
  targetLabel: string
  locationId?: string
  createdAt: string
  metadata: Record<string, string | number | boolean>
}

export interface CreateChannelInput {
  name: string
  purpose: string
  departmentIds: string[]
  visibility: ChannelVisibility
  locationId: string
  archivePolicy: '24h' | '7d' | 'indefinite'
  urgent: boolean
}

export interface CreateAnnouncementInput {
  title: string
  body: string
  audience: AnnouncementAudience
  priority: AnnouncementPriority
  requireAcknowledgement: boolean
  status: 'draft' | 'published'
}

export interface SaveOrganizationSettingsInput {
  name: string
  shortName: string
  legalName: string
  defaultLocale: Organization['defaultLocale']
  timezone: string
  retentionDays: 30 | 90 | 365
  operationalWarningDefault: boolean
}

export interface SaveLocationInput {
  id?: string
  name: string
  shortName: string
  address: string
  timezone: string
  status: Location['status']
}

export interface SaveMemberAssignmentInput {
  memberId: string
  role: UserRole
  locationId: string
  departmentId: string
  employmentType: 'employee' | 'contractor' | 'locum' | 'vendor'
  status: 'active' | 'suspended' | 'offboarded'
  expiresAt?: string
}
