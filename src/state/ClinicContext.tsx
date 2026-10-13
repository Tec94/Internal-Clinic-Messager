import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { users as seedUsers } from '../data/seed'
import type {
  ClinicRepository,
  ClinicSnapshot,
  PreviewChatState,
  RepositoryScope,
} from '../services/clinicRepository'
import { createInMemoryClinicRepository } from '../services/inMemoryClinicRepository'
import type { MessagingChannel } from '../services/messagingRepository'
import { hasPermission } from '../services/permissions'
import { createSupabaseClinicRepository } from '../services/supabaseClinicRepository'
import type {
  Announcement,
  Attachment,
  CreateAnnouncementInput,
  CreateChannelInput,
  CreateMeetingInput,
  CreateTaskInput,
  Location,
  Meeting,
  MeetingResponseStatus,
  Message,
  Permission,
  RoleBinding,
  SaveLocationInput,
  SaveMemberAssignmentInput,
  SaveOrganizationSettingsInput,
  SendMessageInput,
  Task,
  TaskTransitionAction,
  UpdateTaskInput,
  UploadTarget,
  User,
} from '../types/domain'
import { useOptionalAuth } from './AuthContext'

// Preview mode only (the in-memory adapter). Production has no persona
// switching, and its Chat lives in MessagingContext.
export interface PreviewCapabilities extends PreviewChatState {
  setCurrentUserId: (userId: string) => void
  sendMessage: (input: SendMessageInput) => Promise<Message | null>
  uploadAttachments: (files: File[], target: UploadTarget) => Promise<Attachment[]>
}

export interface ClinicContextValue extends Omit<ClinicSnapshot, 'chat'> {
  // null in production.
  preview: PreviewCapabilities | null
  currentUser: User
  currentBinding: RoleBinding
  // 'all' in production. Preview mode lets the viewer pick a Location.
  currentLocationId: string
  setCurrentLocationId: (locationId: string) => void
  hasPermission: (permission: Permission) => boolean
  createChannel: (input: CreateChannelInput) => Promise<string>
  ensureDirectChannel: (targetUserId: string) => Promise<string | null>
  createTask: (input: CreateTaskInput) => Promise<Task>
  updateTask: (taskId: string, patch: UpdateTaskInput) => Promise<void>
  respondToTask: (
    taskId: string,
    response: 'accept' | 'decline',
    reason?: string,
  ) => Promise<void>
  transitionTask: (
    taskId: string,
    action: TaskTransitionAction,
    reason?: string,
    reopenItemId?: string,
  ) => Promise<void>
  reassignTask: (taskId: string, ownerId: string, reason: string) => Promise<void>
  setTaskScheduleActive: (scheduleId: string, active: boolean) => Promise<void>
  createMeeting: (input: CreateMeetingInput) => Promise<Meeting>
  respondToMeeting: (meetingId: string, status: MeetingResponseStatus) => Promise<void>
  createAnnouncement: (input: CreateAnnouncementInput) => Promise<Announcement>
  saveOrganizationSettings: (input: SaveOrganizationSettingsInput) => Promise<void>
  saveLocation: (input: SaveLocationInput) => Promise<Location>
  saveMemberAssignment: (input: SaveMemberAssignmentInput) => Promise<void>
  resolveAccessRequest: (requestId: string, status: 'approved' | 'denied') => Promise<void>
}

export const ClinicContext = createContext<ClinicContextValue | null>(null)

function getInitialUserId() {
  const saved = localStorage.getItem('clinic-persona')
  return seedUsers.some((user) => user.id === saved) ? saved! : 'user-employee'
}

