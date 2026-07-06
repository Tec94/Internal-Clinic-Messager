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
import { IntegrationPanel } from '../components/IntegrationPanel'
import { MessageThread } from '../components/MessageThread'
import { Button, ChannelGlyph, IconButton } from '../components/ui'
import { detectMeetingCandidate, inspectOperationalContent } from '../services/mockClinicService'
import { useClinic } from '../state/ClinicContext'
import type { MeetingCandidate } from '../types/domain'
import { MeetingConfirmationDialog } from '../components/MeetingConfirmationDialog'

export function ChannelPage() {
  const { channelId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const { t } = useTranslation()
  const { channels, locations, sendMessage, createMeeting } = useClinic()
  const channel = channels.find((item) => item.id === channelId)
  const [draft, setDraft] = useState('')
  const [urgent, setUrgent] = useState(false)
  const [showWarning, setShowWarning] = useState(false)
  const pendingDraft = useRef('')
  const panelTrigger = useRef<HTMLButtonElement | null>(null)
  const [meetingCandidate, setMeetingCandidate] = useState<MeetingCandidate | null>(null)

  const activePanel = searchParams.get('panel') as 'tasks' | 'documents' | null
  const memberCount = channel?.memberIds.length ?? 0

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

  if (!channel) return <Navigate to="/channels/front-desk-home" replace />

  const submitMessage = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = draft.trim()
    if (!trimmed) return
    if (inspectOperationalContent(trimmed).length > 0) {
      pendingDraft.current = trimmed
      setShowWarning(true)
      return
    }
    continueSend(trimmed)
  }

  const confirmSend = () => {
    setShowWarning(false)
    continueSend(pendingDraft.current)
  }

  const continueSend = (body: string) => {
    const candidate = detectMeetingCandidate(body, 'Asia/Ho_Chi_Minh')
    if (candidate) {
      pendingDraft.current = body
      setMeetingCandidate(candidate)
      return
    }
    sendMessage(channel.id, body, urgent)
    clearComposer()
  }

  const clearComposer = () => {
    setDraft('')
    setUrgent(false)
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
            <div className="channel-title-row"><ChannelGlyph channel={channel} /><h1>{channel.name}</h1></div>
            <p>{channel.purpose} <span>•</span> {scopeLabel}</p>
          </div>
          <div className="channel-header-actions">
            <span className="member-count"><UsersRound size={18} />{memberCount}</span>
            <IconButton aria-label={t('channel.channelInfo')}><Info size={20} /></IconButton>
            <label className="channel-search"><Search size={17} /><span className="sr-only">{t('channel.searchPlaceholder')}</span><input placeholder={t('channel.searchPlaceholder')} /></label>
            <IconButton className={activePanel === 'tasks' ? 'is-active' : ''} aria-label={t('channel.openTasks')} aria-pressed={activePanel === 'tasks'} onClick={(event) => openPanel('tasks', event.currentTarget)}><ListChecks size={20} /></IconButton>
            <IconButton className={activePanel === 'documents' ? 'is-active' : ''} aria-label={t('channel.openDocuments')} aria-pressed={activePanel === 'documents'} onClick={(event) => openPanel('documents', event.currentTarget)}><FileText size={20} /></IconButton>
          </div>
        </header>

        <div className="thread-scroll"><MessageThread channel={channel} /></div>

        <div className="composer-region">
          <small>{t('channel.typing', { name: 'Võ Thành Nam' })}</small>
          <form className={`composer ${urgent ? 'composer--urgent' : ''}`} onSubmit={submitMessage}>
            <IconButton aria-label={t('channel.attachFile')}><Paperclip size={20} /></IconButton>
            <label><span className="sr-only">{t('channel.messagePlaceholder', { channel: channel.name })}</span><textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={t('channel.messagePlaceholder', { channel: channel.name })} rows={1} /></label>
            <div className="composer-tools">
              <IconButton aria-label="Mention"><AtSign size={18} /></IconButton>
              <IconButton aria-label="Emoji"><Smile size={18} /></IconButton>
              <button type="button" className={`urgent-toggle ${urgent ? 'is-active' : ''}`} onClick={() => setUrgent((value) => !value)} aria-pressed={urgent}><AlertCircle size={17} />{t('channel.markUrgent')}</button>
              <IconButton className="send-button" type="submit" aria-label={t('channel.sendMessage')} disabled={!draft.trim()}><Send size={19} /></IconButton>
            </div>
          </form>
        </div>
      </section>

      {activePanel ? <IntegrationPanel channel={channel} initialTab={activePanel} onClose={closePanel} onTabChange={(panel) => setSearchParams({ panel })} /> : null}

      {meetingCandidate ? <MeetingConfirmationDialog key={meetingCandidate.joinUrl} channelId={channel.id} channelName={channel.displayName} body={pendingDraft.current} candidate={meetingCandidate} onCancel={() => setMeetingCandidate(null)} onSendPlain={() => { sendMessage(channel.id, pendingDraft.current, urgent); clearComposer() }} onCreate={(input) => { createMeeting(input); clearComposer() }} /> : null}

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
