import { CalendarDays, FileText, ListChecks, Search, UserRound, Video } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router-dom'
import i18n from '../i18n'
import { useClinic } from '../state/ClinicContext'
import { Avatar, StatusBadge } from './ui'

export type ModuleSidebarMode = 'tasks' | 'documents' | 'meetings' | 'people'

export function ModuleSidebar({ mode, onSelect }: { mode: ModuleSidebarMode; onSelect: () => void }) {
  const { t } = useTranslation()
  const { currentUser, currentBinding, channels, tasks, attachments, meetings, meetingResponses, users } = useClinic()
  const [query, setQuery] = useState('')
  const [showAll, setShowAll] = useState(false)
  const canViewScope = ['owner', 'orgAdmin', 'locationManager', 'departmentLead'].includes(currentBinding.role)
  const accessibleChannelIds = useMemo(() => new Set(channels.filter((channel) => {
    if (currentBinding.role === 'owner' || currentBinding.role === 'orgAdmin') return true
    const inAssignedLocation = channel.locationIds.some((locationId) => currentBinding.locationIds.includes(locationId))
    if (currentBinding.role === 'locationManager') return inAssignedLocation
    if (currentBinding.role === 'departmentLead') return inAssignedLocation && channel.departmentIds.some((departmentId) => currentBinding.departmentIds.includes(departmentId))
    return channel.visibility === 'public' || channel.memberIds.includes(currentUser.id)
  }).map((channel) => channel.id)), [channels, currentBinding, currentUser.id])
  const normalized = query.trim().toLocaleLowerCase(i18n.language)

  const titles = { tasks: t('nav.tasks'), documents: t('nav.documents'), meetings: t('nav.meetings'), people: t('nav.people') }
  const placeholders = { tasks: t('modules.searchTasks'), documents: t('modules.searchDocuments'), meetings: t('modules.searchMeetings'), people: t('modules.searchPeople') }

  const taskItems = tasks.filter((task) => {
    const owner = users.find((user) => user.id === task.ownerId)
    const channel = channels.find((item) => item.id === task.channelId)
    const assignmentMatch = task.ownerId === currentUser.id || task.collaboratorIds.includes(currentUser.id)
    const scopeMatch = accessibleChannelIds.has(task.channelId) && (showAll && canViewScope ? true : assignmentMatch)
    return scopeMatch && `${task.title} ${owner?.name} ${channel?.displayName}`.toLocaleLowerCase(i18n.language).includes(normalized)
  })
  const documentItems = attachments.filter((attachment) => {
    const uploader = users.find((user) => user.id === attachment.uploadedBy)
    const channel = channels.find((item) => item.id === attachment.channelId)
    return accessibleChannelIds.has(attachment.channelId) && `${attachment.name} ${uploader?.name} ${channel?.displayName} ${attachment.type}`.toLocaleLowerCase(i18n.language).includes(normalized)
  })
  const meetingItems = meetings.filter((meeting) => {
    const channel = channels.find((item) => item.id === meeting.channelId)
    return meeting.attendeeIds.includes(currentUser.id) && `${meeting.title} ${channel?.displayName}`.toLocaleLowerCase(i18n.language).includes(normalized)
  })
  const peopleItems = users.filter((user) => `${user.name} ${user.title}`.toLocaleLowerCase(i18n.language).includes(normalized))

  return (
    <div className="module-sidebar-content">
      <header className="module-sidebar-heading"><span className="module-sidebar-heading__icon">{mode === 'tasks' ? <ListChecks /> : mode === 'documents' ? <FileText /> : mode === 'meetings' ? <CalendarDays /> : <UserRound />}</span><div><small>{t('app.operational')}</small><h2>{titles[mode]}</h2></div></header>
      <label className="search-field module-search"><Search size={18} /><span className="sr-only">{placeholders[mode]}</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={placeholders[mode]} /></label>
      {mode === 'tasks' && canViewScope ? <div className="module-scope-toggle" aria-label={t('common.scope')}><button className={!showAll ? 'is-active' : ''} onClick={() => setShowAll(false)}>{t('modules.assignedToMe')}</button><button className={showAll ? 'is-active' : ''} onClick={() => setShowAll(true)}>{t('modules.allInScope')}</button></div> : null}
      {mode === 'meetings' ? <MiniCalendar meetings={meetingItems} /> : null}
      <div className="module-sidebar-list">
        {mode === 'tasks' ? taskItems.map((task) => { const channel = channels.find((item) => item.id === task.channelId); return <NavLink key={task.id} to={`/tasks/${task.id}`} onClick={onSelect}><ListChecks size={18} /><span><strong>{task.title}</strong><small>{channel?.displayName}</small></span><StatusBadge tone={task.status === 'done' ? 'success' : 'active'}>{task.status === 'done' ? t('common.done') : t('common.open')}</StatusBadge></NavLink> }) : null}
        {mode === 'documents' ? documentItems.map((document) => { const channel = channels.find((item) => item.id === document.channelId); return <NavLink key={document.id} to={`/documents/${document.id}`} onClick={onSelect}><FileText size={19} /><span><strong>{document.name}</strong><small>{channel?.displayName} · {document.sizeLabel}</small></span></NavLink> }) : null}
        {mode === 'meetings' ? <><h3>{t('meeting.invitations')}</h3>{meetingItems.filter((meeting) => !meetingResponses.some((response) => response.meetingId === meeting.id && response.userId === currentUser.id)).map((meeting) => <MeetingSidebarLink key={meeting.id} meetingId={meeting.id} title={meeting.title} startsAt={meeting.startsAt} pending onSelect={onSelect} />)}<h3>{t('meeting.upcoming')}</h3>{meetingItems.filter((meeting) => meetingResponses.some((response) => response.meetingId === meeting.id && response.userId === currentUser.id && response.status === 'accepted') || meeting.organizerId === currentUser.id).map((meeting) => <MeetingSidebarLink key={meeting.id} meetingId={meeting.id} title={meeting.title} startsAt={meeting.startsAt} onSelect={onSelect} />)}</> : null}
        {mode === 'people' ? peopleItems.map((user) => <button className="person-sidebar-row" key={user.id} onClick={onSelect}><Avatar initials={user.initials} presence={user.presence} size="small" /><span><strong>{user.name}</strong><small>{user.title}</small></span></button>) : null}
        {((mode === 'tasks' && taskItems.length === 0) || (mode === 'documents' && documentItems.length === 0) || (mode === 'meetings' && meetingItems.length === 0) || (mode === 'people' && peopleItems.length === 0)) ? <p className="module-sidebar-empty">{t(`modules.no${mode.charAt(0).toUpperCase()}${mode.slice(1)}`)}</p> : null}
      </div>
    </div>
  )
}

