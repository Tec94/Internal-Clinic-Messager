import {
  CalendarDays,
  CircleAlert,
  CheckCircle2,
  FileText,
  ListChecks,
  RotateCcw,
  ShieldAlert,
  UserRoundCog,
  Video,
} from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { AppSelect } from '../components/AppSelect'
import { NativeExternalLink } from '../components/NativeExternalLink'
import { TaskStatusBadge } from '../components/TaskStatusBadge'
import i18n from '../i18n'
import { useClinic } from '../state/ClinicContext'
import type { Meeting, Task, TaskEvent } from '../types/domain'
import { Avatar, Button, StatusBadge } from '../components/ui'
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
  const [searchParams] = useSearchParams()
  const { t } = useTranslation()
  const {
    tasks, taskEvents, taskSchedules, meetings, meetingResponses, users,
    assignments, currentUser, currentBinding, updateTask,
    transitionTask, setTaskScheduleActive,
  } = useClinic()
  const channels = useAccessibleChannels()
  const canViewScope = ['owner', 'orgAdmin', 'locationManager', 'departmentLead'].includes(currentBinding.role)
  const visible = tasks.filter((task) => channels.some((channel) => channel.id === task.channelId) && (
    task.ownerId === currentUser.id
    || task.createdById === currentUser.id
    || task.collaboratorIds.includes(currentUser.id)
    || canViewScope
  ))
  const task = taskId ? tasks.find((item) => item.id === taskId) : undefined
  if (taskId && !task) return <Navigate to="/tasks" replace />
  if (!task) {
    return <WorkAgenda tasks={visible} meetings={meetings.filter((meeting) => meeting.organizerId === currentUser.id || meetingResponses.some((response) => response.meetingId === meeting.id && response.userId === currentUser.id && response.status === 'accepted'))} selectedDate={searchParams.get('date') ?? ''} />
  }
  const channel = channels.find((item) => item.id === task.channelId)
  if (!channel) return <Navigate to="/tasks" replace />
  const owner = users.find((user) => user.id === task.ownerId)
  const creator = users.find((user) => user.id === task.createdById)
  const schedule = task.scheduleId ? taskSchedules.find((item) => item.id === task.scheduleId) : undefined
  const canCheck = (task.ownerId === currentUser.id || task.collaboratorIds.includes(currentUser.id)) && ['accepted', 'inProgress'].includes(task.status)
  const canManage = task.createdById === currentUser.id || canViewScope
  const eligibleOwners = channel.memberIds.map((id) => users.find((user) => user.id === id)).filter((user): user is (typeof users)[number] => Boolean(user)).filter((user) => {
    if (currentBinding.role === 'owner' || currentBinding.role === 'orgAdmin') return true
    if (!canViewScope) return user.id === currentUser.id
    return assignments.some((assignment) => assignment.userId === user.id && (currentBinding.role === 'locationManager' ? currentBinding.locationIds.includes(assignment.locationId) : currentBinding.departmentIds.includes(assignment.departmentId)))
  })
  const setChecklistItem = (itemId: string, completed: boolean) => {
    const checklist = task.checklist.map((item) => item.id === itemId ? { ...item, completed } : item)
    updateTask(task.id, {
      checklist,
      status: checklist.every((item) => item.completed) ? 'done' : checklist.some((item) => item.completed) ? 'inProgress' : 'accepted',
    })
  }

  return (
    <div className="module-page task-detail-page page-scroll">
      <header className="module-hero">
        <span className="module-hero__icon"><ListChecks size={24} /></span>
        <div><span>{t('modules.taskDetails')}</span><h1>{task.title}</h1><p>{channel.displayName}</p></div>
        <TaskStatusBadge status={task.status} />
      </header>
      {task.status === 'pendingAcceptance' && task.ownerId === currentUser.id ? <TaskAcceptance task={task} /> : null}
      {task.statusReason ? <section className="task-state-note" role="status"><ShieldAlert size={20} /><div><strong>{t(`task.status.${task.status}`)}</strong><p>{task.statusReason}</p></div></section> : null}
      <section className="module-detail-grid">
        <div className="module-detail-main">
          <div className="task-section-heading"><div><span>{t('task.progress', { completed: task.checklist.filter((item) => item.completed).length, total: task.checklist.length })}</span><h2>{t('task.checklist')}</h2></div>{task.checklist.length === 0 && task.ownerId === currentUser.id && ['accepted', 'inProgress'].includes(task.status) ? <Button variant="primary" onClick={() => transitionTask(task.id, 'complete')}>{t('task.markComplete')}</Button> : null}</div>
          {task.checklist.length ? <div className="task-checklist">{task.checklist.map((item) => <div className="task-check-row" key={item.id}><Checkbox checked={item.completed} disabled={!canCheck} onCheckedChange={(checked) => setChecklistItem(item.id, checked)} aria-label={item.label} /><span><strong>{item.label}</strong>{item.completedAt ? <small>{t('task.checkedBy', { name: users.find((user) => user.id === item.completedById)?.name ?? t('admin.systemActor'), time: formatDate(item.completedAt) })}</small> : null}</span>{item.completed ? <CheckCircle2 size={17} /> : null}</div>)}</div> : <p className="module-empty-copy">{t('task.noChecklist')}</p>}
          {(task.ownerId === currentUser.id || canManage) && !['done', 'declined', 'canceled', 'pendingAcceptance'].includes(task.status) ? <TaskActiveActions task={task} /> : null}
          {canManage && ['declined', 'blocked', 'pendingAcceptance', 'accepted', 'inProgress'].includes(task.status) ? <TaskManagerActions task={task} eligibleOwners={eligibleOwners} /> : null}
          {canManage && task.status === 'done' ? <TaskReopenAction task={task} /> : null}
          <TaskTimeline events={taskEvents.filter((event) => event.taskId === task.id)} users={users} />
        </div>
        <aside className="module-metadata">
          <dl>
            <div><dt>{t('common.owner')}</dt><dd>{owner ? <><Avatar initials={owner.initials} size="small" />{owner.name}</> : '—'}</dd></div>
            <div><dt>{t('task.assignedBy')}</dt><dd>{creator ? <><Avatar initials={creator.initials} size="small" />{creator.name}</> : '—'}</dd></div>
            <div><dt>{t('common.due')}</dt><dd className="tabular-nums">{formatDate(task.dueAt)}</dd></div>
            <div><dt>{t('modules.sourceChat')}</dt><dd>{channel.displayName}</dd></div>
            {schedule ? <div><dt>{t('task.repeat')}</dt><dd><button className="task-schedule-toggle" type="button" aria-pressed={schedule.active} onClick={() => setTaskScheduleActive(schedule.id, !schedule.active)}>{schedule.active ? t('task.scheduleActive') : t('task.schedulePaused')}</button></dd></div> : null}
          </dl>
          <Link className="button button--secondary" to={`/channels/${channel.id}#${task.sourceMessageId ?? ''}`}><ListChecks size={17} />{t('modules.openSource')}</Link>
        </aside>
      </section>
    </div>
  )
}

