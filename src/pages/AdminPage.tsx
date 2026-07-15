import {
  AlertTriangle,
  ArrowUpRight,
  BellRing,
  Building2,
  CheckCircle2,
  ClipboardList,
  FileWarning,
  MapPin,
  Megaphone,
  Plus,
  RadioTower,
  Save,
  ShieldCheck,
  UsersRound,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AnnouncementDialog } from '../components/AnnouncementDialog'
import { Avatar, Button, ProgressBar, StatusBadge } from '../components/ui'
import {
  accessRequests,
  auditEvents,
  staffingSnapshots,
} from '../data/seed'
import { clinicService } from '../services/mockClinicService'
import type { Permission } from '../types/domain'
import { useClinic } from '../state/ClinicContext'

export type AdminSection =
  | 'overview'
  | 'locations'
  | 'people'
  | 'channels'
  | 'announcements'
  | 'staffing'
  | 'audit'
  | 'incident'
  | 'settings'

const requiredPermissions: Record<AdminSection, Permission> = {
  overview: 'viewAdmin',
  locations: 'manageLocations',
  people: 'managePeople',
  channels: 'manageChannels',
  announcements: 'sendDepartmentAnnouncement',
  staffing: 'viewStaffing',
  audit: 'viewAudit',
  incident: 'manageIncidents',
  settings: 'manageOrganization',
}

export function AdminPage({ section }: { section: AdminSection }) {
  const { t } = useTranslation()
  const { hasPermission } = useClinic()
  const required = requiredPermissions[section]
  const canAccessAnnouncements = section === 'announcements' && (
    hasPermission('sendOrganizationAnnouncement') ||
    hasPermission('sendLocationAnnouncement') ||
    hasPermission('sendDepartmentAnnouncement')
  )

  if (!hasPermission(required) && !canAccessAnnouncements) {
    return <AccessDenied />
  }

  const titles: Record<AdminSection, string> = {
    overview: t('admin.overview'), locations: t('admin.locations'), people: t('admin.people'), channels: t('admin.channels'), announcements: t('admin.announcements'), staffing: t('admin.staffing'), audit: t('admin.audit'), incident: t('admin.incidents'), settings: t('admin.settings'),
  }

  return (
    <div className="admin-page page-scroll">
      <header className="admin-page-header"><div><span>{t('admin.title')}</span><h1>{titles[section]}</h1><p>{t('admin.leadershipBrief')}</p></div><StatusBadge tone="active">{t('common.active')}</StatusBadge></header>
      {section === 'overview' ? <OverviewView /> : null}
      {section === 'locations' ? <LocationsView /> : null}
      {section === 'people' ? <PeopleView /> : null}
      {section === 'channels' ? <ChannelsView /> : null}
      {section === 'announcements' ? <AnnouncementsView /> : null}
      {section === 'staffing' ? <StaffingView /> : null}
      {section === 'audit' ? <AuditView /> : null}
      {section === 'incident' ? <IncidentView /> : null}
      {section === 'settings' ? <SettingsView /> : null}
    </div>
  )
}

function AccessDenied() {
  const { t } = useTranslation()
  return <div className="access-denied"><ShieldCheck size={34} /><h1>{t('admin.noAccess')}</h1><p>{t('admin.noAccessBody')}</p><Button variant="primary" onClick={() => history.back()}>{t('common.back')}</Button></div>
}