export function ClinicProvider({
  children,
  authEnabled = false,
}: PropsWithChildren<{ authEnabled?: boolean }>) {
  const auth = useOptionalAuth()
  const queryClient = useQueryClient()
  const supabaseRepository = useMemo(() => createSupabaseClinicRepository(), [])
  const [inMemoryRepository] = useState(createInMemoryClinicRepository)
  const [personaId, setPersonaId] = useState(getInitialUserId)
  const [previewLocationId, setPreviewLocationId] = useState('loc-a')
  const membership = authEnabled && auth?.status === 'active' ? auth.membership : null
  // The one place that picks an adapter. Everything below runs one code path.
  const repository: ClinicRepository = membership ? supabaseRepository : inMemoryRepository
  const scope = useMemo<RepositoryScope>(() => membership
    ? { organizationId: membership.organizationId, memberId: membership.id }
    : { organizationId: inMemoryRepository.peekSnapshot().organization.id, memberId: personaId },
  [membership, inMemoryRepository, personaId])
  // The in-memory snapshot is the same for every persona, so a persona change keeps the cache.
  const queryKey = useMemo(
    () => ['clinic', 'snapshot', scope.organizationId, membership ? scope.memberId : 'preview'],
    [scope, membership],
  )
  const queryFn = useCallback(() => repository.loadSnapshot(scope), [repository, scope])
  const snapshotQuery = useQuery({
    queryKey,
    queryFn,
    initialData: membership ? undefined : inMemoryRepository.peekSnapshot,
  })

  const refetch = snapshotQuery.refetch

  useEffect(() => {
    if (!membership) return
    return () => { queryClient.removeQueries({ queryKey, exact: true }) }
  }, [membership, queryClient, queryKey])

  useEffect(
    () => repository.subscribe?.(scope, () => { void refetch() }),
    [repository, scope, refetch],
  )

  if (snapshotQuery.isPending) {
    return <div className="route-loading" role="status">Loading…</div>
  }
  if (snapshotQuery.error || !snapshotQuery.data) {
    return (
      <div className="route-loading" role="alert">
        {snapshotQuery.error instanceof Error
          ? snapshotQuery.error.message
          : 'Could not load the workspace.'}
      </div>
    )
  }

  const snapshot = snapshotQuery.data
  const currentUser = snapshot.users.find((user) => user.id === scope.memberId)
  const currentBinding = snapshot.roleBindings.find(
    (binding) => binding.userId === scope.memberId,
  )
  if (!currentUser || !currentBinding) {
    return (
      <div className="route-loading" role="alert">
        The account has no active role assignment.
      </div>
    )
  }

  const refreshSnapshot = async () => {
    const result = await refetch()
    if (!result.data) throw result.error ?? new Error('Could not load the workspace.')
    return result.data
  }
  const mutate = async (run: () => Promise<unknown>) => {
    await run()
    await refreshSnapshot()
  }
  // Runs a create or save, reloads the snapshot, and returns the stored record.
  const mutateAndFind = async <T extends { id: string }>(
    run: () => Promise<string>,
    pick: (next: ClinicSnapshot) => T[],
    label: string,
  ) => {
    const id = await run()
    const found = pick(await refreshSnapshot()).find((item) => item.id === id)
    if (!found) throw new Error(`The ${label} could not be loaded.`)
    return found
  }
  // Preview Channels come with the snapshot. In production, Chat owns them
  // (MessagingContext), so refresh that query too so a new Channel opens at once.
  const refreshChannels = async (id: string) => {
    const [refreshed] = await Promise.all([
      refreshSnapshot(),
      queryClient.refetchQueries({ queryKey: ['messaging', 'channels'] }),
    ])
    const channels = refreshed.chat?.channels ?? queryClient.getQueryData<MessagingChannel[]>(
      ['messaging', 'channels', scope.organizationId, scope.memberId],
    ) ?? []
    return channels.some((channel) => channel.id === id)
  }

  const { chat, ...shared } = snapshot
  const preview: PreviewCapabilities | null = membership || !chat ? null : {
    ...chat,
    setCurrentUserId: (userId) => {
      const binding = snapshot.roleBindings.find((item) => item.userId === userId)
      if (!binding) return
      setPersonaId(userId)
      localStorage.setItem('clinic-persona', userId)
      if (!binding.locationIds.includes(previewLocationId)) {
        setPreviewLocationId(binding.locationIds[0] ?? 'loc-a')
      }
    },
    sendMessage: async (input) => {
      const message = await inMemoryRepository.sendMessage(scope, input)
      await refreshSnapshot()
      return message
    },
    uploadAttachments: async (files, target) => {
      const uploaded = await inMemoryRepository.uploadAttachments(scope, files, target)
      await refreshSnapshot()
      return uploaded
    },
  }

  const value: ClinicContextValue = {
    ...shared,
    preview,
    currentUser,
    currentBinding,
    // Production shows every Location the Member can see; RLS limits the rows.
    currentLocationId: preview ? previewLocationId : 'all',
    setCurrentLocationId: setPreviewLocationId,
    hasPermission: (permission) => hasPermission(currentBinding, permission),
    createChannel: async (input) => {
      const id = await repository.createChannel(scope, input)
      if (!await refreshChannels(id)) {
        throw new Error('The created channel could not be loaded.')
      }
      return id
    },
    ensureDirectChannel: async (targetUserId) => {
      if (targetUserId === scope.memberId) return null
      const id = await repository.ensureDirectChannel(scope, targetUserId)
      return await refreshChannels(id) ? id : null
    },
    createTask: (input) => mutateAndFind(
      () => repository.createTask(scope, input), (next) => next.tasks, 'created task',
    ),
    updateTask: async (taskId, patch) => {
      const task = snapshot.tasks.find((item) => item.id === taskId)
      if (!task || !patch.checklist) return
      const changes = patch.checklist.filter((item) => (
        task.checklist.find((current) => current.id === item.id)?.completed
        !== item.completed
      ))
      await mutate(() => Promise.all(changes.map((item) =>
        repository.setTaskChecklistItem(scope, taskId, item.id, item.completed),
      )))
    },
    respondToTask: (taskId, response, reason) =>
      mutate(() => repository.respondToTask(scope, taskId, response, reason)),
    transitionTask: (taskId, action, reason, reopenItemId) =>
      mutate(() => repository.transitionTask(scope, taskId, action, reason, reopenItemId)),
    reassignTask: (taskId, ownerId, reason) =>
      mutate(() => repository.reassignTask(scope, taskId, ownerId, reason)),
    setTaskScheduleActive: (scheduleId, active) =>
      mutate(() => repository.setTaskScheduleActive(scope, scheduleId, active)),
    createMeeting: (input) => mutateAndFind(
      () => repository.createMeeting(scope, input), (next) => next.meetings, 'created meeting',
    ),
    respondToMeeting: (meetingId, status) =>
      mutate(() => repository.respondToMeeting(scope, meetingId, status)),
    createAnnouncement: (input) => mutateAndFind(
      () => repository.createAnnouncement(scope, input),
      (next) => next.announcements,
      'created announcement',
    ),
    saveOrganizationSettings: (input) =>
      mutate(() => repository.saveOrganizationSettings(scope, input)),
    saveLocation: (input) => mutateAndFind(
      () => repository.saveLocation(scope, input), (next) => next.locations, 'saved location',
    ),
    saveMemberAssignment: (input) =>
      mutate(() => repository.saveMemberAssignment(scope, input)),
    resolveAccessRequest: (requestId, status) =>
      mutate(() => repository.resolveAccessRequest(scope, requestId, status)),
  }

  return (
    <ClinicContext.Provider value={value}>
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