function WorkAgenda({ tasks, meetings, selectedDate }: { tasks: Task[]; meetings: Meeting[]; selectedDate: string }) {
  const { t } = useTranslation()
  const now = Date.now()
  const today = localDateKey(new Date().toISOString())
  const filteredTasks = selectedDate ? tasks.filter((task) => localDateKey(task.dueAt) === selectedDate) : tasks
  const filteredMeetings = selectedDate ? meetings.filter((meeting) => localDateKey(meeting.startsAt) === selectedDate) : meetings
  const sections = selectedDate ? [{ key: 'day', label: formatSelectedDate(selectedDate), items: filteredTasks }] : [
    { key: 'attention', label: t('modules.needsAttention'), items: filteredTasks.filter((task) => !['done', 'canceled'].includes(task.status) && (['pendingAcceptance', 'blocked', 'declined'].includes(task.status) || Date.parse(task.dueAt) < now)) },
    { key: 'today', label: t('common.today'), items: filteredTasks.filter((task) => !['done', 'canceled', 'declined', 'pendingAcceptance', 'blocked'].includes(task.status) && Date.parse(task.dueAt) >= now && localDateKey(task.dueAt) === today) },
    { key: 'upcoming', label: t('task.upcoming'), items: filteredTasks.filter((task) => !['done', 'canceled', 'declined', 'pendingAcceptance', 'blocked'].includes(task.status) && Date.parse(task.dueAt) >= now && localDateKey(task.dueAt) !== today) },
    { key: 'history', label: t('task.history'), items: filteredTasks.filter((task) => ['done', 'canceled'].includes(task.status)) },
  ]
  const agendaItems = [...filteredTasks.map((task) => ({ kind: 'task' as const, at: task.dueAt, task })), ...filteredMeetings.map((meeting) => ({ kind: 'meeting' as const, at: meeting.startsAt, meeting }))].sort((left, right) => Date.parse(left.at) - Date.parse(right.at))
  return <div className="module-page work-agenda page-scroll"><header className="module-hero module-hero--calendar"><span className="module-hero__icon"><CalendarDays size={24} /></span><div><span>{t('task.workAgenda')}</span><h1>{selectedDate ? formatSelectedDate(selectedDate) : t('task.myWork')}</h1><p>{t('task.workAgendaHelp')}</p></div></header>{selectedDate ? <section className="work-agenda__timeline"><header><h2>{t('task.dayAgenda', { date: formatSelectedDate(selectedDate) })}</h2><span>{agendaItems.length}</span></header>{agendaItems.map((item) => item.kind === 'task' ? <AgendaTaskRow key={`task-${item.task.id}`} task={item.task} selectedDate={selectedDate} /> : <AgendaMeetingRow key={`meeting-${item.meeting.id}`} meeting={item.meeting} />)}{agendaItems.length === 0 ? <p className="module-empty-copy">{t('task.noWorkOnDate')}</p> : null}</section> : sections.map((section) => <section className="work-agenda__section" key={section.key}><header><h2>{section.label}</h2><span>{section.items.length}</span></header>{section.items.map((task) => <AgendaTaskRow key={task.id} task={task} />)}{section.items.length === 0 ? <p className="module-empty-copy">{t('modules.noTasks')}</p> : null}</section>)}</div>
}