function OverviewView() {
  const { t } = useTranslation()
  const { announcements, channels, users, locations } = useClinic()
  const expiringChannels = channels.filter((channel) => channel.archiveAt).slice(0, 3)
  return (
    <div className="admin-overview">
      <section className="overview-block staffing-block"><header><div><h2>{t('admin.staffingLevels')}</h2><small>{t('admin.capturedAt', { time: new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(staffingSnapshots[0].capturedAt)) })}</small></div><UsersRound size={21} /></header>{staffingSnapshots.map((snapshot) => <StaffingMeter key={snapshot.locationId} name={locations.find((location) => location.id === snapshot.locationId)?.shortName ?? snapshot.locationId} value={Math.round((snapshot.scheduled / snapshot.required) * 100)} warning={snapshot.scheduled < snapshot.required} />)}</section>
      <section className="overview-block governance-block"><header><h2>{t('admin.governanceItems')}</h2><ShieldCheck size={21} /></header><div className="governance-summary"><article><strong className="tabular-nums">{accessRequests.length}</strong><span>{t('admin.accessRequests')}</span></article><article><strong className="tabular-nums">{expiringChannels.length}</strong><span>{t('common.expires')}</span></article></div><div className="governance-list">{accessRequests.map((request) => <Link key={request.id} to="/admin/channels"><Avatar initials={users.find((user) => user.id === request.requesterId)?.initials ?? '?'} size="small" /><span><strong>{users.find((user) => user.id === request.requesterId)?.name}</strong><small>{request.reason}</small></span><StatusBadge tone="urgent">{t('admin.pending')}</StatusBadge></Link>)}</div></section>
      <section className="overview-announcements"><header><h2>{t('inbox.announcements')}</h2><Link to="/admin/announcements">{t('common.viewAll')}</Link></header>{announcements.slice(0, 2).map((item) => <article key={item.id}><Megaphone size={20} /><div><strong>{item.title}</strong><p>{item.body}</p></div><StatusBadge tone={item.priority === 'urgent' ? 'urgent' : 'neutral'}>{item.status}</StatusBadge></article>)}</section>
    </div>
  )
}

function StaffingMeter({ name, value, warning = false }: { name: string; value: number; warning?: boolean }) {
  return <div className="staffing-meter"><div><strong>{name}</strong><span>{value}%</span></div><ProgressBar value={value} tone={warning ? 'warning' : 'primary'} /></div>
}

function LocationsView() {
  const { t } = useTranslation()
  const { locations, assignments } = useClinic()
  const [editing, setEditing] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  return (
    <section className="management-section"><div className="section-toolbar"><p>{t('admin.locationDescription')}</p><Button icon={<Plus size={18} />} variant="primary" onClick={() => setEditing('new')}>{t('admin.addLocation')}</Button></div>{saved ? <div className="success-banner" role="status">{t('admin.settingsSaved')}</div> : null}<div className="location-list">{locations.map((location) => { const staffCount = new Set(assignments.filter((item) => item.locationId === location.id).map((item) => item.userId)).size; return <article key={location.id}><div className="location-mark"><Building2 size={22} /></div><div><h2>{location.shortName}</h2><p><MapPin size={15} />{location.address}</p><small>{t('admin.assignmentSummary', { departments: location.departmentIds.length, staff: staffCount })}</small></div><StatusBadge tone="success">{t('common.active')}</StatusBadge><Button onClick={() => setEditing(location.id)}>{t('common.manage')}</Button></article> })}</div>{editing ? <form className="inline-management-form" onSubmit={(event) => { event.preventDefault(); setEditing(null); setSaved(true); window.setTimeout(() => setSaved(false), 1000) }}><header><h2>{editing === 'new' ? t('admin.addLocation') : t('common.manage')}</h2><button type="button" aria-label={t('common.close')} onClick={() => setEditing(null)}>×</button></header><label>{t('admin.displayName')}<input defaultValue={editing === 'new' ? '' : locations.find((item) => item.id === editing)?.shortName} /></label><label>{t('admin.address')}<input defaultValue={editing === 'new' ? '' : locations.find((item) => item.id === editing)?.address} /></label><div><Button onClick={() => setEditing(null)}>{t('common.cancel')}</Button><Button type="submit" variant="primary">{t('common.save')}</Button></div></form> : null}</section>
  )
}

