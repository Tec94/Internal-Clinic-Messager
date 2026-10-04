import { supabase } from '../utils/supabase'
import type {
  MessageCursor,
  MessagePage,
  MessagingAttachment,
  MessagingChannel,
  MessagingMember,
  MessagingMessage,
  MessagingRepository,
  SendMessageCommand,
} from './messagingRepository'

interface ChannelRow {
  id: string
  organization_id: string
  name: string
  display_name: string
  purpose: string
  type: MessagingChannel['type']
  visibility: MessagingChannel['visibility']
  owner_member_id: string
  is_urgent: boolean
  archive_at: string | null
  channel_locations: Array<{ location_id: string }> | null
  channel_departments: Array<{ department_id: string }> | null
  channel_memberships:
    | Array<{
        member_id: string
        can_send: boolean
        starts_at: string
        expires_at: string | null
        archived_at: string | null
      }>
    | null
}

interface MemberRow {
  id: string
  user_id: string
  employment_type: MessagingMember['employmentType']
  status: MessagingMember['status']
}

interface ProfileRow {
  id: string
  full_name: string
  work_email: string
}

interface MessageRow {
  id: string
  organization_id: string
  channel_id: string
  author_member_id: string
  client_message_id: string
  body: string
  is_urgent: boolean
  task_id: string | null
  meeting_id: string | null
  created_at: string
  message_attachments?: Array<{
    attachment:
      | AttachmentRow
      | AttachmentRow[]
      | null
  }> | null
}

interface AttachmentRow {
  id: string
  organization_id: string
  channel_id: string
  uploader_member_id: string
  original_name: string
  mime_type: string
  size_bytes: number
  status: MessagingAttachment['status']
  scan_status: MessagingAttachment['scanStatus']
  created_at: string
}

const messageSelect = `
  id,
  organization_id,
  channel_id,
  author_member_id,
  client_message_id,
  body,
  is_urgent,
  task_id,
  meeting_id,
  created_at,
  message_attachments(
    attachment:attachments(
      id,
      organization_id,
      channel_id,
      uploader_member_id,
      original_name,
      mime_type,
      size_bytes,
      status,
      scan_status,
      created_at
    )
  )
`

