import {
  type InfiniteData,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type {
  MessageCursor,
  MessagePage,
  MessagingChannel,
  MessagingMember,
  MessagingMessage,
  MessagingRepository,
} from '../services/messagingRepository'
import {
  createSupabaseAttachmentRepository,
  formatBytes,
  type AttachmentRepository,
} from '../services/attachmentRepository'
import { createSupabaseMessagingRepository } from '../services/supabaseMessagingRepository'
import { validateUploadFiles } from '../services/uploadAdapter'
import type {
  Attachment,
  Channel,
  Message,
  SendMessageInput,
} from '../types/domain'
import { useAuth } from './AuthContext'
import { useClinic } from './ClinicContext'

export interface MessagingViewMember extends MessagingMember {
  initials: string
  presence: 'online' | 'away' | 'offline'
}

interface MessagingContextValue {
  isProduction: boolean
  channels: Channel[]
  members: MessagingViewMember[]
  currentMemberId: string
  organizationId: string | null
  isLoading: boolean
  error: string | null
  supportsAttachments: boolean
  supportsChannelCreation: boolean
  supportsIntegrations: boolean
  canSendMessage: (channelId: string) => boolean
  uploadAttachments: (
    files: File[],
    channelId: string,
    onProgress?: (file: File, update: AttachmentUploadUpdate) => void,
    signal?: AbortSignal,
  ) => Promise<Attachment[]>
  downloadAttachment: (attachmentId: string) => Promise<string>
  sendMessage: (input: SendMessageInput) => Promise<Message | null>
  repository: MessagingRepository
}

export interface AttachmentUploadUpdate {
  status: 'uploading' | 'finalizing' | 'complete' | 'failed'
  percentage: number
  attachmentId?: string
  error?: string
}

export interface MessagingThreadState {
  messages: Message[]
  isLoading: boolean
  error: string | null
  hasOlderMessages: boolean
  isLoadingOlder: boolean
  loadOlderMessages: () => Promise<void>
}

const MessagingContext = createContext<MessagingContextValue | null>(null)

export function MessagingProvider({
  authEnabled,
  repository: repositoryOverride,
  attachmentRepository: attachmentRepositoryOverride,
  children,
}: PropsWithChildren<{
  authEnabled: boolean
  repository?: MessagingRepository
  attachmentRepository?: AttachmentRepository
}>) {
  const clinic = useClinic()
  const auth = useAuth()
  const queryClient = useQueryClient()
  const repository = useMemo(
    () => repositoryOverride ?? createSupabaseMessagingRepository(),
    [repositoryOverride],
  )
  const attachmentRepository = useMemo(
    () => attachmentRepositoryOverride ?? createSupabaseAttachmentRepository(),
    [attachmentRepositoryOverride],
  )
  const membership = authEnabled && auth.status === 'active' ? auth.membership : null
  const productionEnabled =
    authEnabled && auth.status === 'active' && membership !== null
  const attachmentsEnabled =
    productionEnabled && import.meta.env.VITE_ENABLE_ATTACHMENTS === 'true'
  const activeMemberId = membership?.id
  const activeOrganizationId = membership?.organizationId

  useEffect(() => {
    if (!activeMemberId) return
    return () => {
      queryClient.removeQueries({
        predicate: ({ queryKey }) => queryKey[0] === 'messaging'
          && queryKey[2] === activeOrganizationId
          && queryKey.at(-1) === activeMemberId,
      })
    }
  }, [activeMemberId, activeOrganizationId, queryClient])

  const channelsQuery = useQuery({
    queryKey: [
      'messaging',
      'channels',
      membership?.organizationId,
      membership?.id,
    ],
    queryFn: () => repository.listChannels(
      membership!.organizationId,
      membership!.id,
    ),
    enabled: productionEnabled,
  })

  const membersQuery = useQuery({
    queryKey: ['messaging', 'members', membership?.organizationId, membership?.id],
    queryFn: () => repository.listMembers(membership!.organizationId),
    enabled: productionEnabled,
  })

  const productionChannels = useMemo(
    () => (channelsQuery.data ?? []).map(mapChannel),
    [channelsQuery.data],
  )
  const productionMembers = useMemo(
    () => (membersQuery.data ?? []).map(mapMember),
    [membersQuery.data],
  )
  const appendToMessageCache = useCallback((message: MessagingMessage) => {
    if (!membership) return
    queryClient.setQueryData<InfiniteData<MessagePage, MessageCursor | undefined>>(
      messageQueryKey(membership.organizationId, message.channelId, membership.id),
      (current) => current ? appendMessage(current, message) : undefined,
    )
  }, [membership, queryClient])

  const value = useMemo<MessagingContextValue>(() => {
    if (!authEnabled) {
      return createPreviewValue(clinic, repository)
    }

    const error = channelsQuery.error ?? membersQuery.error
    return {
      isProduction: true,
      channels: productionChannels,
      members: productionMembers,
      currentMemberId: membership?.id ?? '',
      organizationId: membership?.organizationId ?? null,
      isLoading:
        productionEnabled
        && (channelsQuery.isPending || membersQuery.isPending),
      error: error instanceof Error ? error.message : null,
      supportsAttachments: attachmentsEnabled,
      supportsChannelCreation: true,
      supportsIntegrations: true,
      canSendMessage: (channelId) => (
        productionChannels.find((channel) => channel.id === channelId)
          ?.canSend ?? false
      ),
      uploadAttachments: async (files, channelId, onProgress, signal) => {
        const validation = validateUploadFiles(files)
        if (validation) throw new Error(validation)
        return Promise.all(files.map(async (file) => {
          try {
            onProgress?.(file, { status: 'uploading', percentage: 0 })
            const initialized =
              await attachmentRepository.initializeUpload(file, channelId)
            await attachmentRepository.uploadResumable(file, initialized, {
              signal,
              onProgress: ({ percentage }) => {
                onProgress?.(file, { status: 'uploading', percentage })
              },
            })
            onProgress?.(file, {
              status: 'finalizing',
              percentage: 100,
              attachmentId: initialized.id,
            })
            const finalized =
              await attachmentRepository.finalizeUpload(initialized.id)
            onProgress?.(file, {
              status: 'complete',
              percentage: 100,
              attachmentId: finalized.id,
            })
            return finalized
          } catch (caught) {
            const message = caught instanceof Error
              ? caught.message
              : 'Could not upload the attachment.'
            onProgress?.(file, {
              status: 'failed',
              percentage: 0,
              error: message,
            })
            throw caught
          }
        }))
      },
      downloadAttachment: attachmentRepository.getDownloadUrl,
      sendMessage: async (input) => {
        if (!membership) return null
        const channel = productionChannels.find(
          (item) => item.id === input.channelId,
        )
        if (!channel?.canSend) return null
        const message = await repository.sendMessage({
          organizationId: membership.organizationId,
          channelId: input.channelId,
          authorMemberId: membership.id,
          body: input.body,
          isUrgent: input.urgent,
          attachmentIds: input.attachmentIds ?? [],
        })
        appendToMessageCache(message)
        return mapMessage(message)
      },
      repository,
    }
  }, [
    appendToMessageCache,
    attachmentRepository,
    attachmentsEnabled,
    authEnabled,
    channelsQuery.error,
    channelsQuery.isPending,
    clinic,
    membership,
    membersQuery.error,
    membersQuery.isPending,
    productionChannels,
    productionEnabled,
    productionMembers,
    repository,
  ])

  return (
    <MessagingContext.Provider value={value}>
      {children}
    </MessagingContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMessaging() {
  const context = useContext(MessagingContext)
  const clinic = useClinic()
  const fallbackRepository = useMemo(
    () => createSupabaseMessagingRepository(),
    [],
  )
  return context ?? createPreviewValue(clinic, fallbackRepository)
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMessagingThread(channelId: string): MessagingThreadState {
  const clinic = useClinic()
  const messaging = useMessaging()
  const queryClient = useQueryClient()
  const [realtimeError, setRealtimeError] = useState<string | null>(null)
  const enabled = (
    messaging.isProduction
    && messaging.organizationId !== null
    && channelId.length > 0
  )
  const queryKey = useMemo(
    () => messageQueryKey(
      messaging.organizationId ?? 'preview',
      channelId,
      messaging.currentMemberId,
    ),
    [channelId, messaging.organizationId, messaging.currentMemberId],
  )

  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => messaging.repository.listMessages(
      messaging.organizationId!,
      channelId,
      pageParam,
    ),
    initialPageParam: undefined as MessageCursor | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled,
  })

  useEffect(() => {
    if (!enabled) return
    setRealtimeError(null)
    const subscription = messaging.repository.subscribeToMessages(
      channelId,
      (message) => {
        queryClient.setQueryData<
          InfiniteData<MessagePage, MessageCursor | undefined>
        >(queryKey, (current) => current ? appendMessage(current, message) : undefined)
      },
      setRealtimeError,
    )
    return () => {
      void subscription.unsubscribe()
    }
  }, [
    channelId,
    enabled,
    messaging.repository,
    queryClient,
    queryKey,
  ])

  if (!messaging.isProduction) {
    return {
      messages: clinic.messages.filter(
        (message) => message.channelId === channelId,
      ),
      isLoading: false,
      error: null,
      hasOlderMessages: false,
      isLoadingOlder: false,
      loadOlderMessages: async () => {},
    }
  }

  const messages = deduplicateMessages(
    (query.data?.pages ?? [])
      .slice()
      .reverse()
      .flatMap((page) => page.items),
  ).map(mapMessage)
  const queryError = query.error instanceof Error ? query.error.message : null

  return {
    messages,
    isLoading: query.isPending,
    error: realtimeError ?? queryError,
    hasOlderMessages: Boolean(query.hasNextPage),
    isLoadingOlder: query.isFetchingNextPage,
    loadOlderMessages: async () => {
      await query.fetchNextPage()
    },
  }
}

function createPreviewValue(
  clinic: ReturnType<typeof useClinic>,
  repository: MessagingRepository,
): MessagingContextValue {
  return {
    isProduction: false,
    channels: clinic.channels,
    members: clinic.users.map((user) => ({
      memberId: user.id,
      userId: user.id,
      fullName: user.name,
      workEmail: user.email,
      employmentType: 'employee',
      status: 'active',
      initials: user.initials,
      presence: user.presence,
    })),
    currentMemberId: clinic.currentUser.id,
    organizationId: clinic.organization.id,
    isLoading: false,
    error: null,
    supportsAttachments: true,
    supportsChannelCreation: true,
    supportsIntegrations: true,
    canSendMessage: clinic.canSendMessage,
    sendMessage: async (input) => clinic.sendMessage(input),
    uploadAttachments: (files, channelId) => clinic.uploadAttachments(
      files,
      { kind: 'message', channelId },
    ),
    downloadAttachment: async (attachmentId) => {
      const attachment = clinic.attachments.find(
        (item) => item.id === attachmentId,
      )
      const url = attachment?.downloadUrl ?? attachment?.previewUrl
      if (!url) throw new Error('This attachment is not available.')
      return url
    },
    repository,
  }
}

function mapChannel(channel: MessagingChannel): Channel & { canSend: boolean } {
  return {
    id: channel.id,
    name: channel.name,
    displayName: channel.displayName,
    purpose: channel.purpose,
    type: channel.type,
    visibility: channel.visibility,
    locationIds: channel.locationIds,
    departmentIds: channel.departmentIds,
    ownerId: channel.ownerMemberId,
    memberIds: channel.memberIds,
    unreadCount: 0,
    isUrgent: channel.isUrgent,
    archiveAt: channel.archiveAt ?? undefined,
    canSend: channel.canSend,
  }
}

function mapMember(member: MessagingMember): MessagingViewMember {
  return {
    ...member,
    initials: member.fullName
      .split(/\s+/)
      .filter(Boolean)
      .slice(-2)
      .map((part) => part[0]?.toLocaleUpperCase())
      .join(''),
    presence: 'offline',
  }
}

function mapMessage(message: MessagingMessage): Message {
  return {
    id: message.id,
    channelId: message.channelId,
    authorId: message.authorMemberId,
    body: message.body,
    createdAt: message.createdAt,
    isUrgent: message.isUrgent,
    taskId: message.taskId,
    meetingId: message.meetingId,
    attachmentIds: message.attachmentIds,
    attachments: message.attachments.map((attachment) => ({
      id: attachment.id,
      name: attachment.originalName,
      type: attachment.mimeType,
      sizeLabel: formatBytes(attachment.sizeBytes),
      sizeBytes: attachment.sizeBytes,
      uploadedBy: attachment.uploaderMemberId,
      uploadedAt: attachment.createdAt,
      channelId: attachment.channelId,
      messageId: message.id,
      status: attachment.status,
      scanStatus: attachment.scanStatus,
    })),
  }
}

function messageQueryKey(organizationId: string, channelId: string, memberId: string) {
  return ['messaging', 'messages', organizationId, channelId, memberId] as const
}

function appendMessage(
  current: InfiniteData<MessagePage, MessageCursor | undefined> | undefined,
  message: MessagingMessage,
): InfiniteData<MessagePage, MessageCursor | undefined> {
  if (!current) {
    return {
      pages: [{ items: [message], nextCursor: null }],
      pageParams: [undefined],
    }
  }
  if (
    current.pages.some((page) => page.items.some(
      (item) => (
        item.id === message.id
        || item.clientMessageId === message.clientMessageId
      ),
    ))
  ) {
    return current
  }
  const [newestPage, ...olderPages] = current.pages
  return {
    ...current,
    pages: [
      {
        ...newestPage,
        items: [...newestPage.items, message].sort(compareMessages),
      },
      ...olderPages,
    ],
  }
}

function deduplicateMessages(messages: MessagingMessage[]) {
  const unique = new Map<string, MessagingMessage>()
  for (const message of messages) {
    unique.set(message.id, message)
  }
  return Array.from(unique.values()).sort(compareMessages)
}

function compareMessages(left: MessagingMessage, right: MessagingMessage) {
  return (
    left.createdAt.localeCompare(right.createdAt)
    || left.id.localeCompare(right.id)
  )
}
