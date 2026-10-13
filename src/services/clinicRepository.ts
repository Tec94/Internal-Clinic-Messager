import type {
  AccessRequest,
  Announcement,
  Assignment,
  Attachment,
  AuditEvent,
  Channel,
  ChannelMembership,
  CreateAnnouncementInput,
  CreateChannelInput,
  CreateMeetingInput,
  CreateTaskInput,
  Department,
  Location,
  Meeting,
  MeetingResponse,
  MeetingResponseStatus,
  Message,
  Organization,
  RoleBinding,
  SaveLocationInput,
  SaveMemberAssignmentInput,
  SaveOrganizationSettingsInput,
  SendMessageInput,
  Task,
  TaskEvent,
  TaskSchedule,
  TaskTemplate,
  TaskTransitionAction,
  UploadTarget,
  User,
} from '../types/domain'

// The clinic port. ClinicProvider runs one code path against either adapter:
// createSupabaseClinicRepository (signed in) or createInMemoryClinicRepository (Preview mode).

export interface RepositoryScope {
  organizationId: string
  // The acting Member. In Preview mode it is the selected persona.
  memberId: string
}

export interface ClinicSnapshot {
  organization: Organization
  locations: Location[]
  departments: Department[]
  users: User[]
  assignments: Assignment[]
  roleBindings: RoleBinding[]
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
  // Preview mode only. In production, Chat lives in MessagingContext.
  chat?: PreviewChatState
}

export interface PreviewChatState {
  channels: Channel[]
  memberships: ChannelMembership[]
  messages: Message[]
}

export interface ClinicRepository {
  loadSnapshot: (scope: RepositoryScope) => Promise<ClinicSnapshot>
  // Calls onChange when another client changes the data. Returns the unsubscribe function.
  subscribe?: (scope: RepositoryScope, onChange: () => void) => () => void
  createChannel: (scope: RepositoryScope, input: CreateChannelInput) => Promise<string>
  ensureDirectChannel: (scope: RepositoryScope, targetMemberId: string) => Promise<string>
  createTask: (scope: RepositoryScope, input: CreateTaskInput) => Promise<string>
  setTaskChecklistItem: (
    scope: RepositoryScope,
    taskId: string,
    itemId: string,
    completed: boolean,
  ) => Promise<void>
  respondToTask: (
    scope: RepositoryScope,
    taskId: string,
    response: 'accept' | 'decline',
    reason?: string,
  ) => Promise<void>
  transitionTask: (
    scope: RepositoryScope,
    taskId: string,
    action: TaskTransitionAction,
    reason?: string,
    reopenItemId?: string,
  ) => Promise<void>
  reassignTask: (
    scope: RepositoryScope,
    taskId: string,
    ownerId: string,
    reason: string,
  ) => Promise<void>
  setTaskScheduleActive: (
    scope: RepositoryScope,
    scheduleId: string,
    active: boolean,
  ) => Promise<void>
  createMeeting: (scope: RepositoryScope, input: CreateMeetingInput) => Promise<string>
  respondToMeeting: (
    scope: RepositoryScope,
    meetingId: string,
    status: MeetingResponseStatus,
  ) => Promise<void>
  createAnnouncement: (
    scope: RepositoryScope,
    input: CreateAnnouncementInput,
  ) => Promise<string>
  saveOrganizationSettings: (
    scope: RepositoryScope,
    input: SaveOrganizationSettingsInput,
  ) => Promise<void>
  saveLocation: (scope: RepositoryScope, input: SaveLocationInput) => Promise<string>
  saveMemberAssignment: (
    scope: RepositoryScope,
    input: SaveMemberAssignmentInput,
  ) => Promise<void>
  resolveAccessRequest: (
    scope: RepositoryScope,
    requestId: string,
    status: 'approved' | 'denied',
  ) => Promise<void>
}

// Preview mode only. Production Chat sends and uploads through MessagingContext.
export interface PreviewChatRepository {
  sendMessage: (scope: RepositoryScope, input: SendMessageInput) => Promise<Message | null>
  uploadAttachments: (
    scope: RepositoryScope,
    files: File[],
    target: UploadTarget,
  ) => Promise<Attachment[]>
}