export function createSupabaseMessagingRepository(
  client: typeof supabase = supabase,
): MessagingRepository {
  return {
    async listChannels(organizationId, currentMemberId) {
      const { data, error } = await client
        .from('channels')
        .select(`
          id,
          organization_id,
          name,
          display_name,
          purpose,
          type,
          visibility,
          owner_member_id,
          is_urgent,
          archive_at,
          channel_locations(location_id),
          channel_departments(department_id),
          channel_memberships(
            member_id,
            can_send,
            starts_at,
            expires_at,
            archived_at
          )
        `)
        .eq('organization_id', organizationId)
        .order('updated_at', { ascending: false })

      if (error) throw new Error(`Could not load channels: ${error.message}`)
      return ((data ?? []) as ChannelRow[]).map((row) => {
        const activeMemberships =
          row.channel_memberships?.filter(isActiveMembership) ?? []
        const memberIds = Array.from(
          new Set(activeMemberships.map((membership) => membership.member_id)),
        )
        return {
          id: row.id,
          organizationId: row.organization_id,
          name: row.name,
          displayName: row.display_name,
          purpose: row.purpose,
          type: row.type,
          visibility: row.visibility,
          ownerMemberId: row.owner_member_id,
          locationIds:
            row.channel_locations?.map((scope) => scope.location_id) ?? [],
          departmentIds:
            row.channel_departments?.map((scope) => scope.department_id) ?? [],
          memberIds,
          memberCount: memberIds.length,
          canSend: activeMemberships.some(
            (membership) =>
              membership.member_id === currentMemberId && membership.can_send,
          ),
          isUrgent: row.is_urgent,
          archiveAt: row.archive_at,
        }
      })
    },

    async listMembers(organizationId) {
      const { data: memberData, error: memberError } = await client
        .from('organization_members')
        .select('id, user_id, employment_type, status')
        .eq('organization_id', organizationId)

      if (memberError) {
        throw new Error(`Could not load organization members: ${memberError.message}`)
      }

      const memberRows = (memberData ?? []) as MemberRow[]
      const userIds = Array.from(new Set(memberRows.map((row) => row.user_id)))
      if (userIds.length === 0) return []

      const { data: profileData, error: profileError } = await client
        .from('profiles')
        .select('id, full_name, work_email')
        .in('id', userIds)

      if (profileError) {
        throw new Error(`Could not load member profiles: ${profileError.message}`)
      }

      const profiles = new Map(
        ((profileData ?? []) as ProfileRow[]).map((profile) => [
          profile.id,
          profile,
        ]),
      )

      return memberRows.flatMap((member) => {
        const profile = profiles.get(member.user_id)
        return profile
          ? [{
              memberId: member.id,
              userId: member.user_id,
              fullName: profile.full_name,
              workEmail: profile.work_email,
              employmentType: member.employment_type,
              status: member.status,
            }]
          : []
      })
    },

    async listMessages(
      organizationId,
      channelId,
      cursor?: MessageCursor,
      pageSize = 50,
    ): Promise<MessagePage> {
      const limit = Math.min(Math.max(pageSize, 1), 100)
      let query = client
        .from('messages')
        .select(messageSelect)
        .eq('organization_id', organizationId)
        .eq('channel_id', channelId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(limit + 1)

      if (cursor) {
        query = query.or(
          `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
        )
      }

      const { data, error } = await query
      if (error) throw new Error(`Could not load messages: ${error.message}`)

      const rows = (data ?? []) as MessageRow[]
      const pageRows = rows.slice(0, limit)
      const oldestRow = pageRows.at(-1)
      return {
        items: pageRows.map(mapMessage).reverse(),
        nextCursor:
          rows.length > limit && oldestRow
            ? { createdAt: oldestRow.created_at, id: oldestRow.id }
            : null,
      }
    },

    async sendMessage(command: SendMessageCommand) {
      const clientMessageId = command.clientMessageId ?? crypto.randomUUID()
      const { data, error } = await client
        .rpc('send_message_with_attachments', {
          target_organization_id: command.organizationId,
          target_channel_id: command.channelId,
          target_author_member_id: command.authorMemberId,
          target_client_message_id: clientMessageId,
          target_body: command.body.trim(),
          target_is_urgent: command.isUrgent,
          target_attachment_ids: command.attachmentIds ?? [],
        })
        .single()

      if (error) throw new Error(`Could not send message: ${error.message}`)
      return loadMessage(client, (data as MessageRow).id)
    },

    subscribeToMessages(channelId, onMessage, onError) {
      const channel = client
        .channel(`messages:${channelId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `channel_id=eq.${channelId}`,
          },
          (payload) => {
            const row = payload.new as MessageRow
            if (row.channel_id !== channelId) return
            void loadMessage(client, row.id)
              .then(onMessage)
              .catch((error: Error) => onError?.(error.message))
          },
        )
        .subscribe((status) => {
          if (['CHANNEL_ERROR', 'TIMED_OUT'].includes(status)) {
            onError?.(`Message subscription ended with ${status}.`)
          }
        })

      return {
        unsubscribe: async () => {
          await client.removeChannel(channel)
        },
      }
    },
  }
}

function mapMessage(row: MessageRow): MessagingMessage {
  const attachments = (row.message_attachments ?? []).flatMap((link) => {
    const attachment = Array.isArray(link.attachment)
      ? link.attachment[0]
      : link.attachment
    return attachment ? [mapAttachment(attachment)] : []
  })
  return {
    id: row.id,
    organizationId: row.organization_id,
    channelId: row.channel_id,
    authorMemberId: row.author_member_id,
    clientMessageId: row.client_message_id,
    body: row.body,
    isUrgent: row.is_urgent,
    taskId: row.task_id ?? undefined,
    meetingId: row.meeting_id ?? undefined,
    createdAt: row.created_at,
    attachmentIds: attachments.map((attachment) => attachment.id),
    attachments,
  }
}

async function loadMessage(client: typeof supabase, messageId: string) {
  const { data, error } = await client
    .from('messages')
    .select(messageSelect)
    .eq('id', messageId)
    .single()
  if (error) throw new Error(`Could not load sent message: ${error.message}`)
  return mapMessage(data as MessageRow)
}

function mapAttachment(row: AttachmentRow): MessagingAttachment {
  return {
    id: row.id,
    organizationId: row.organization_id,
    channelId: row.channel_id,
    uploaderMemberId: row.uploader_member_id,
    originalName: row.original_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    status: row.status,
    scanStatus: row.scan_status,
    createdAt: row.created_at,
  }
}

function isActiveMembership(
  membership: NonNullable<ChannelRow['channel_memberships']>[number],
) {
  const now = Date.now()
  return (
    membership.archived_at === null
    && Date.parse(membership.starts_at) <= now
    && (
      membership.expires_at === null
      || Date.parse(membership.expires_at) > now
    )
  )
}
