import * as Dialog from '@radix-ui/react-dialog'
import {
  AlertCircle,
  AtSign,
  FileText,
  Info,
  ListChecks,
  Paperclip,
  Search,
  Send,
  Smile,
  UsersRound,
  X,
} from 'lucide-react'
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useParams, useSearchParams } from 'react-router-dom'
import { ChannelMembersDrawer } from '../components/ChannelMembersDrawer'
import { IntegrationPanel } from '../components/IntegrationPanel'
import { MessageThread } from '../components/MessageThread'
import { TaskAssignmentDrawer } from '../components/TaskAssignmentDrawer'
import { Button, ChannelGlyph, IconButton } from '../components/ui'
import { FileUpload, type FileUploadItem } from '../components/ui/motion/file-upload'
import { detectMeetingCandidate, inspectOperationalContent } from '../services/mockClinicService'
import { ACCEPTED_ATTACHMENT_EXTENSIONS, MAX_ATTACHMENT_FILES } from '../services/uploadAdapter'
import { useClinic } from '../state/ClinicContext'
import { useMessaging } from '../state/MessagingContext'
import type { MeetingCandidate } from '../types/domain'
import { MeetingConfirmationDialog } from '../components/MeetingConfirmationDialog'
import { useNativeBackHandler } from '../native/useNativePlatform'