function MeetingSidebarLink({ meetingId, title, startsAt, pending = false, onSelect }: { meetingId: string; title: string; startsAt: string; pending?: boolean; onSelect: () => void }) {
  const { t } = useTranslation()
  return <NavLink to={`/meetings/${meetingId}`} onClick={onSelect}><Video size={18} /><span><strong>{title}</strong><small className="tabular-nums">{new Intl.DateTimeFormat(i18n.language, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(startsAt))}</small></span>{pending ? <StatusBadge tone="urgent">{t('meeting.pending')}</StatusBadge> : null}</NavLink>
}

function MiniCalendar({ meetings }: { meetings: Array<{ startsAt: string }> }) {
  const monthDate = meetings[0] ? new Date(meetings[0].startsAt) : new Date()
  const year = Number(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }).format(monthDate))
  const month = Number(new Intl.DateTimeFormat('en', { month: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }).format(monthDate))
  const days = new Date(year, month, 0).getDate()
  const firstDay = new Date(year, month - 1, 1).getDay()
  const meetingDays = new Set(meetings.map((meeting) => Number(new Intl.DateTimeFormat('en', { day: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(meeting.startsAt)))))
  return <section className="mini-calendar" aria-label={new Intl.DateTimeFormat(i18n.language, { month: 'long', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }).format(monthDate)}><header><CalendarDays size={17} /><strong>{new Intl.DateTimeFormat(i18n.language, { month: 'long', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }).format(monthDate)}</strong></header><div className="mini-calendar__grid">{Array.from({ length: firstDay }, (_, index) => <span key={`blank-${index}`} />)}{Array.from({ length: days }, (_, index) => <span className={meetingDays.has(index + 1) ? 'has-meeting' : ''} key={index + 1}>{index + 1}</span>)}</div></section>
}
