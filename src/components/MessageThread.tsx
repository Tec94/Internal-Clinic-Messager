import { CheckCircle2, ExternalLink, FileText, ListPlus, Video } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import i18n from '../i18n'
import { useNativePlatform } from '../native/useNativePlatform'
import { useClinic } from '../state/ClinicContext'
import { useMessaging, useMessagingThread } from '../state/MessagingContext'
import type { Attachment, Channel, Meeting } from '../types/domain'
import { Avatar, Button, StatusBadge } from './ui'
import { NativeExternalLink } from './NativeExternalLink'

const timeFormatters = {
  'en-US': new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  }),
  'vi-VN': new Intl.DateTimeFormat('vi-VN', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  }),
}
const meetingFormatters = {
  'en-US': new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  }),
  'vi-VN': new Intl.DateTimeFormat('vi-VN', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  }),
}

export function MessageThread({
  channel,
  onAssignTask,
}: {
  channel: Channel
  onAssignTask?: (messageId?: string, body?: string) => void
}) {
  const { t } = useTranslation()
  const { users, attachments, tasks, meetings, meetingResponses, respondToMeeting, channels } = useClinic()
  const {
    members,
    currentMemberId,
    isProduction,
    supportsAttachments,
    supportsIntegrations,
    downloadAttachment,
  } = useMessaging()
  const thread = useMessagingThread(channel.id)
  const channelMessages = thread.messages

  if (thread.isLoading) {
    return <div className="empty-thread" role="status">{t('common.loading')}</div>
  }

  if (thread.error && channelMessages.length === 0) {
    return <div className="empty-thread" role="alert">{thread.error}</div>
  }

  if (channelMessages.length === 0) {
    return (
      <div className="empty-thread">
        <span className="empty-thread__mark">#</span>
        <h2>{channel.displayName}</h2>
        <p>{t('channel.noMessages')}</p>
      </div>
    )
  }

  return (
    <div className="message-thread" aria-live="polite">
      {thread.hasOlderMessages ? (
        <Button
          onClick={() => void thread.loadOlderMessages()}
          disabled={thread.isLoadingOlder}
        >
          {thread.isLoadingOlder ? t('common.loading') : t('channel.loadOlder')}
        </Button>
      ) : null}
      {thread.error ? <p className="field-error" role="alert">{thread.error}</p> : null}
      <div className="date-divider"><span>{t('common.today')}</span></div>
      {channelMessages.map((message) => {
        const member = members.find(
          (item) => item.memberId === message.authorId,
        )
        const author = member ?? {
          memberId: message.authorId,
          fullName: t('channel.formerStaff'),
          initials: '?',
          presence: 'offline' as const,
        }
        const isMine = author.memberId === currentMemberId
        const messageAttachments = message.attachments ?? attachments.filter(
          (item) => message.attachmentIds.includes(item.id),
        )
        const linkedTask = tasks.find((task) => task.id === message.taskId)
        return (
          <article id={message.id} key={message.id} className={`message ${message.isUrgent ? 'message--urgent' : ''} ${isMine ? 'message--mine' : ''}`}>
            <Avatar initials={author.initials} presence={author.presence} />
            <div className="message__content">
              <header>
                <strong>{author.fullName}</strong>
                <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
                {message.isUrgent ? <StatusBadge tone="urgent">{t('common.urgent')}</StatusBadge> : null}
              </header>
              <div className="message__bubble"><p>{message.body}</p></div>
              {supportsIntegrations && onAssignTask ? (
                <button className="message-action" type="button" onClick={() => onAssignTask(message.id, message.body)}>
                  <ListPlus size={15} aria-hidden="true" />
                  {t('task.assignTask')}
                </button>
              ) : null}
              {supportsAttachments ? messageAttachments.map((attachment) => (
                <MessageAttachment
                  attachment={attachment}
                  isProduction={isProduction}
                  key={attachment.id}
                  onDownload={downloadAttachment}
                />
              )) : null}
              {supportsIntegrations && linkedTask ? (
                <button type="button" className="linked-task">
                  <CheckCircle2 size={19} aria-hidden="true" />
                  <span>{linkedTask.title}</span>
                  <StatusBadge tone={linkedTask.status === 'done' ? 'success' : 'active'}>{t(`common.${linkedTask.status === 'done' ? 'done' : 'open'}`)}</StatusBadge>
                </button>
              ) : null}
              {supportsIntegrations && message.meetingId ? <MeetingCard meeting={meetings.find((meeting) => meeting.id === message.meetingId)} response={meetingResponses.find((response) => response.meetingId === message.meetingId && response.userId === currentMemberId)?.status} organizerName={users.find((user) => user.id === meetings.find((meeting) => meeting.id === message.meetingId)?.organizerId)?.name} channelName={channels.find((item) => item.id === message.channelId)?.displayName} onRespond={(status) => respondToMeeting(message.meetingId!, status)} /> : null}
            </div>
          </article>
        )
      })}
    </div>
  )
}