function AgendaTaskRow({ task, selectedDate = '' }: { task: Task; selectedDate?: string }) {
  const { t } = useTranslation()
  const { users, channels } = useClinic()
  const owner = users.find((user) => user.id === task.ownerId)
  const channel = channels.find((item) => item.id === task.channelId)
  const due = formatAgendaDate(task.dueAt)
  return <Link className="work-agenda__row" to={`/tasks/${task.id}${selectedDate ? `?date=${selectedDate}` : ''}`}><time className="meeting-agenda__time" dateTime={task.dueAt}><span className="meeting-agenda__month">{due.month}</span><strong>{due.day}</strong><span className="meeting-agenda__clock">{due.time}</span></time><ListChecks size={19} aria-hidden="true" /><div className="meeting-agenda__content"><h3>{task.title}</h3><p>{owner?.name} · {channel?.displayName} · {t('task.progress', { completed: task.checklist.filter((item) => item.completed).length, total: task.checklist.length })}</p></div><TaskStatusBadge status={task.status} /></Link>
}

function AgendaMeetingRow({ meeting }: { meeting: Meeting }) {
  const { t } = useTranslation()
  const { users, channels } = useClinic()
  const organizer = users.find((user) => user.id === meeting.organizerId)
  const channel = channels.find((item) => item.id === meeting.channelId)
  const starts = formatAgendaDate(meeting.startsAt)
  return <Link className="work-agenda__row" to={`/meetings/${meeting.id}`}><time className="meeting-agenda__time" dateTime={meeting.startsAt}><span className="meeting-agenda__month">{starts.month}</span><strong>{starts.day}</strong><span className="meeting-agenda__clock">{starts.time}</span></time><Video size={19} aria-hidden="true" /><div className="meeting-agenda__content"><h3>{meeting.title}</h3><p>{organizer?.name} · {channel?.displayName}</p></div><StatusBadge tone="active">{t('meeting.accepted')}</StatusBadge></Link>
}

function TaskAcceptance({ task }: { task: Task }) {
  const { t } = useTranslation()
  const { respondToTask } = useClinic()
  const [declining, setDeclining] = useState(false)
  const [reason, setReason] = useState('')
  const submitDecline = (event: FormEvent) => { event.preventDefault(); if (reason.trim()) respondToTask(task.id, 'decline', reason.trim()) }
  return <section className="task-acceptance"><CircleAlert size={22} /><div><h2>{t('task.responseRequired')}</h2><p>{t('task.responseRequiredHelp')}</p>{declining ? <form className="task-inline-form" onSubmit={submitDecline}><label><span>{t('task.reason')}</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} required /></label><div><Button onClick={() => setDeclining(false)}>{t('common.cancel')}</Button><Button type="submit" variant="primary">{t('task.confirmDecline')}</Button></div></form> : <div className="task-action-row"><Button variant="primary" onClick={() => respondToTask(task.id, 'accept')}>{t('task.accept')}</Button><Button onClick={() => setDeclining(true)}>{t('task.decline')}</Button></div>}</div></section>
}

function TaskActiveActions({ task }: { task: Task }) {
  const { t } = useTranslation()
  const { transitionTask } = useClinic()
  const [blocking, setBlocking] = useState(false)
  const [reason, setReason] = useState('')
  if (task.status === 'blocked') return <div className="task-action-row"><Button onClick={() => transitionTask(task.id, 'unblock')}>{t('task.clearBlocker')}</Button></div>
  return <section className="task-secondary-actions"><div className="task-action-row"><Button icon={<ShieldAlert size={17} />} onClick={() => setBlocking((value) => !value)}>{t('task.reportBlocker')}</Button></div>{blocking ? <form className="task-inline-form" onSubmit={(event) => { event.preventDefault(); if (reason.trim()) transitionTask(task.id, 'block', reason.trim()) }}><label><span>{t('task.blockerReason')}</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} required /></label><Button type="submit" variant="primary">{t('task.markBlocked')}</Button></form> : null}</section>
}

