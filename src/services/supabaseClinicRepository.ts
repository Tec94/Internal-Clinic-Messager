import { supabase } from '../utils/supabase'
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
  Organization,
  RoleBinding,
  SaveLocationInput,
  SaveMemberAssignmentInput,
  SaveOrganizationSettingsInput,
  Task,
  User,
} from '../types/domain'

export interface ClinicSnapshot {
  organization: Organization
  locations: Location[]
  departments: Department[]
  users: User[]
  assignments: Assignment[]
  roleBindings: RoleBinding[]
  channels: Channel[]
  memberships: ChannelMembership[]
  tasks: Task[]
  attachments: Attachment[]
  meetings: Meeting[]
  meetingResponses: MeetingResponse[]
  announcements: Announcement[]
  accessRequests: AccessRequest[]
  auditEvents: AuditEvent[]
}

interface RepositoryScope {
  organizationId: string
  memberId: string
}

export interface SupabaseClinicRepository {
  loadSnapshot: (scope: RepositoryScope) => Promise<ClinicSnapshot>
  createChannel: (
    scope: RepositoryScope,
    input: CreateChannelInput,
  ) => Promise<string>
  createTask: (
    scope: RepositoryScope,
    input: CreateTaskInput,
  ) => Promise<string>
  setTaskChecklistItem: (
    scope: RepositoryScope,
    taskId: string,
    itemId: string,
    completed: boolean,
  ) => Promise<void>
  createMeeting: (
    scope: RepositoryScope,
    input: CreateMeetingInput,
  ) => Promise<string>
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
  saveLocation: (
    scope: RepositoryScope,
    input: SaveLocationInput,
  ) => Promise<string>
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

export function createSupabaseClinicRepository(
  client: typeof supabase = supabase,
): SupabaseClinicRepository {
  return {
    async loadSnapshot(scope) {
      const [
        organizationResult,
        locationsResult,
        departmentsResult,
        departmentLocationsResult,
        membersResult,
        assignmentsResult,
        bindingsResult,
        bindingLocationsResult,
        bindingDepartmentsResult,
        channelsResult,
        channelLocationsResult,
        channelDepartmentsResult,
        membershipsResult,
        tasksResult,
        collaboratorsResult,
        checklistResult,
        taskAttachmentsResult,
        attachmentsResult,
        meetingsResult,
        attendeesResult,
        responsesResult,
        announcementsResult,
        announcementLocationsResult,
        announcementDepartmentsResult,
        accessRequestsResult,
        auditEventsResult,
      ] = await Promise.all([
        client
          .from('organizations')
          .select(`
            id,
            name,
            short_name,
            legal_name,
            default_locale,
            timezone,
            retention_days,
            operational_warning_default
          `)
          .eq('id', scope.organizationId)
          .single(),
        client
          .from('locations')
          .select('id, name, short_name, address, timezone, status')
          .eq('organization_id', scope.organizationId)
          .is('archived_at', null)
          .order('name'),
        client
          .from('departments')
          .select('id, name, code')
          .eq('organization_id', scope.organizationId)
          .is('archived_at', null)
          .order('name'),
        client
          .from('department_locations')
          .select('department_id, location_id')
          .eq('organization_id', scope.organizationId),
        client
          .from('organization_members')
          .select('id, user_id, status, employment_type')
          .eq('organization_id', scope.organizationId),
        client
          .from('assignments')
          .select(`
            id,
            member_id,
            location_id,
            department_id,
            is_primary,
            starts_at,
            ends_at
          `)
          .eq('organization_id', scope.organizationId)
          .is('archived_at', null),
        client
          .from('role_bindings')
          .select('id, member_id, role, starts_at, expires_at')
          .eq('organization_id', scope.organizationId)
          .is('archived_at', null),
        client
          .from('role_binding_locations')
          .select('role_binding_id, location_id')
          .eq('organization_id', scope.organizationId),
        client
          .from('role_binding_departments')
          .select('role_binding_id, department_id')
          .eq('organization_id', scope.organizationId),
        client
          .from('channels')
          .select(`
            id,
            name,
            display_name,
            purpose,
            type,
            visibility,
            owner_member_id,
            is_urgent,
            archive_at
          `)
          .eq('organization_id', scope.organizationId)
          .is('archived_at', null)
          .order('updated_at', { ascending: false }),
        client
          .from('channel_locations')
          .select('channel_id, location_id')
          .eq('organization_id', scope.organizationId),
        client
          .from('channel_departments')
          .select('channel_id, department_id')
          .eq('organization_id', scope.organizationId),
        client
          .from('channel_memberships')
          .select(`
            id,
            channel_id,
            member_id,
            source,
            can_send,
            starts_at,
            expires_at,
            archived_at
          `)
          .eq('organization_id', scope.organizationId),
        client
          .from('tasks')
          .select(`
            id,
            channel_id,
            owner_member_id,
            title,
            due_at,
            status,
            source_message_id
          `)
          .eq('organization_id', scope.organizationId)
          .is('archived_at', null)
          .order('due_at'),
        client
          .from('task_collaborators')
          .select('task_id, member_id')
          .eq('organization_id', scope.organizationId),
        client
          .from('task_checklist_items')
          .select('id, task_id, label, completed, position')
          .eq('organization_id', scope.organizationId)
          .order('position'),
        client
          .from('task_attachments')
          .select('task_id, attachment_id')
          .eq('organization_id', scope.organizationId),
        client
          .from('attachments')
          .select(`
            id,
            channel_id,
            uploader_member_id,
            original_name,
            mime_type,
            size_bytes,
            status,
            scan_status,
            created_at
          `)
          .eq('organization_id', scope.organizationId)
          .is('archived_at', null)
          .order('created_at', { ascending: false }),
        client
          .from('meetings')
          .select(`
            id,
            channel_id,
            message_id,
            organizer_member_id,
            title,
            provider,
            join_url,
            starts_at,
            ends_at,
            timezone,
            created_at
          `)
          .eq('organization_id', scope.organizationId)
          .is('archived_at', null)
          .order('starts_at'),
        client
          .from('meeting_attendees')
          .select('meeting_id, member_id')
          .eq('organization_id', scope.organizationId),
        client
          .from('meeting_responses')
          .select('meeting_id, member_id, status, responded_at')
          .eq('organization_id', scope.organizationId),
        client
          .from('announcements')
          .select(`
            id,
            author_member_id,
            organization_wide,
            title,
            body,
            priority,
            require_acknowledgement,
            status,
            scheduled_at,
            published_at,
            expires_at
          `)
          .eq('organization_id', scope.organizationId)
          .is('archived_at', null)
          .order('created_at', { ascending: false }),
        client
          .from('announcement_locations')
          .select('announcement_id, location_id')
          .eq('organization_id', scope.organizationId),
        client
          .from('announcement_departments')
          .select('announcement_id, department_id')
          .eq('organization_id', scope.organizationId),
        client
          .from('access_requests')
          .select(`
            id,
            channel_id,
            requester_member_id,
            approver_member_id,
            reason,
            status,
            requested_at,
            expires_at
          `)
          .eq('organization_id', scope.organizationId)
          .order('requested_at', { ascending: false }),
        client
          .from('audit_events')
          .select(`
            id,
            actor_member_id,
            action,
            target_type,
            target_id,
            location_id,
            metadata,
            created_at
          `)
          .eq('organization_id', scope.organizationId)
          .order('created_at', { ascending: false })
          .limit(200),
      ])

      const results = [
        organizationResult,
        locationsResult,
        departmentsResult,
        departmentLocationsResult,
        membersResult,
        assignmentsResult,
        bindingsResult,
        bindingLocationsResult,
        bindingDepartmentsResult,
        channelsResult,
        channelLocationsResult,
        channelDepartmentsResult,
        membershipsResult,
        tasksResult,
        collaboratorsResult,
        checklistResult,
        taskAttachmentsResult,
        attachmentsResult,
        meetingsResult,
        attendeesResult,
        responsesResult,
        announcementsResult,
        announcementLocationsResult,
        announcementDepartmentsResult,
        accessRequestsResult,
        auditEventsResult,
      ]
      const failed = results.find((result) => result.error)
      if (failed?.error) {
        throw new Error(`Could not load the workspace: ${failed.error.message}`)
      }
      if (!organizationResult.data) {
        throw new Error('Could not load the organization.')
      }

      const memberRows = membersResult.data ?? []
      const userIds = memberRows.map((member) => member.user_id)
      const profileResult = userIds.length === 0
        ? { data: [], error: null }
        : await client
            .from('profiles')
            .select('id, full_name, work_email')
            .in('id', userIds)
      if (profileResult.error) {
        throw new Error(
          `Could not load the staff directory: ${profileResult.error.message}`,
        )
      }
      const profileById = new Map(
        (profileResult.data ?? []).map((profile) => [profile.id, profile]),
      )

      const roleBindings: RoleBinding[] = (bindingsResult.data ?? []).map(
        (binding) => ({
          id: binding.id,
          userId: binding.member_id,
          role: mapRole(binding.role),
          organizationId: scope.organizationId,
          locationIds: (bindingLocationsResult.data ?? [])
            .filter((row) => row.role_binding_id === binding.id)
            .map((row) => row.location_id),
          departmentIds: (bindingDepartmentsResult.data ?? [])
            .filter((row) => row.role_binding_id === binding.id)
            .map((row) => row.department_id),
          startsAt: binding.starts_at,
          expiresAt: binding.expires_at ?? undefined,
        }),
      )
      const users: User[] = memberRows.flatMap((member) => {
        const profile = profileById.get(member.user_id)
        if (!profile) return []
        const bindingIds = roleBindings
          .filter((binding) => binding.userId === member.id)
          .map((binding) => binding.id)
        return [{
          id: member.id,
          name: profile.full_name,
          initials: initials(profile.full_name),
          title:
            roleBindings.find((binding) => binding.userId === member.id)?.role
            ?? 'staff',
          email: profile.work_email,
          presence: 'offline' as const,
          roleBindingIds: bindingIds,
          assignmentIds: (assignmentsResult.data ?? [])
            .filter((assignment) => assignment.member_id === member.id)
            .map((assignment) => assignment.id),
        }]
      })

      const activeMembershipRows = (membershipsResult.data ?? []).filter(
        isActiveChannelMembership,
      )
      const attachments = (attachmentsResult.data ?? []).map((attachment) => ({
        id: attachment.id,
        name: attachment.original_name,
        type: attachment.mime_type,
        sizeLabel: formatBytes(attachment.size_bytes),
        sizeBytes: attachment.size_bytes,
        uploadedBy: attachment.uploader_member_id,
        uploadedAt: attachment.created_at,
        channelId: attachment.channel_id,
        status: attachment.status,
        scanStatus: attachment.scan_status,
      } satisfies Attachment))

      return {
        organization: {
          id: organizationResult.data.id,
          name: organizationResult.data.name,
          shortName:
            organizationResult.data.short_name
            ?? organizationResult.data.name,
          legalName:
            organizationResult.data.legal_name
            ?? organizationResult.data.name,
          defaultLocale: organizationResult.data.default_locale,
          timezone: organizationResult.data.timezone,
          retentionDays: organizationResult.data.retention_days,
          operationalWarningDefault:
            organizationResult.data.operational_warning_default,
          locationIds: (locationsResult.data ?? []).map(
            (location) => location.id,
          ),
        },
        locations: (locationsResult.data ?? []).map((location) => ({
          id: location.id,
          name: location.name,
          shortName: location.short_name,
          address: location.address,
          timezone: location.timezone,
          status: location.status,
          departmentIds: (departmentLocationsResult.data ?? [])
            .filter((row) => row.location_id === location.id)
            .map((row) => row.department_id),
        })),
        departments: (departmentsResult.data ?? []).map((department) => ({
          id: department.id,
          name: department.name,
          code: department.code ?? department.name,
          locationIds: (departmentLocationsResult.data ?? [])
            .filter((row) => row.department_id === department.id)
            .map((row) => row.location_id),
        })),
        users,
        assignments: (assignmentsResult.data ?? []).map((assignment) => ({
          id: assignment.id,
          userId: assignment.member_id,
          locationId: assignment.location_id,
          departmentId: assignment.department_id,
          employmentType:
            mapEmploymentType(
              memberRows.find((member) => member.id === assignment.member_id)
                ?.employment_type,
            ),
          isPrimary: assignment.is_primary,
          startsAt: assignment.starts_at,
          endsAt: assignment.ends_at ?? undefined,
        })),
        roleBindings,
        channels: (channelsResult.data ?? []).map((channel) => ({
          id: channel.id,
          name: channel.name,
          displayName: channel.display_name,
          purpose: channel.purpose,
          type: channel.type,
          visibility: channel.visibility,
          locationIds: (channelLocationsResult.data ?? [])
            .filter((row) => row.channel_id === channel.id)
            .map((row) => row.location_id),
          departmentIds: (channelDepartmentsResult.data ?? [])
            .filter((row) => row.channel_id === channel.id)
            .map((row) => row.department_id),
          ownerId: channel.owner_member_id,
          memberIds: activeMembershipRows
            .filter((membership) => membership.channel_id === channel.id)
            .map((membership) => membership.member_id),
          unreadCount: 0,
          isUrgent: channel.is_urgent,
          archiveAt: channel.archive_at ?? undefined,
        })),
        memberships: activeMembershipRows.map((membership) => ({
          id: membership.id,
          channelId: membership.channel_id,
          userId: membership.member_id,
          source: mapMembershipSource(membership.source),
          joinedAt: membership.starts_at,
          expiresAt: membership.expires_at ?? undefined,
        })),
        tasks: (tasksResult.data ?? []).map((task) => ({
          id: task.id,
          title: task.title,
          channelId: task.channel_id,
          ownerId: task.owner_member_id,
          collaboratorIds: (collaboratorsResult.data ?? [])
            .filter((row) => row.task_id === task.id)
            .map((row) => row.member_id),
          dueAt: task.due_at,
          status: mapTaskStatus(task.status),
          checklist: (checklistResult.data ?? [])
            .filter((item) => item.task_id === task.id)
            .map((item) => ({
              id: item.id,
              label: item.label,
              completed: item.completed,
            })),
          attachmentIds: (taskAttachmentsResult.data ?? [])
            .filter((row) => row.task_id === task.id)
            .map((row) => row.attachment_id),
          sourceMessageId: task.source_message_id ?? undefined,
        })),
        attachments: attachments.map((attachment) => {
          const taskLink = (taskAttachmentsResult.data ?? []).find(
            (link) => link.attachment_id === attachment.id,
          )
          return { ...attachment, taskId: taskLink?.task_id }
        }),
        meetings: (meetingsResult.data ?? []).map((meeting) => ({
          id: meeting.id,
          channelId: meeting.channel_id,
          messageId: meeting.message_id ?? '',
          organizerId: meeting.organizer_member_id,
          title: meeting.title,
          provider: meeting.provider,
          joinUrl: meeting.join_url,
          startsAt: meeting.starts_at,
          endsAt: meeting.ends_at,
          timezone: meeting.timezone,
          attendeeIds: (attendeesResult.data ?? [])
            .filter((row) => row.meeting_id === meeting.id)
            .map((row) => row.member_id),
          createdAt: meeting.created_at,
        })),
        meetingResponses: (responsesResult.data ?? []).map((response) => ({
          id: `${response.meeting_id}-${response.member_id}`,
          meetingId: response.meeting_id,
          userId: response.member_id,
          status: response.status,
          respondedAt: response.responded_at,
        })),
        announcements: (announcementsResult.data ?? []).map(
          (announcement) => ({
            id: announcement.id,
            title: announcement.title,
            body: announcement.body,
            authorId: announcement.author_member_id,
            audience: {
              organizationWide: announcement.organization_wide,
              locationIds: (announcementLocationsResult.data ?? [])
                .filter((row) => row.announcement_id === announcement.id)
                .map((row) => row.location_id),
              departmentIds: (announcementDepartmentsResult.data ?? [])
                .filter((row) => row.announcement_id === announcement.id)
                .map((row) => row.department_id),
            },
            priority: announcement.priority,
            requireAcknowledgement: announcement.require_acknowledgement,
            status: announcement.status,
            scheduledAt: announcement.scheduled_at ?? undefined,
            publishedAt: announcement.published_at ?? undefined,
            expiresAt: announcement.expires_at ?? undefined,
            attachmentIds: [],
          }),
        ),
        accessRequests: (accessRequestsResult.data ?? []).map((request) => ({
          id: request.id,
          channelId: request.channel_id,
          requesterId: request.requester_member_id,
          approverId: request.approver_member_id ?? undefined,
          reason: request.reason,
          status: request.status,
          requestedAt: request.requested_at,
          expiresAt: request.expires_at ?? undefined,
        })),
        auditEvents: (auditEventsResult.data ?? []).map((event) => ({
          id: event.id,
          actorId: event.actor_member_id ?? '',
          action: event.action,
          targetType: event.target_type,
          targetLabel: event.target_id ?? event.target_type,
          locationId: event.location_id ?? undefined,
          createdAt: event.created_at,
          metadata: normalizeAuditMetadata(event.metadata),
        })),
      }
    },

    async createChannel(scope, input) {
      const archiveAt = input.archivePolicy === 'indefinite'
        ? null
        : new Date(
            Date.now()
            + (input.archivePolicy === '24h' ? 1 : 7) * 86_400_000,
          ).toISOString()
      const { data, error } = await client
        .rpc('create_managed_channel', {
          target_organization_id: scope.organizationId,
          target_name: input.name,
          target_display_name: toDisplayName(input.name),
          target_purpose: input.purpose,
          target_type: 'interface',
          target_visibility: input.visibility,
          target_location_ids: [input.locationId],
          target_department_ids: input.departmentIds,
          target_archive_at: archiveAt,
          target_is_urgent: input.urgent,
        })
        .single()
      if (error) throw new Error(`Could not create the channel: ${error.message}`)
      return (data as { id: string }).id
    },

    async createTask(scope, input) {
      const { data, error } = await client
        .rpc('create_task_with_message', {
          target_organization_id: scope.organizationId,
          target_channel_id: input.channelId,
          target_owner_member_id: input.ownerId,
          target_collaborator_ids: input.collaboratorIds,
          target_title: input.title,
          target_due_at: input.dueAt,
          target_checklist_labels: input.checklist,
          target_attachment_ids: input.attachmentIds ?? [],
          target_client_task_id: crypto.randomUUID(),
          target_client_message_id: crypto.randomUUID(),
          target_message_body: `Assigned task: ${input.title}`,
        })
        .single()
      if (error) throw new Error(`Could not create the task: ${error.message}`)
      return (data as { id: string }).id
    },

    async setTaskChecklistItem(scope, taskId, itemId, completed) {
      const { error } = await client.rpc('set_task_checklist_item', {
        target_organization_id: scope.organizationId,
        target_task_id: taskId,
        target_item_id: itemId,
        target_completed: completed,
      })
      if (error) throw new Error(`Could not update the task: ${error.message}`)
    },

    async createMeeting(scope, input) {
      const { data, error } = await client
        .rpc('create_meeting_with_message', {
          target_organization_id: scope.organizationId,
          target_channel_id: input.channelId,
          target_title: input.title,
          target_provider: input.provider === 'googleMeet'
            ? 'google_meet'
            : input.provider,
          target_join_url: input.joinUrl,
          target_starts_at: input.startsAt,
          target_ends_at: input.endsAt,
          target_timezone: input.timezone,
          target_client_meeting_id: crypto.randomUUID(),
          target_client_message_id: crypto.randomUUID(),
          target_message_body: input.body,
        })
        .single()
      if (error) throw new Error(`Could not create the meeting: ${error.message}`)
      return (data as { id: string }).id
    },

    async respondToMeeting(scope, meetingId, status) {
      const { error } = await client.rpc('respond_to_meeting', {
        target_organization_id: scope.organizationId,
        target_meeting_id: meetingId,
        target_status: status,
      })
      if (error) throw new Error(`Could not save the response: ${error.message}`)
    },

    async createAnnouncement(scope, input) {
      const { data, error } = await client
        .rpc('create_announcement', {
          target_organization_id: scope.organizationId,
          target_title: input.title,
          target_body: input.body,
          target_organization_wide: input.audience.organizationWide,
          target_location_ids: input.audience.locationIds,
          target_department_ids: input.audience.departmentIds,
          target_priority: input.priority,
          target_require_acknowledgement: input.requireAcknowledgement,
          target_status: input.status,
          target_expires_at: null,
        })
        .single()
      if (error) {
        throw new Error(`Could not create the announcement: ${error.message}`)
      }
      return (data as { id: string }).id
    },

    async saveOrganizationSettings(scope, input) {
      const { error } = await client.rpc('save_organization_settings', {
        target_organization_id: scope.organizationId,
        target_name: input.name,
        target_short_name: input.shortName,
        target_legal_name: input.legalName,
        target_default_locale: input.defaultLocale,
        target_timezone: input.timezone,
        target_retention_days: input.retentionDays,
        target_operational_warning_default:
          input.operationalWarningDefault,
      })
      if (error) {
        throw new Error(
          `Could not save organization settings: ${error.message}`,
        )
      }
    },

    async saveLocation(scope, input) {
      const { data, error } = await client
        .rpc('save_location', {
          target_organization_id: scope.organizationId,
          target_location_id: input.id ?? null,
          target_name: input.name,
          target_short_name: input.shortName,
          target_address: input.address,
          target_timezone: input.timezone,
          target_status: input.status,
        })
        .single()
      if (error) throw new Error(`Could not save the location: ${error.message}`)
      return (data as { id: string }).id
    },

    async saveMemberAssignment(scope, input) {
      const { error } = await client.rpc('save_member_assignment', {
        target_organization_id: scope.organizationId,
        target_member_id: input.memberId,
        target_role: mapRoleToDatabase(input.role),
        target_location_id: input.locationId,
        target_department_id: input.departmentId,
        target_employment_type: input.employmentType,
        target_status: input.status,
        target_expires_at: input.expiresAt ?? null,
      })
      if (error) {
        throw new Error(`Could not save the assignment: ${error.message}`)
      }
    },

    async resolveAccessRequest(scope, requestId, status) {
      const { error } = await client.rpc('resolve_access_request', {
        target_organization_id: scope.organizationId,
        target_request_id: requestId,
        target_status: status,
        target_access_expires_at: null,
      })
      if (error) {
        throw new Error(`Could not resolve the access request: ${error.message}`)
      }
    },
  }
}

function mapRole(value: string): RoleBinding['role'] {
  const roles: Record<string, RoleBinding['role']> = {
    owner: 'owner',
    org_admin: 'orgAdmin',
    location_manager: 'locationManager',
    department_lead: 'departmentLead',
    staff: 'staff',
    contractor: 'contractor',
    it_support: 'itSupport',
  }
  return roles[value] ?? 'staff'
}

function mapEmploymentType(
  value: string | undefined,
): Assignment['employmentType'] {
  if (value === 'contractor' || value === 'vendor') return 'contractor'
  if (value === 'locum') return 'perDiem'
  return 'fullTime'
}

function mapRoleToDatabase(value: RoleBinding['role']) {
  const roles: Record<RoleBinding['role'], string> = {
    owner: 'owner',
    orgAdmin: 'org_admin',
    locationManager: 'location_manager',
    departmentLead: 'department_lead',
    staff: 'staff',
    contractor: 'contractor',
    itSupport: 'it_support',
  }
  return roles[value]
}

function mapTaskStatus(value: string): Task['status'] {
  if (value === 'in_progress') return 'inProgress'
  if (value === 'done') return 'done'
  return 'open'
}

function mapMembershipSource(
  value: string,
): ChannelMembership['source'] {
  if (value === 'access_request') return 'accessRequest'
  if (value === 'invitation') return 'invitation'
  return 'policy'
}

function isActiveChannelMembership(row: {
  archived_at: string | null
  starts_at: string
  expires_at: string | null
}) {
  const now = Date.now()
  return (
    row.archived_at === null
    && Date.parse(row.starts_at) <= now
    && (row.expires_at === null || Date.parse(row.expires_at) > now)
  )
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0]?.toLocaleUpperCase())
    .join('')
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function toDisplayName(name: string) {
  return name
    .split('-')
    .map((word) => word.charAt(0).toLocaleUpperCase() + word.slice(1))
    .join(' ')
}

function normalizeAuditMetadata(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [
      string,
      string | number | boolean,
    ] => (
      typeof entry[1] === 'string'
      || typeof entry[1] === 'number'
      || typeof entry[1] === 'boolean'
    )),
  )
}