function MessageAttachment({
  attachment,
  isProduction,
  onDownload,
}: {
  attachment: Attachment
  isProduction: boolean
  onDownload: (attachmentId: string) => Promise<string>
}) {
  const { t } = useTranslation()
  const { openExternalUrl } = useNativePlatform()
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState(false)

  const content = (
    <>
      <FileText size={20} aria-hidden="true" />
      <span>
        <strong>{attachment.name}</strong>
        <small>
          {attachment.sizeLabel}
          {attachment.scanStatus === 'bypassed_dev'
            ? ` · ${t('attachment.unscannedDev')}`
            : ''}
        </small>
        {downloading ? <small>{t('attachment.downloading')}</small> : null}
      </span>
    </>
  )

  if (!isProduction) {
    return (
      <NativeExternalLink
        className="attachment-row"
        href={attachment.downloadUrl ?? attachment.previewUrl}
        aria-disabled={!attachment.downloadUrl && !attachment.previewUrl}
      >
        {content}
      </NativeExternalLink>
    )
  }

  return (
    <>
      <button
        className="attachment-row"
        type="button"
        disabled={downloading}
        aria-label={t('attachment.download', { name: attachment.name })}
        onClick={() => {
          setDownloading(true)
          setError(false)
          void onDownload(attachment.id)
            .then(openExternalUrl)
            .catch(() => setError(true))
            .finally(() => setDownloading(false))
        }}
      >
        {content}
      </button>
      {error ? (
        <span className="sr-only" role="alert">
          {t('attachment.downloadFailed')}
        </span>
      ) : null}
    </>
  )
}

function MeetingCard({ meeting, response, organizerName, channelName, onRespond }: { meeting?: Meeting; response?: 'accepted' | 'declined'; organizerName?: string; channelName?: string; onRespond: (status: 'accepted' | 'declined') => void }) {
  const { t } = useTranslation()
  if (!meeting) return null
  return <section className="meeting-card" aria-label={t('meeting.title')}><header><span className="meeting-card__provider"><Video size={17} />{t(`meeting.${meeting.provider}`)}</span>{response ? <StatusBadge tone={response === 'accepted' ? 'success' : 'neutral'}>{t(`meeting.${response}`)}</StatusBadge> : <StatusBadge tone="urgent">{t('meeting.pending')}</StatusBadge>}</header><h3>{meeting.title}</h3><p className="meeting-card__time tabular-nums">{formatMeetingTime(meeting.startsAt)}–{formatMeetingTime(meeting.endsAt, true)}</p><small>{t('meeting.organizer')}: {organizerName} · {channelName}</small><dl className="meeting-card__details"><div><dt>{t('meeting.provider')}</dt><dd>{t(`meeting.${meeting.provider}`)}</dd></div><div><dt>{t('meeting.timezone')}</dt><dd>{meeting.timezone}</dd></div><div><dt>{t('meeting.link')}</dt><dd><NativeExternalLink href={meeting.joinUrl}>{formatMeetingUrl(meeting.joinUrl)}<ExternalLink size={13} /></NativeExternalLink></dd></div></dl><div className="meeting-card__actions"><Button className={response === 'accepted' ? 'is-selected' : ''} aria-pressed={response === 'accepted'} onClick={() => onRespond('accepted')}>{t('meeting.accept')}</Button><Button className={response === 'declined' ? 'is-selected' : ''} aria-pressed={response === 'declined'} onClick={() => onRespond('declined')}>{t('meeting.decline')}</Button><NativeExternalLink className="button button--primary" href={meeting.joinUrl}>{t('meeting.join')}<ExternalLink size={16} /></NativeExternalLink></div></section>
}

function formatTime(value: string) {
  return timeFormatters[activeLocale()].format(new Date(value))
}

function formatMeetingTime(value: string, timeOnly = false) {
  const formatters = timeOnly ? timeFormatters : meetingFormatters
  return formatters[activeLocale()].format(new Date(value))
}

function formatMeetingUrl(value: string) {
  try {
    const url = new URL(value)
    return `${url.host}${url.pathname}`
  } catch {
    return value
  }
}

function activeLocale(): 'en-US' | 'vi-VN' {
  return i18n.language === 'vi-VN' ? 'vi-VN' : 'en-US'
}