function PeopleView() {
  const { t } = useTranslation()
  const { users, assignments, roleBindings, locations, departments, currentBinding } = useClinic()
  const [editing, setEditing] = useState<string | null>(null)
  const visibleUsers = users.filter((user) => currentBinding.role === 'owner' || currentBinding.role === 'orgAdmin' || assignments.some((assignment) => assignment.userId === user.id && currentBinding.locationIds.includes(assignment.locationId)))
  return (
    <section className="management-section">
      <div className="section-toolbar">
        <label className="admin-search"><span className="sr-only">{t('common.search')}</span><input placeholder={`${t('common.search')}…`} /></label>
        <Button icon={<Plus size={18} />} variant="primary">{t('admin.invitePerson')}</Button>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>{t('nav.people')}</th><th>{t('common.role')}</th><th>{t('common.location')}</th><th>{t('common.department')}</th><th>{t('common.status')}</th><th>{t('common.actions')}</th></tr></thead>
          <tbody>
            {visibleUsers.map((user) => {
              const assignment = assignments.find((item) => item.userId === user.id && item.isPrimary)
              const binding = roleBindings.find((item) => user.roleBindingIds.includes(item.id))
              return (
                <tr key={user.id}>
                  <td data-label={t('nav.people')}><span className="person-cell"><Avatar initials={user.initials} presence={user.presence} /><span><strong>{user.name}</strong><small>{user.title}</small></span></span></td>
                  <td data-label={t('common.role')}>{t(`roles.${binding?.role ?? 'staff'}`)}</td>
                  <td data-label={t('common.location')}>{locations.find((item) => item.id === assignment?.locationId)?.shortName ?? '—'}</td>
                  <td data-label={t('common.department')}>{departments.find((item) => item.id === assignment?.departmentId)?.name ?? '—'}</td>
                  <td data-label={t('common.status')}><StatusBadge tone={binding?.expiresAt ? 'urgent' : 'success'}>{binding?.expiresAt ? t('common.external') : t('common.active')}</StatusBadge></td>
                  <td data-label={t('common.actions')}><Button onClick={() => setEditing(user.id)}>{t('admin.manageAssignment')}</Button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {editing ? <form className="inline-management-form" onSubmit={(event) => { event.preventDefault(); setEditing(null) }}><header><h2>{t('admin.manageAssignment')}</h2><button type="button" aria-label={t('common.close')} onClick={() => setEditing(null)}>×</button></header><label>{t('common.role')}<select defaultValue={roleBindings.find((item) => item.userId === editing)?.role}><option value="staff">{t('roles.staff')}</option><option value="departmentLead">{t('roles.departmentLead')}</option><option value="locationManager">{t('roles.locationManager')}</option><option value="contractor">{t('roles.contractor')}</option></select></label><label>{t('common.location')}<select defaultValue={assignments.find((item) => item.userId === editing)?.locationId}>{locations.map((item) => <option key={item.id} value={item.id}>{item.shortName}</option>)}</select></label><div><Button onClick={() => setEditing(null)}>{t('common.cancel')}</Button><Button type="submit" variant="primary">{t('common.save')}</Button></div></form> : null}
    </section>
  )
}

function ChannelsView() {
  const { t } = useTranslation()
  const { channels, users, locations } = useClinic()
  const [requests, setRequests] = useState(accessRequests)
  return (
    <div className="governance-layout">
      <section className="management-section">
        <div className="section-toolbar"><p>{t('admin.channelDescription')}</p><Button icon={<Plus size={18} />} variant="primary">{t('sidebar.createChannel')}</Button></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>{t('admin.channelColumn')}</th><th>{t('common.scope')}</th><th>{t('common.owner')}</th><th>{t('common.status')}</th><th>{t('common.actions')}</th></tr></thead>
            <tbody>
              {channels.map((channel) => (
                <tr key={channel.id}>
                  <td data-label={t('admin.channelColumn')}><strong># {channel.name}</strong><small>{channel.type} · {channel.visibility}</small></td>
                  <td data-label={t('common.scope')}>{channel.locationIds.length > 1 ? t('common.allLocations') : locations.find((location) => location.id === channel.locationIds[0])?.shortName}</td>
                  <td data-label={t('common.owner')}>{users.find((user) => user.id === channel.ownerId)?.name}</td>
                  <td data-label={t('common.status')}><StatusBadge tone={channel.isUrgent ? 'urgent' : 'active'}>{channel.archiveAt ? `${t('common.expires')} ${new Date(channel.archiveAt).toLocaleDateString()}` : t('common.active')}</StatusBadge></td>
                  <td data-label={t('common.actions')}><Button>{t('common.manage')}</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <aside className="access-request-panel"><h2>{t('admin.accessRequests')}</h2>{requests.length === 0 ? <p>{t('common.noResults')}</p> : requests.map((request) => <article key={request.id}><strong>{users.find((user) => user.id === request.requesterId)?.name}</strong><p>{request.reason}</p><div><Button onClick={() => setRequests((items) => items.filter((item) => item.id !== request.id))}>{t('admin.deny')}</Button><Button variant="primary" onClick={() => setRequests((items) => items.filter((item) => item.id !== request.id))}>{t('admin.approve')}</Button></div></article>)}</aside>
    </div>
  )
}

function AnnouncementsView() {
  const { t } = useTranslation()
  const { announcements, users } = useClinic()
  const [open, setOpen] = useState(false)
  return <section className="management-section"><div className="section-toolbar"><p>{t('admin.announcementDescription')}</p><Button variant="primary" icon={<Plus size={18} />} onClick={() => setOpen(true)}>{t('admin.newAnnouncement')}</Button></div><div className="announcement-list">{announcements.map((announcement) => <article key={announcement.id}><BellRing size={21} /><div><h2>{announcement.title}</h2><p>{announcement.body}</p><small>{users.find((user) => user.id === announcement.authorId)?.name} · {announcement.audience.organizationWide ? t('common.allLocations') : `${announcement.audience.locationIds.length} ${t('common.location')}`}</small></div><div><StatusBadge tone={announcement.priority === 'urgent' ? 'urgent' : 'neutral'}>{announcement.priority}</StatusBadge>{announcement.requireAcknowledgement ? <StatusBadge tone="active">{t('admin.acknowledgement')}</StatusBadge> : null}</div></article>)}</div><AnnouncementDialog open={open} onOpenChange={setOpen} /></section>
}

function StaffingView() {
  const { t } = useTranslation()
  const { locations, departments } = useClinic()
  const { data = staffingSnapshots, isLoading } = useQuery({ queryKey: ['staffing'], queryFn: clinicService.getStaffing })
  if (isLoading) return <p>{t('common.loading')}</p>
  return <section className="management-section"><div className="section-toolbar"><p>{t('admin.staffingDescription')}</p><Button icon={<ArrowUpRight size={18} />}>{t('admin.openScheduler')}</Button></div><div className="staffing-grid">{data.map((snapshot) => { const location = locations.find((item) => item.id === snapshot.locationId); const percent = Math.round((snapshot.scheduled / snapshot.required) * 100); return <article key={snapshot.locationId}><header><div><Building2 size={21} /><div><h2>{location?.shortName}</h2><p>{snapshot.scheduled}/{snapshot.required} {t('admin.staffed')} · {t('admin.capturedAt', { time: new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZone: location?.timezone }).format(new Date(snapshot.capturedAt)) })}</p></div></div><StatusBadge tone={percent < 100 ? 'urgent' : 'success'}>{percent < 100 ? t('admin.coverageGap') : t('admin.fullyStaffed')}</StatusBadge></header><ProgressBar value={percent} tone={percent < 100 ? 'warning' : 'primary'} /><div className="coverage-list">{snapshot.departmentCoverage.map((coverage) => <div key={coverage.departmentId}><span>{departments.find((item) => item.id === coverage.departmentId)?.name}</span><strong>{coverage.scheduled}/{coverage.required}</strong></div>)}</div></article> })}</div></section>
}

function AuditView() {
  const { t } = useTranslation()
  const { users } = useClinic()
  const { data = auditEvents, isLoading } = useQuery({ queryKey: ['audit'], queryFn: clinicService.getAuditEvents })
  if (isLoading) return <p>{t('common.loading')}</p>
  return <section className="management-section"><div className="safety-note"><FileWarning size={22} /><div><strong>{t('admin.metadataOnly')}</strong><p>{t('admin.safetyDetail')}</p></div></div><div className="audit-list">{data.map((event) => <article key={event.id}><span className="audit-icon"><ShieldCheck size={20} /></span><div><strong>{event.action}</strong><p>{event.targetLabel}</p><small>{users.find((user) => user.id === event.actorId)?.name} · {new Date(event.createdAt).toLocaleString()}</small></div><StatusBadge tone="neutral">{event.locationId ?? 'organization'}</StatusBadge></article>)}</div></section>
}

function IncidentView() {
  const { t } = useTranslation()
  const { incidentId } = useParams()
  const { channels, users, locations } = useClinic()
  const navigate = useNavigate()
  const incident = channels.find((item) => item.id === incidentId) ?? channels.find((item) => item.type === 'incident')
  return <div className="incident-layout"><section className="incident-command"><header><RadioTower size={26} /><div><span>INC-2026-014</span><h2>{incident?.displayName}</h2><p>{incident?.purpose}</p></div><StatusBadge tone="critical">{t('common.active')}</StatusBadge></header><div className="incident-actions"><Button variant="primary" onClick={() => navigate(`/channels/${incident?.id}`)}>{t('inbox.openChannel')}</Button><Button>{t('admin.resolveIncident')}</Button></div><dl><div><dt>{t('common.owner')}</dt><dd>{users.find((user) => user.id === incident?.ownerId)?.name}</dd></div><div><dt>{t('common.location')}</dt><dd>{locations.find((location) => location.id === incident?.locationIds[0])?.shortName}</dd></div><div><dt>{t('common.members')}</dt><dd>{incident?.memberIds.length}</dd></div></dl></section><section className="incident-timeline"><h2>{t('admin.incidentTimeline')}</h2><ol><li><CheckCircle2 size={18} /><div><strong>Đã xác nhận nhân sự luân phiên</strong><small>09:12 · {users.find((user) => user.id === 'user-manager')?.name}</small></div></li><li><AlertTriangle size={18} /><div><strong>Đã mở sự cố thiếu nhân sự</strong><small>08:42 · {locations[0].shortName}</small></div></li><li><ClipboardList size={18} /><div><strong>Đã rà soát danh sách buổi sáng</strong><small>08:30 · Dữ liệu xếp lịch</small></div></li></ol></section></div>
}

function SettingsView() {
  const { t } = useTranslation()
  const { organization, users } = useClinic()
  const owner = users.find((user) => user.id === 'user-owner')
  const [saved, setSaved] = useState(false)
  return <form className="settings-form" onSubmit={(event) => { event.preventDefault(); setSaved(true); window.setTimeout(() => setSaved(false), 1100) }}><section><h2>{t('admin.organizationProfile')}</h2><label>{t('admin.organizationName')}<input defaultValue={organization.shortName} /></label><label>{t('admin.legalName')}<input defaultValue={organization.legalName} /></label><label>{t('admin.defaultLocale')}<select defaultValue={organization.defaultLocale}><option value="en-US">English</option><option value="vi-VN">Tiếng Việt</option></select></label></section><section><h2>{t('admin.defaultPolicies')}</h2><label>{t('admin.retention')}<select defaultValue="90"><option value="30">{t('admin.days30')}</option><option value="90">{t('admin.days90')}</option><option value="365">{t('admin.year1')}</option></select></label><label className="choice-row"><input type="checkbox" defaultChecked /><span>{t('admin.warningDefault')}</span></label></section><section><h2>{t('admin.ownership')}</h2><p>{owner?.name} · {owner?.email}</p></section>{saved ? <div className="success-banner" role="status">{t('admin.settingsSaved')}</div> : null}<Button variant="primary" icon={<Save size={18} />} type="submit">{t('admin.saveSettings')}</Button></form>
}