export function ChannelPage() {
  const { channelId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const { t } = useTranslation()
  const { locations, createMeeting } = useClinic()
  const {
    channels,
    isLoading,
    error: messagingError,
    supportsAttachments,
    supportsIntegrations,
    canSendMessage,
    uploadAttachments,
    sendMessage,
  } = useMessaging()
  const channel = channels.find((item) => item.id === channelId)
  const [draft, setDraft] = useState('')
  const [urgent, setUrgent] = useState(false)
  const [showWarning, setShowWarning] = useState(false)
  const [membersOpen, setMembersOpen] = useState(false)
  const [taskDrawerOpen, setTaskDrawerOpen] = useState(false)
  const [taskSourceMessageId, setTaskSourceMessageId] = useState<string | undefined>()
  const [taskSourceText, setTaskSourceText] = useState<string | undefined>()
  const [composerFiles, setComposerFiles] = useState<FileUploadItem[]>([])
  const [attachmentsOpen, setAttachmentsOpen] = useState(false)
  const [composerError, setComposerError] = useState('')
  const [sending, setSending] = useState(false)
  const pendingDraft = useRef('')
  const uploadAbortController = useRef<AbortController | null>(null)
  const panelTrigger = useRef<HTMLButtonElement | null>(null)
  const [meetingCandidate, setMeetingCandidate] = useState<MeetingCandidate | null>(null)

  const activePanel = searchParams.get('panel') as 'tasks' | 'documents' | null
  const memberCount = channel?.memberIds.length ?? 0
  const channelTitle = channel?.type === 'direct' ? channel.displayName : channel?.name

  useNativeBackHandler(Boolean(meetingCandidate || showWarning || taskDrawerOpen || membersOpen || activePanel || attachmentsOpen), () => {
    if (meetingCandidate) setMeetingCandidate(null)
    else if (showWarning) setShowWarning(false)
    else if (taskDrawerOpen) closeTaskDrawer(false)
    else if (membersOpen) setMembersOpen(false)
    else if (activePanel) setSearchParams({})
    else setAttachmentsOpen(false)
    return true
  })

  useEffect(() => {
    if (!activePanel && panelTrigger.current) {
      const trigger = panelTrigger.current
      window.setTimeout(() => trigger.focus(), 0)
    }
  }, [activePanel])

  const scopeLabel = useMemo(() => {
    if (!channel) return ''
    if (channel.locationIds.length > 1) return t('common.allLocations')
    return locations.find((location) => location.id === channel.locationIds[0])?.shortName ?? ''
  }, [channel, locations, t])

  if (isLoading) {
    return <div className="route-loading" role="status">{t('common.loading')}</div>
  }
  if (messagingError) {
    return <div className="route-loading" role="alert">{messagingError}</div>
  }
  if (!channel) return <Navigate to="/channels" replace />

  const canSend = canSendMessage(channel.id)

  const submitMessage = (event: FormEvent) => {
    event.preventDefault()
    if (!canSend || sending) return
    const trimmed = draft.trim()
    if (!trimmed && composerFiles.length === 0) return
    if (inspectOperationalContent(trimmed).length > 0) {
      pendingDraft.current = trimmed
      setShowWarning(true)
      return
    }
    void continueSend(trimmed)
  }

  const confirmSend = () => {
    setShowWarning(false)
    void continueSend(pendingDraft.current)
  }

  const continueSend = async (body: string) => {
    if (!supportsIntegrations) {
      await sendPlainMessage(body)
      return
    }
    const candidate = detectMeetingCandidate(body, 'Asia/Ho_Chi_Minh')
    if (candidate) {
      pendingDraft.current = body
      setMeetingCandidate(candidate)
      return
    }
    await sendPlainMessage(body)
  }

  const uploadPendingAttachments = async () => {
    if (!supportsAttachments) return []
    const pendingItems = composerFiles.filter(
      (item) => item.file && !item.attachmentId,
    )
    if (pendingItems.length === 0) {
      return composerFiles.flatMap(
        (item) => item.attachmentId ? [item.attachmentId] : [],
      )
    }

    const controller = new AbortController()
    uploadAbortController.current = controller
    const uploaded = await uploadAttachments(
      pendingItems.map((item) => item.file!),
      channel.id,
      (file, update) => {
        setComposerFiles((items) => items.map((item) => (
          item.file === file
            ? {
                ...item,
                status: update.status,
                progress: update.percentage,
                attachmentId: update.attachmentId ?? item.attachmentId,
                error: update.error,
              }
            : item
        )))
      },
      controller.signal,
    )
    uploadAbortController.current = null

    const uploadedIds = new Map(
      pendingItems.map((item, index) => [item.id, uploaded[index]?.id]),
    )
    return composerFiles.flatMap((item) => {
      const attachmentId = item.attachmentId ?? uploadedIds.get(item.id)
      return attachmentId ? [attachmentId] : []
    })
  }

  const sendPlainMessage = async (body: string) => {
    if (!canSend) return
    setSending(true)
    setComposerError('')
    try {
      const attachmentIds = await uploadPendingAttachments()
      const sent = await sendMessage({
        channelId: channel.id,
        body: body || t('attachment.messageBody'),
        urgent,
        attachmentIds,
      })
      if (!sent) throw new Error(t('channel.viewOnlyDetail'))
      clearComposer()
    } catch (caught) {
      setComposerError(caught instanceof Error ? caught.message : t('attachment.uploadFailed'))
    } finally {
      uploadAbortController.current = null
      setSending(false)
    }
  }

  const openTaskDrawer = (messageId?: string, body?: string) => {
    setTaskSourceMessageId(messageId)
    setTaskSourceText(body)
    setTaskDrawerOpen(true)
  }

  const closeTaskDrawer = (open: boolean) => {
    setTaskDrawerOpen(open)
    if (!open) {
      setTaskSourceMessageId(undefined)
      setTaskSourceText(undefined)
    }
  }

  const finishMeetingCreate = (input: Parameters<typeof createMeeting>[0]) => {
    if (!canSend || !supportsIntegrations) return
    createMeeting(input)
    clearComposer()
  }

  const clearComposer = () => {
    setDraft('')
    setUrgent(false)
    setComposerFiles([])
    setAttachmentsOpen(false)
    setComposerError('')
    pendingDraft.current = ''
    setMeetingCandidate(null)
  }

  const openPanel = (panel: 'tasks' | 'documents', trigger: HTMLButtonElement) => {
    panelTrigger.current = trigger
    setSearchParams({ panel })
  }

  const closePanel = () => {
    setSearchParams({})
  }

  return (
    <div className={`channel-page ${activePanel ? 'channel-page--panel-open' : ''}`}>
      <section className="conversation-column">
        <header className="channel-header">
          <div className="channel-title-block">
            <div className="channel-title-row"><ChannelGlyph channel={channel} /><h1>{channelTitle}</h1></div>
            <p>{channel.purpose} <span>•</span> {scopeLabel}</p>
          </div>
          <div className="channel-header-actions">
            <button type="button" className="member-count" onClick={() => setMembersOpen(true)} aria-label={t('channel.viewMembers')}><UsersRound size={18} />{memberCount}</button>
            <IconButton aria-label={t('channel.channelInfo')} onClick={() => setMembersOpen(true)}><Info size={20} /></IconButton>
            <label className="channel-search"><Search size={17} /><span className="sr-only">{t('channel.searchPlaceholder')}</span><input placeholder={t('channel.searchPlaceholder')} /></label>
            {supportsIntegrations ? <IconButton className={activePanel === 'tasks' ? 'is-active' : ''} aria-label={t('channel.openTasks')} aria-pressed={activePanel === 'tasks'} onClick={(event) => openPanel('tasks', event.currentTarget)}><ListChecks size={20} /></IconButton> : null}
            {supportsIntegrations ? <IconButton className={activePanel === 'documents' ? 'is-active' : ''} aria-label={t('channel.openDocuments')} aria-pressed={activePanel === 'documents'} onClick={(event) => openPanel('documents', event.currentTarget)}><FileText size={20} /></IconButton> : null}
          </div>
        </header>

        <div className="thread-scroll"><MessageThread channel={channel} onAssignTask={supportsIntegrations ? openTaskDrawer : undefined} /></div>

        <div className="composer-region">
          <form className={`composer ${urgent ? 'composer--urgent' : ''}`} onSubmit={submitMessage}>
            {supportsAttachments ? <IconButton aria-label={t('channel.attachFile')} onClick={() => setAttachmentsOpen((value) => !value)} disabled={!canSend}><Paperclip size={20} /></IconButton> : null}
            <label><span className="sr-only">{t('channel.messagePlaceholder', { channel: channel.name })}</span><textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={canSend ? t('channel.messagePlaceholder', { channel: channel.name }) : t('channel.viewOnly')} rows={1} disabled={!canSend} /></label>
            <div className="composer-tools">
              <IconButton className="composer-secondary-action" aria-label="Mention" disabled={!canSend}><AtSign size={18} /></IconButton>
              <IconButton className="composer-secondary-action" aria-label="Emoji" disabled={!canSend}><Smile size={18} /></IconButton>
              <button type="button" className={`urgent-toggle ${urgent ? 'is-active' : ''}`} onClick={() => setUrgent((value) => !value)} aria-label={t('channel.markUrgent')} aria-pressed={urgent} title={t('channel.markUrgent')} disabled={!canSend}><AlertCircle size={17} /><span>{t('channel.markUrgent')}</span></button>
              <IconButton className="send-button" type="submit" aria-label={t('channel.sendMessage')} disabled={!canSend || sending || (!draft.trim() && composerFiles.length === 0)}><Send size={19} /></IconButton>
            </div>
            {supportsAttachments && (attachmentsOpen || composerFiles.length > 0) && canSend ? (
              <div className="composer-upload">
                <FileUpload
                  value={composerFiles}
                  onValueChange={setComposerFiles}
                  accept={ACCEPTED_ATTACHMENT_EXTENSIONS.join(',')}
                  maxFiles={MAX_ATTACHMENT_FILES}
                  title={t('attachment.dropTitle')}
                  description={t('attachment.dropDescription')}
                  browseLabel={t('attachment.browse')}
                  className="yksg-file-upload yksg-file-upload--compact"
                  disabled={sending}
                  onRemove={(item) => {
                    if (
                      item.status === 'uploading'
                      || item.status === 'finalizing'
                    ) {
                      uploadAbortController.current?.abort()
                    }
                  }}
                />
              </div>
            ) : null}
          </form>
          {!canSend ? <p className="composer-note">{t('channel.viewOnlyDetail')}</p> : null}
          {composerError ? <p className="field-error composer-error" role="alert">{composerError}</p> : null}
        </div>
      </section>

      {supportsIntegrations && activePanel ? <IntegrationPanel channel={channel} initialTab={activePanel} onClose={closePanel} onTabChange={(panel) => setSearchParams({ panel })} onAssignTask={() => openTaskDrawer()} /> : null}

      {supportsIntegrations && meetingCandidate ? <MeetingConfirmationDialog key={meetingCandidate.joinUrl} channelId={channel.id} channelName={channel.displayName} body={pendingDraft.current} candidate={meetingCandidate} onCancel={() => setMeetingCandidate(null)} onSendPlain={() => { void sendPlainMessage(pendingDraft.current) }} onCreate={finishMeetingCreate} /> : null}

      <ChannelMembersDrawer channel={channel} open={membersOpen} onOpenChange={setMembersOpen} />
      {supportsIntegrations ? <TaskAssignmentDrawer channel={channel} open={taskDrawerOpen} sourceMessageId={taskSourceMessageId} sourceText={taskSourceText} onOpenChange={closeTaskDrawer} /> : null}

      <Dialog.Root open={showWarning} onOpenChange={setShowWarning}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="warning-dialog">
            <header><AlertCircle size={24} /><Dialog.Title>{t('channel.phiPromptTitle')}</Dialog.Title><Dialog.Close asChild><IconButton aria-label={t('common.close')}><X size={20} /></IconButton></Dialog.Close></header>
            <Dialog.Description>{t('channel.phiPromptBody')}</Dialog.Description>
            <div className="warning-dialog__actions"><Button onClick={() => setShowWarning(false)}>{t('channel.returnToMessage')}</Button><Button variant="primary" onClick={confirmSend}>{t('channel.confirmSafe')}</Button></div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