function TaskManagerActions({ task, eligibleOwners }: { task: Task; eligibleOwners: ReturnType<typeof useClinic>['users'] }) {
  const { t } = useTranslation()
  const { reassignTask, transitionTask } = useClinic()
  const [mode, setMode] = useState<'' | 'reassign' | 'cancel'>('')
  const [ownerId, setOwnerId] = useState('')
  const [reason, setReason] = useState('')
  const submit = (event: FormEvent) => { event.preventDefault(); if (!reason.trim()) return; if (mode === 'reassign' && ownerId) reassignTask(task.id, ownerId, reason.trim()); if (mode === 'cancel') transitionTask(task.id, 'cancel', reason.trim()) }
  return <section className="task-manager-actions"><header><UserRoundCog size={19} /><div><h2>{t('task.managerActions')}</h2><p>{t('task.managerActionsHelp')}</p></div></header><div className="task-action-row"><Button onClick={() => setMode(mode === 'reassign' ? '' : 'reassign')}>{t('task.reassign')}</Button><Button onClick={() => setMode(mode === 'cancel' ? '' : 'cancel')}>{t('task.cancelTask')}</Button></div>{mode ? <form className="task-inline-form" onSubmit={submit}>{mode === 'reassign' ? <label htmlFor="reassign-owner"><span>{t('task.newOwner')}</span><AppSelect id="reassign-owner" value={ownerId} onValueChange={setOwnerId} placeholder={t('task.ownerPlaceholder')} options={eligibleOwners.filter((user) => user.id !== task.ownerId).map((user) => ({ value: user.id, label: user.name }))} /></label> : null}<label><span>{t('task.reason')}</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} required /></label><Button type="submit" variant="primary">{mode === 'reassign' ? t('task.confirmReassign') : t('task.confirmCancel')}</Button></form> : null}</section>
}

function TaskReopenAction({ task }: { task: Task }) {
  const { t } = useTranslation()
  const { transitionTask } = useClinic()
  const [itemId, setItemId] = useState(() => task.checklist.find((item) => item.completed)?.id ?? '')
  const [reason, setReason] = useState('')
  return <section className="task-manager-actions"><header><RotateCcw size={19} /><div><h2>{t('task.reopen')}</h2><p>{t('task.reopenHelp')}</p></div></header><form className="task-inline-form" onSubmit={(event) => { event.preventDefault(); if (reason.trim()) transitionTask(task.id, 'reopen', reason.trim(), itemId || undefined) }}>{task.checklist.length ? <label htmlFor="reopen-item"><span>{t('task.reopenItem')}</span><AppSelect id="reopen-item" value={itemId} onValueChange={setItemId} options={task.checklist.filter((item) => item.completed).map((item) => ({ value: item.id, label: item.label }))} /></label> : null}<label><span>{t('task.reason')}</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} required /></label><Button type="submit" variant="primary">{t('task.reopen')}</Button></form></section>
}

function TaskTimeline({ events, users }: { events: TaskEvent[]; users: ReturnType<typeof useClinic>['users'] }) {
  const { t } = useTranslation()
  return <section className="task-timeline"><header><h2>{t('task.timeline')}</h2><span>{events.length}</span></header>{events.length ? <ol>{events.map((event) => <li key={event.id}><span className="task-timeline__mark" aria-hidden="true" /><div><strong>{t(`task.event.${event.type}`)}</strong><p>{users.find((user) => user.id === event.actorId)?.name ?? t('admin.systemActor')} · {formatDate(event.createdAt)}</p>{event.reason ? <blockquote>{event.reason}</blockquote> : null}</div></li>)}</ol> : <p className="module-empty-copy">{t('task.noTimeline')}</p>}</section>
}

function localDateKey(value: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }).formatToParts(new Date(value))
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

function formatSelectedDate(value: string) {
  return new Intl.DateTimeFormat(i18n.language, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(`${value}T12:00:00+07:00`))
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
  return <section className="meeting-detail"><Video size={24} /><div><span>{t(`meeting.${meeting.provider}`)}</span><h2>{meeting.title}</h2><p className="tabular-nums">{formatDate(meeting.startsAt)}–{formatDate(meeting.endsAt, { hour: 'numeric', minute: '2-digit' })}</p><small>{organizer?.name} · {channel?.displayName} · {meeting.timezone}</small><NativeExternalLink className="meeting-detail__url" href={meeting.joinUrl}>{formatMeetingUrl(meeting.joinUrl)}</NativeExternalLink></div><NativeExternalLink className="button button--primary" href={meeting.joinUrl}>{t('meeting.join')}</NativeExternalLink></section>
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
