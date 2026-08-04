import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileText,
  ListChecks,
  Search,
  UserRound,
  Video,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, useNavigate, useSearchParams } from 'react-router-dom'
import i18n from '../i18n'
import { useClinic } from '../state/ClinicContext'
import type { Task, TaskStatus } from '../types/domain'
import { AppSelect } from './AppSelect'
import { TaskStatusBadge } from './TaskStatusBadge'
import { Avatar, IconButton, StatusBadge } from './ui'

export type ModuleSidebarMode = 'tasks' | 'documents' | 'meetings' | 'people'
type TaskView = 'mine' | 'assigned' | 'team'

function dateKey(value: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Ho_Chi_Minh',
  }).formatToParts(new Date(value))
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

export function ModuleSidebar({ mode, onSelect }: { mode: ModuleSidebarMode; onSelect: () => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const {
    currentUser, currentBinding, currentLocationId, channels, tasks, attachments,
    meetings, meetingResponses, users, departments, assignments, ensureDirectChannel,
  } = useClinic()
  const [query, setQuery] = useState('')
  const [taskView, setTaskView] = useState<TaskView>('mine')
  const [statusFilter, setStatusFilter] = useState<'' | TaskStatus>('')
  const [ownerFilter, setOwnerFilter] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [visibleTaskCount, setVisibleTaskCount] = useState(50)
  const selectedDate = searchParams.get('date') ?? ''
  const canViewScope = ['owner', 'orgAdmin', 'locationManager', 'departmentLead'].includes(currentBinding.role)
  const accessibleChannelIds = useMemo(() => new Set(channels.filter((channel) => {
    if (currentBinding.role === 'owner' || currentBinding.role === 'orgAdmin') return true
    const inAssignedLocation = channel.locationIds.some((locationId) => currentBinding.locationIds.includes(locationId))
    if (currentBinding.role === 'locationManager') return inAssignedLocation
    if (currentBinding.role === 'departmentLead') return inAssignedLocation && channel.departmentIds.some((departmentId) => currentBinding.departmentIds.includes(departmentId))
    return channel.visibility === 'public' || channel.memberIds.includes(currentUser.id)
  }).map((channel) => channel.id)), [channels, currentBinding, currentUser.id])
  const normalized = query.trim().toLocaleLowerCase(i18n.language)

  useEffect(() => { setVisibleTaskCount(50) }, [departmentFilter, normalized, ownerFilter, selectedDate, statusFilter, taskView])

  const titles = { tasks: t('nav.tasks'), documents: t('nav.documents'), meetings: t('nav.meetings'), people: t('nav.people') }
  const placeholders = { tasks: t('modules.searchTasks'), documents: t('modules.searchDocuments'), meetings: t('modules.searchMeetings'), people: t('modules.searchPeople') }
  const scopedTasks = tasks.filter((task) => accessibleChannelIds.has(task.channelId))
  const taskItems = scopedTasks.filter((task) => {
    const owner = users.find((user) => user.id === task.ownerId)
    const channel = channels.find((item) => item.id === task.channelId)
    const viewMatch = taskView === 'team'
      ? canViewScope
      : taskView === 'assigned'
        ? task.createdById === currentUser.id
        : task.ownerId === currentUser.id || task.collaboratorIds.includes(currentUser.id)
    const departmentMatch = !departmentFilter || channel?.departmentIds.includes(departmentFilter)
    return viewMatch
      && (!statusFilter || task.status === statusFilter)
      && (!ownerFilter || task.ownerId === ownerFilter)
      && departmentMatch
      && (!selectedDate || dateKey(task.dueAt) === selectedDate)
      && `${task.title} ${owner?.name} ${channel?.displayName}`.toLocaleLowerCase(i18n.language).includes(normalized)
  }).sort((left, right) => Date.parse(left.dueAt) - Date.parse(right.dueAt))
  const documentItems = attachments.filter((attachment) => {
    const uploader = users.find((user) => user.id === attachment.uploadedBy)
    const channel = channels.find((item) => item.id === attachment.channelId)
    return accessibleChannelIds.has(attachment.channelId) && `${attachment.name} ${uploader?.name} ${channel?.displayName} ${attachment.type}`.toLocaleLowerCase(i18n.language).includes(normalized)
  })
  const meetingItems = meetings.filter((meeting) => {
    const channel = channels.find((item) => item.id === meeting.channelId)
    return meeting.attendeeIds.includes(currentUser.id) && `${meeting.title} ${channel?.displayName}`.toLocaleLowerCase(i18n.language).includes(normalized)
  })
  const acceptedMeetings = meetingItems.filter((meeting) => meeting.organizerId === currentUser.id || meetingResponses.some((response) => response.meetingId === meeting.id && response.userId === currentUser.id && response.status === 'accepted'))
  const peopleItems = users.filter((user) => `${user.name} ${user.title}`.toLocaleLowerCase(i18n.language).includes(normalized))
  const taskMarkers = scopedTasks.map((task) => ({ at: task.dueAt, kind: 'task' as const }))
  const meetingMarkers = acceptedMeetings.map((meeting) => ({ at: meeting.startsAt, kind: 'meeting' as const }))
  const taskGroups = groupTasks(taskItems, t, canViewScope && taskView !== 'mine')

  const openDirectMessage = (userId: string) => {
    const channel = ensureDirectChannel(userId)
    if (!channel) return
    navigate(`/channels/${channel.id}`)
    onSelect()
  }
  const selectDate = (nextDate: string) => navigate(nextDate ? `/tasks?date=${nextDate}` : '/tasks')

  return (
    <div className="module-sidebar-content">
      <header className="module-sidebar-heading"><span className="module-sidebar-heading__icon">{mode === 'tasks' ? <ListChecks /> : mode === 'documents' ? <FileText /> : mode === 'meetings' ? <CalendarDays /> : <UserRound />}</span><div><small>{t('app.operational')}</small><h2>{titles[mode]}</h2></div></header>
      <label className="search-field module-search"><Search size={18} /><span className="sr-only">{placeholders[mode]}</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={placeholders[mode]} /></label>
      {mode === 'tasks' ? <>
        <div className={`module-scope-toggle module-scope-toggle--${canViewScope ? 'three' : 'one'}`} aria-label={t('common.scope')}>
          <button type="button" className={taskView === 'mine' ? 'is-active' : ''} onClick={() => setTaskView('mine')}>{t('modules.mine')}</button>
          {canViewScope ? <button type="button" className={taskView === 'assigned' ? 'is-active' : ''} onClick={() => setTaskView('assigned')}>{t('modules.assignedByMe')}</button> : null}
          {canViewScope ? <button type="button" className={taskView === 'team' ? 'is-active' : ''} onClick={() => setTaskView('team')}>{t('modules.teamInScope')}</button> : null}
        </div>
        <MiniCalendar markers={[...taskMarkers, ...meetingMarkers]} selectedDate={selectedDate} onSelectDate={selectDate} workAgenda />
        <details className="task-sidebar-filters">
          <summary>{t('modules.filters')}</summary>
          <AppSelect value={statusFilter} onValueChange={(value) => setStatusFilter(value as '' | TaskStatus)} ariaLabel={t('common.status')} options={[{ value: '', label: t('modules.allStatuses') }, ...(['pendingAcceptance', 'accepted', 'inProgress', 'blocked', 'done', 'declined', 'canceled'] as TaskStatus[]).map((status) => ({ value: status, label: t(`task.status.${status}`) }))]} />
          <AppSelect value={ownerFilter} onValueChange={setOwnerFilter} ariaLabel={t('common.owner')} options={[{ value: '', label: t('modules.allOwners') }, ...users.filter((user) => assignments.some((assignment) => assignment.userId === user.id && (currentLocationId === 'all' || assignment.locationId === currentLocationId))).map((user) => ({ value: user.id, label: user.name }))]} />
          <AppSelect value={departmentFilter} onValueChange={setDepartmentFilter} ariaLabel={t('common.department')} options={[{ value: '', label: t('modules.allDepartments') }, ...departments.map((department) => ({ value: department.id, label: department.name }))]} />
          {selectedDate ? <button className="task-sidebar-filters__clear" type="button" onClick={() => selectDate('')}>{t('modules.clearDate')}</button> : null}
        </details>
      </> : null}
      {mode === 'meetings' ? <MiniCalendar markers={meetingItems.map((meeting) => ({ at: meeting.startsAt, kind: 'meeting' }))} selectedDate="" /> : null}
      <div className="module-sidebar-list">
        {mode === 'tasks' ? taskGroups.map((group) => group.items.length ? <section className="task-sidebar-group" key={group.key}><h3>{group.label}<span>{group.items.length}</span></h3>{group.items.slice(0, visibleTaskCount).map((task) => <TaskSidebarLink key={task.id} task={task} channelName={channels.find((item) => item.id === task.channelId)?.displayName} selectedDate={selectedDate} onSelect={onSelect} />)}</section> : null) : null}
        {mode === 'tasks' && taskItems.length > visibleTaskCount ? <button className="task-list-more" type="button" onClick={() => setVisibleTaskCount((count) => count + 50)}>{t('modules.loadMoreTasks')}</button> : null}
        {mode === 'documents' ? documentItems.map((document) => { const channel = channels.find((item) => item.id === document.channelId); return <NavLink key={document.id} to={`/documents/${document.id}`} onClick={onSelect}><FileText size={19} /><span><strong>{document.name}</strong><small>{channel?.displayName} · {document.sizeLabel}</small></span></NavLink> }) : null}
        {mode === 'meetings' ? <><h3>{t('meeting.invitations')}</h3>{meetingItems.filter((meeting) => !meetingResponses.some((response) => response.meetingId === meeting.id && response.userId === currentUser.id)).map((meeting) => <MeetingSidebarLink key={meeting.id} meetingId={meeting.id} title={meeting.title} startsAt={meeting.startsAt} pending onSelect={onSelect} />)}<h3>{t('meeting.upcoming')}</h3>{acceptedMeetings.map((meeting) => <MeetingSidebarLink key={meeting.id} meetingId={meeting.id} title={meeting.title} startsAt={meeting.startsAt} onSelect={onSelect} />)}</> : null}
        {mode === 'people' ? peopleItems.map((user) => <button className="person-sidebar-row" key={user.id} onClick={() => openDirectMessage(user.id)} disabled={user.id === currentUser.id}><Avatar initials={user.initials} presence={user.presence} size="small" /><span><strong>{user.name}</strong><small>{user.id === currentUser.id ? t('people.self') : user.title}</small></span></button>) : null}
        {((mode === 'tasks' && taskItems.length === 0) || (mode === 'documents' && documentItems.length === 0) || (mode === 'meetings' && meetingItems.length === 0) || (mode === 'people' && peopleItems.length === 0)) ? <p className="module-sidebar-empty">{t(`modules.no${mode.charAt(0).toUpperCase()}${mode.slice(1)}`)}</p> : null}
      </div>
    </div>
  )
}

function groupTasks(tasks: Task[], t: ReturnType<typeof useTranslation>['t'], managerView: boolean) {
  const now = Date.now()
  const today = dateKey(new Date().toISOString())
  const isClosed = (task: Task) => ['done', 'canceled'].includes(task.status)
  const active = (task: Task) => !isClosed(task) && !['pendingAcceptance', 'blocked', 'declined'].includes(task.status)
  const shared = [
    { key: 'today', label: t('common.today'), items: tasks.filter((task) => active(task) && Date.parse(task.dueAt) >= now && dateKey(task.dueAt) === today) },
    { key: 'upcoming', label: t('task.upcoming'), items: tasks.filter((task) => active(task) && dateKey(task.dueAt) !== today && Date.parse(task.dueAt) >= now) },
    { key: 'history', label: t('task.history'), items: tasks.filter((task) => isClosed(task) || task.status === 'declined') },
  ]
  if (managerView) return [
    { key: 'attention', label: t('modules.needsAttention'), items: tasks.filter((task) => !isClosed(task) && (['pendingAcceptance', 'blocked', 'declined'].includes(task.status) || Date.parse(task.dueAt) < now)) },
    ...shared,
  ]
  return [
    { key: 'awaiting', label: t('task.awaitingResponse'), items: tasks.filter((task) => task.status === 'pendingAcceptance') },
    { key: 'blocked', label: t('task.status.blocked'), items: tasks.filter((task) => task.status === 'blocked') },
    { key: 'overdue', label: t('task.overdue'), items: tasks.filter((task) => active(task) && Date.parse(task.dueAt) < now) },
    ...shared,
  ]
}

function TaskSidebarLink({ task, channelName, selectedDate, onSelect }: { task: Task; channelName?: string; selectedDate: string; onSelect: () => void }) {
  return <NavLink to={`/tasks/${task.id}${selectedDate ? `?date=${selectedDate}` : ''}`} onClick={onSelect}><ListChecks size={18} /><span><strong>{task.title}</strong><small>{channelName} · {new Intl.DateTimeFormat(i18n.language, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(task.dueAt))}</small></span><TaskStatusBadge status={task.status} /></NavLink>
}

function MeetingSidebarLink({ meetingId, title, startsAt, pending = false, onSelect }: { meetingId: string; title: string; startsAt: string; pending?: boolean; onSelect: () => void }) {
  const { t } = useTranslation()
  return <NavLink to={`/meetings/${meetingId}`} onClick={onSelect}><Video size={18} /><span><strong>{title}</strong><small className="tabular-nums">{new Intl.DateTimeFormat(i18n.language, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(startsAt))}</small></span>{pending ? <StatusBadge tone="urgent">{t('meeting.pending')}</StatusBadge> : null}</NavLink>
}

function MiniCalendar({ markers, selectedDate, onSelectDate, workAgenda = false }: { markers: Array<{ at: string; kind: 'task' | 'meeting' }>; selectedDate: string; onSelectDate?: (date: string) => void; workAgenda?: boolean }) {
  const { t } = useTranslation()
  const initial = selectedDate ? new Date(`${selectedDate}T12:00:00+07:00`) : markers[0] ? new Date(markers[0].at) : new Date()
  const [monthDate, setMonthDate] = useState(initial)
  useEffect(() => { if (selectedDate) setMonthDate(new Date(`${selectedDate}T12:00:00+07:00`)) }, [selectedDate])
  const year = Number(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }).format(monthDate))
  const month = Number(new Intl.DateTimeFormat('en', { month: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }).format(monthDate))
  const days = new Date(year, month, 0).getDate()
  const firstDay = (new Date(year, month - 1, 1).getDay() + 6) % 7
  const counts = markers.reduce<Record<string, { task: number; meeting: number }>>((result, marker) => {
    const key = dateKey(marker.at)
    result[key] ??= { task: 0, meeting: 0 }
    result[key][marker.kind] += 1
    return result
  }, {})
  const monthLabel = new Intl.DateTimeFormat(i18n.language, { month: 'long', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }).format(monthDate)
  const previousMonthDays = new Date(year, month - 1, 0).getDate()
  const trailingDays = (7 - ((firstDay + days) % 7)) % 7
  const weekdayLabels = Array.from({ length: 7 }, (_, index) => new Intl.DateTimeFormat(i18n.language, { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 0, 5 + index))))
  const dayCells = [
    ...Array.from({ length: firstDay }, (_, index) => ({ day: previousMonthDays - firstDay + index + 1, key: `previous-${index}`, outside: true })),
    ...Array.from({ length: days }, (_, index) => ({ day: index + 1, key: `current-${index + 1}`, outside: false })),
    ...Array.from({ length: trailingDays }, (_, index) => ({ day: index + 1, key: `next-${index}`, outside: true })),
  ]
  const labelDate = new Intl.DateTimeFormat(i18n.language, { month: 'long', day: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' })
  const moveMonth = (offset: number) => setMonthDate(new Date(year, month - 1 + offset, 15))
  return <section className="mini-calendar" aria-label={monthLabel}><header><IconButton aria-label={t('modules.previousMonth')} onClick={() => moveMonth(-1)}><ChevronLeft size={16} /></IconButton><strong>{monthLabel}</strong><IconButton aria-label={t('modules.nextMonth')} onClick={() => moveMonth(1)}><ChevronRight size={16} /></IconButton></header><div className="mini-calendar__grid">{weekdayLabels.map((label) => <span className="mini-calendar__weekday" aria-hidden="true" key={label}>{label}</span>)}{dayCells.map((cell) => {
    if (cell.outside) return <span className="mini-calendar__day is-outside" aria-hidden="true" key={cell.key}><span className="mini-calendar__date">{cell.day}</span></span>
    const key = `${year}-${String(month).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}`
    const count = counts[key] ?? { task: 0, meeting: 0 }
    const total = count.task + count.meeting
    const date = new Date(`${key}T12:00:00+07:00`)
    const label = total ? t(workAgenda ? 'modules.workCountLabel' : 'meeting.eventCountLabel', { date: labelDate.format(date), count: total }) : labelDate.format(date)
    return <button type="button" className={`mini-calendar__day ${total ? 'has-work' : ''} ${selectedDate === key ? 'is-selected' : ''}`} aria-label={label} aria-pressed={selectedDate === key} onClick={() => onSelectDate?.(key)} disabled={!onSelectDate} key={cell.key}><span className="mini-calendar__date">{cell.day}</span><span className="mini-calendar__count" aria-hidden="true">{count.task ? <span className="mini-calendar__dot mini-calendar__dot--task" /> : null}{count.meeting ? <span className="mini-calendar__dot mini-calendar__dot--meeting" /> : null}</span></button>
  })}</div></section>
}
