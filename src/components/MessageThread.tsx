import { CheckCircle2, ExternalLink, FileText, ListPlus, Video } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n'
import { useClinic } from '../state/ClinicContext'
import type { Channel, Meeting } from '../types/domain'
import { Avatar, Button, StatusBadge } from './ui'
import { NativeExternalLink } from './NativeExternalLink'

export function MessageThread({
  channel,
  onAssignTask,
}: {
  channel: Channel
  onAssignTask?: (messageId?: string, body?: string) => void
}) {
  const { t } = useTranslation()
  const { messages, users, currentUser, attachments, tasks, meetings, meetingResponses, respondToMeeting, channels } = useClinic()
  const channelMessages = messages.filter((message) => message.channelId === channel.id)

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
      <div className="date-divider"><span>{t('common.today')}</span></div>
      {channelMessages.map((message) => {
        const author = users.find((user) => user.id === message.authorId) ?? users[0]
        const isMine = author.id === currentUser.id
        const messageAttachments = attachments.filter((item) => message.attachmentIds.includes(item.id))
        const linkedTask = tasks.find((task) => task.id === message.taskId)
        return (
          <article id={message.id} key={message.id} className={`message ${message.isUrgent ? 'message--urgent' : ''} ${isMine ? 'message--mine' : ''}`}>
            <Avatar initials={author.initials} presence={author.presence} />
            <div className="message__content">
              <header>
                <strong>{author.name}</strong>
                <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
                {message.isUrgent ? <StatusBadge tone="urgent">{t('common.urgent')}</StatusBadge> : null}
              </header>
              <div className="message__bubble"><p>{message.body}</p></div>
              {onAssignTask ? (
                <button className="message-action" type="button" onClick={() => onAssignTask(message.id, message.body)}>
                  <ListPlus size={15} aria-hidden="true" />
                  {t('task.assignTask')}
                </button>
              ) : null}
              {messageAttachments.map((attachment) => (
                <NativeExternalLink className="attachment-row" key={attachment.id} href={attachment.downloadUrl ?? attachment.previewUrl} aria-disabled={!attachment.downloadUrl && !attachment.previewUrl}>
                  <FileText size={20} aria-hidden="true" />
                  <span><strong>{attachment.name}</strong><small>{attachment.sizeLabel}</small></span>
                </NativeExternalLink>
              ))}
              {linkedTask ? (
                <button className="linked-task">
                  <CheckCircle2 size={19} aria-hidden="true" />
                  <span>{linkedTask.title}</span>
                  <StatusBadge tone={linkedTask.status === 'done' ? 'success' : 'active'}>{t(`common.${linkedTask.status === 'done' ? 'done' : 'open'}`)}</StatusBadge>
                </button>
              ) : null}
              {message.meetingId ? <MeetingCard meeting={meetings.find((meeting) => meeting.id === message.meetingId)} response={meetingResponses.find((response) => response.meetingId === message.meetingId && response.userId === currentUser.id)?.status} organizerName={users.find((user) => user.id === meetings.find((meeting) => meeting.id === message.meetingId)?.organizerId)?.name} channelName={channels.find((item) => item.id === message.channelId)?.displayName} onRespond={(status) => respondToMeeting(message.meetingId!, status)} /> : null}
            </div>
          </article>
        )
      })}
    </div>
  )
}

function MeetingCard({ meeting, response, organizerName, channelName, onRespond }: { meeting?: Meeting; response?: 'accepted' | 'declined'; organizerName?: string; channelName?: string; onRespond: (status: 'accepted' | 'declined') => void }) {
  const { t } = useTranslation()
  if (!meeting) return null
  return <section className="meeting-card" aria-label={t('meeting.title')}><header><span className="meeting-card__provider"><Video size={17} />{t(`meeting.${meeting.provider}`)}</span>{response ? <StatusBadge tone={response === 'accepted' ? 'success' : 'neutral'}>{t(`meeting.${response}`)}</StatusBadge> : <StatusBadge tone="urgent">{t('meeting.pending')}</StatusBadge>}</header><h3>{meeting.title}</h3><p className="meeting-card__time tabular-nums">{formatMeetingTime(meeting.startsAt)}–{formatMeetingTime(meeting.endsAt, true)}</p><small>{t('meeting.organizer')}: {organizerName} · {channelName}</small><dl className="meeting-card__details"><div><dt>{t('meeting.provider')}</dt><dd>{t(`meeting.${meeting.provider}`)}</dd></div><div><dt>{t('meeting.timezone')}</dt><dd>{meeting.timezone}</dd></div><div><dt>{t('meeting.link')}</dt><dd><NativeExternalLink href={meeting.joinUrl}>{formatMeetingUrl(meeting.joinUrl)}<ExternalLink size={13} /></NativeExternalLink></dd></div></dl><div className="meeting-card__actions"><Button className={response === 'accepted' ? 'is-selected' : ''} aria-pressed={response === 'accepted'} onClick={() => onRespond('accepted')}>{t('meeting.accept')}</Button><Button className={response === 'declined' ? 'is-selected' : ''} aria-pressed={response === 'declined'} onClick={() => onRespond('declined')}>{t('meeting.decline')}</Button><NativeExternalLink className="button button--primary" href={meeting.joinUrl}>{t('meeting.join')}<ExternalLink size={16} /></NativeExternalLink></div></section>
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat(i18n.language, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(value))
}

function formatMeetingTime(value: string, timeOnly = false) {
  return new Intl.DateTimeFormat(i18n.language, timeOnly ? { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' } : { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value))
}

function formatMeetingUrl(value: string) {
  try {
    const url = new URL(value)
    return `${url.host}${url.pathname}`
  } catch {
    return value
  }
}
