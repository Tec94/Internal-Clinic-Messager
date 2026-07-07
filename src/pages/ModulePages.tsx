import {
  CalendarDays,
  CheckCircle2,
  FileText,
  ListChecks,
  Video,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useParams } from 'react-router-dom'
import i18n from '../i18n'
import { useClinic } from '../state/ClinicContext'
import type { Meeting } from '../types/domain'
import { Avatar, StatusBadge } from '../components/ui'
import { Checkbox } from '../components/ui/motion/checkbox'

function formatDate(value: string, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(i18n.language, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
    ...options,
  }).format(new Date(value))
}

function formatAgendaDate(value: string) {
  const date = new Date(value)
  return {
    month: new Intl.DateTimeFormat(i18n.language, { month: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(date),
    day: new Intl.DateTimeFormat(i18n.language, { day: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }).format(date),
    time: new Intl.DateTimeFormat(i18n.language, { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }).format(date),
  }
}

function useAccessibleChannels() {
  const { channels, currentBinding, currentLocationId, currentUser } = useClinic()
  return channels.filter((channel) => {
    const inLocation = currentLocationId === 'all' || channel.locationIds.includes(currentLocationId)
    if (!inLocation) return false
    if (currentBinding.role === 'owner' || currentBinding.role === 'orgAdmin') return true
    const inAssignedLocation = channel.locationIds.some((locationId) => currentBinding.locationIds.includes(locationId))
    if (currentBinding.role === 'locationManager') return inAssignedLocation
    if (currentBinding.role === 'departmentLead') return inAssignedLocation && channel.departmentIds.some((departmentId) => currentBinding.departmentIds.includes(departmentId))
    return channel.visibility === 'public' || channel.memberIds.includes(currentUser.id)
  })
}

export function TasksPage() {
  const { taskId } = useParams()
  const { t } = useTranslation()
  const { tasks, users, currentUser } = useClinic()
  const { updateTask } = useClinic()
  const channels = useAccessibleChannels()
  const visible = tasks.filter((task) =>
    channels.some((channel) => channel.id === task.channelId) &&
    (task.ownerId === currentUser.id || task.collaboratorIds.includes(currentUser.id)),
  )
  const task = tasks.find((item) => item.id === taskId) ?? visible[0]
  if (!task) return <ModuleEmpty icon={<ListChecks />} title={t('modules.noTasks')} />
  if (!taskId) return <Navigate to={`/tasks/${task.id}`} replace />
  const channel = channels.find((item) => item.id === task.channelId)
  if (!channel) return <Navigate to="/tasks" replace />
  const owner = users.find((user) => user.id === task.ownerId)
  const setChecklistItem = (itemId: string, completed: boolean) => {
    const checklist = task.checklist.map((item) => item.id === itemId ? { ...item, completed } : item)
    updateTask(task.id, {
      checklist,
      status: checklist.every((item) => item.completed) ? 'done' : 'inProgress',
    })
  }

  return (
    <div className="module-page page-scroll">
      <header className="module-hero">
        <span className="module-hero__icon"><ListChecks size={24} /></span>
        <div><span>{t('modules.taskDetails')}</span><h1>{task.title}</h1><p>{channel.displayName}</p></div>
        <StatusBadge tone={task.status === 'done' ? 'success' : 'active'}>{task.status === 'done' ? t('common.done') : t('common.open')}</StatusBadge>
      </header>
      <section className="module-detail-grid">
        <div className="module-detail-main">
          <h2>{t('channel.tasks')}</h2>
          <div className="task-checklist">
            {task.checklist.map((item) => <div className="task-check-row" key={item.id}><Checkbox checked={item.completed} onCheckedChange={(checked) => setChecklistItem(item.id, checked)} aria-label={item.label} /><span>{item.label}</span>{item.completed ? <CheckCircle2 size={17} /> : null}</div>)}
          </div>
        </div>
        <aside className="module-metadata">
          <dl>
            <div><dt>{t('common.owner')}</dt><dd>{owner ? <><Avatar initials={owner.initials} size="small" />{owner.name}</> : '—'}</dd></div>
            <div><dt>{t('common.due')}</dt><dd className="tabular-nums">{formatDate(task.dueAt)}</dd></div>
            <div><dt>{t('modules.sourceChat')}</dt><dd>{channel.displayName}</dd></div>
          </dl>
          <Link className="button button--secondary" to={`/channels/${channel.id}#${task.sourceMessageId ?? ''}`}><ListChecks size={17} />{t('modules.openSource')}</Link>
        </aside>
      </section>
    </div>
  )
}

export function DocumentsPage() {
  const { documentId } = useParams()
  const { t } = useTranslation()
  const { attachments, users, tasks } = useClinic()
  const channels = useAccessibleChannels()
  const visible = attachments.filter((attachment) => channels.some((channel) => channel.id === attachment.channelId))
  const document = attachments.find((item) => item.id === documentId) ?? visible[0]
  if (!document) return <ModuleEmpty icon={<FileText />} title={t('modules.noDocuments')} />
  if (!documentId) return <Navigate to={`/documents/${document.id}`} replace />
  const channel = channels.find((item) => item.id === document.channelId)
  if (!channel) return <Navigate to="/documents" replace />
  const uploader = users.find((user) => user.id === document.uploadedBy)
  const task = tasks.find((item) => item.id === document.taskId)

  return (
    <div className="module-page page-scroll">
      <header className="module-hero">
        <span className="module-hero__icon"><FileText size={24} /></span>
        <div><span>{t('modules.documentDetails')}</span><h1>{document.name}</h1><p>{channel.displayName}</p></div>
        <StatusBadge tone="neutral">PDF</StatusBadge>
      </header>
      <section className="document-preview">
        <div className="document-preview__page"><FileText size={42} /><strong>{document.name}</strong><span>{document.sizeLabel}</span></div>
        <aside className="module-metadata">
          <dl>
            <div><dt>{t('modules.uploadedBy')}</dt><dd>{uploader?.name ?? '—'}</dd></div>
            <div><dt>{t('modules.fileType')}</dt><dd>{document.type}</dd></div>
            <div><dt>{t('common.status')}</dt><dd className="tabular-nums">{formatDate(document.uploadedAt)}</dd></div>
            <div><dt>{t('modules.sourceChat')}</dt><dd>{channel.displayName}</dd></div>
            {task ? <div><dt>{t('channel.taskCreated')}</dt><dd>{task.title}</dd></div> : null}
          </dl>
          <Link className="button button--secondary" to={`/channels/${channel.id}#${document.messageId}`}>{t('modules.openSource')}</Link>
        </aside>
      </section>
    </div>
  )
}

export function MeetingsPage() {
  const { meetingId } = useParams()
  const { t } = useTranslation()
  const { meetings, meetingResponses, currentUser, channels, users } = useClinic()
  const accepted = meetings.filter((meeting) => {
    if (meeting.organizerId === currentUser.id) return true
    return meetingResponses.some((response) => response.meetingId === meeting.id && response.userId === currentUser.id && response.status === 'accepted')
  })
  const selected = meetings.find((meeting) => meeting.id === meetingId)

  return (
    <div className="module-page meetings-page page-scroll">
      <header className="module-hero module-hero--calendar">
        <span className="module-hero__icon"><CalendarDays size={24} /></span>
        <div><span>{t('meeting.calendar')}</span><h1>{t('nav.meetings')}</h1><p>Asia/Ho_Chi_Minh</p></div>
      </header>
      {selected ? <MeetingDetail meeting={selected} /> : null}
      <MeetingSection title={t('meeting.upcoming')} meetings={accepted.filter((meeting) => new Date(meeting.endsAt) >= new Date())} channels={channels} users={users} />
      <MeetingSection title={t('meeting.past')} meetings={accepted.filter((meeting) => new Date(meeting.endsAt) < new Date())} channels={channels} users={users} />
    </div>
  )
}

function MeetingDetail({ meeting }: { meeting: Meeting }) {
  const { t } = useTranslation()
  const { channels, users } = useClinic()
  const channel = channels.find((item) => item.id === meeting.channelId)
  const organizer = users.find((item) => item.id === meeting.organizerId)
  return <section className="meeting-detail"><Video size={24} /><div><span>{t(`meeting.${meeting.provider}`)}</span><h2>{meeting.title}</h2><p className="tabular-nums">{formatDate(meeting.startsAt)}–{formatDate(meeting.endsAt, { hour: 'numeric', minute: '2-digit' })}</p><small>{organizer?.name} · {channel?.displayName} · {meeting.timezone}</small><a className="meeting-detail__url" href={meeting.joinUrl} target="_blank" rel="noreferrer">{formatMeetingUrl(meeting.joinUrl)}</a></div><a className="button button--primary" href={meeting.joinUrl} target="_blank" rel="noreferrer">{t('meeting.join')}</a></section>
}

function MeetingSection({ title, meetings, channels, users }: { title: string; meetings: Meeting[]; channels: ReturnType<typeof useAccessibleChannels>; users: ReturnType<typeof useClinic>['users'] }) {
  const { t } = useTranslation()
  return <section className="meeting-agenda"><header><h2>{title}</h2><span>{meetings.length}</span></header>{meetings.length ? meetings.map((meeting) => { const channel = channels.find((item) => item.id === meeting.channelId); const organizer = users.find((item) => item.id === meeting.organizerId); const starts = formatAgendaDate(meeting.startsAt); return <Link className="meeting-agenda__row" key={meeting.id} to={`/meetings/${meeting.id}`}><time className="meeting-agenda__time" dateTime={meeting.startsAt}><span className="meeting-agenda__month">{starts.month}</span><strong>{starts.day}</strong><span className="meeting-agenda__clock">{starts.time}</span></time><div className="meeting-agenda__content"><h3>{meeting.title}</h3><p>{organizer?.name} · {channel?.displayName}</p></div><StatusBadge tone="active">{t('meeting.accepted')}</StatusBadge></Link> }) : <p className="module-empty-copy">{t('modules.noMeetings')}</p>}</section>
}

function ModuleEmpty({ icon, title }: { icon: React.ReactNode; title: string }) {
  return <div className="module-empty">{icon}<h1>{title}</h1></div>
}

function formatMeetingUrl(value: string) {
  try {
    const url = new URL(value)
    return `${url.host}${url.pathname}`
  } catch {
    return value
  }
}
