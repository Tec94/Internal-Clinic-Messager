import {
  BellRing,
  Building2,
  CheckCircle2,
  FileWarning,
  MapPin,
  Megaphone,
  Plus,
  RadioTower,
  Save,
  ShieldCheck,
  UsersRound,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AnnouncementDialog } from '../components/AnnouncementDialog'
import { AppSelect } from '../components/AppSelect'
import { Avatar, Button, StatusBadge } from '../components/ui'
import type { Permission, UserRole } from '../types/domain'
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
  const {
    accessRequests,
    announcements,
    assignments,
    channels,
    users,
    locations,
  } = useClinic()
  const expiringChannels = channels.filter((channel) => channel.archiveAt).slice(0, 3)
  return (
    <div className="admin-overview">
      <section className="overview-block staffing-block">
        <header>
          <div>
            <h2>{t('admin.assignmentOverview')}</h2>
            <small>{t('admin.assignmentOverviewHelp')}</small>
          </div>
          <UsersRound size={21} />
        </header>
        {locations.map((location) => (
          <div className="staffing-meter" key={location.id}>
            <div>
              <strong>{location.shortName}</strong>
              <span>
                {new Set(assignments
                  .filter((item) => item.locationId === location.id)
                  .map((item) => item.userId)).size}
              </span>
            </div>
          </div>
        ))}
      </section>
      <section className="overview-block governance-block"><header><h2>{t('admin.governanceItems')}</h2><ShieldCheck size={21} /></header><div className="governance-summary"><article><strong className="tabular-nums">{accessRequests.length}</strong><span>{t('admin.accessRequests')}</span></article><article><strong className="tabular-nums">{expiringChannels.length}</strong><span>{t('common.expires')}</span></article></div><div className="governance-list">{accessRequests.map((request) => <Link key={request.id} to="/admin/channels"><Avatar initials={users.find((user) => user.id === request.requesterId)?.initials ?? '?'} size="small" /><span><strong>{users.find((user) => user.id === request.requesterId)?.name}</strong><small>{request.reason}</small></span><StatusBadge tone="urgent">{t('admin.pending')}</StatusBadge></Link>)}</div></section>
      <section className="overview-announcements"><header><h2>{t('inbox.announcements')}</h2><Link to="/admin/announcements">{t('common.viewAll')}</Link></header>{announcements.slice(0, 2).map((item) => <article key={item.id}><Megaphone size={20} /><div><strong>{item.title}</strong><p>{item.body}</p></div><StatusBadge tone={item.priority === 'urgent' ? 'urgent' : 'neutral'}>{item.status}</StatusBadge></article>)}</section>
    </div>
  )
}

function LocationsView() {
  const { t } = useTranslation()
  const { locations, assignments, saveLocation } = useClinic()
  const [editing, setEditing] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const selected = locations.find((item) => item.id === editing)
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setError('')
    try {
      await saveLocation({
        id: selected?.id,
        name: String(form.get('name') ?? '').trim(),
        shortName: String(form.get('shortName') ?? '').trim(),
        address: String(form.get('address') ?? '').trim(),
        timezone: String(form.get('timezone') ?? 'Asia/Ho_Chi_Minh'),
        status: selected?.status ?? 'active',
      })
      setEditing(null)
      setSaved(true)
      window.setTimeout(() => setSaved(false), 1400)
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : t('admin.saveFailed'),
      )
    }
  }
  return (
    <section className="management-section">
      <div className="section-toolbar">
        <p>{t('admin.locationDescription')}</p>
        <Button
          icon={<Plus size={18} />}
          variant="primary"
          onClick={() => setEditing('new')}
        >
          {t('admin.addLocation')}
        </Button>
      </div>
      {saved ? <div className="success-banner" role="status">{t('admin.settingsSaved')}</div> : null}
      <div className="location-list">
        {locations.map((location) => {
          const staffCount = new Set(assignments
            .filter((item) => item.locationId === location.id)
            .map((item) => item.userId)).size
          return (
            <article key={location.id}>
              <div className="location-mark"><Building2 size={22} /></div>
              <div>
                <h2>{location.shortName}</h2>
                <p><MapPin size={15} />{location.address || location.name}</p>
                <small>{t('admin.assignmentSummary', {
                  departments: location.departmentIds.length,
                  staff: staffCount,
                })}</small>
              </div>
              <StatusBadge tone={location.status === 'active' ? 'success' : 'neutral'}>
                {location.status}
              </StatusBadge>
              <Button onClick={() => setEditing(location.id)}>
                {t('common.manage')}
              </Button>
            </article>
          )
        })}
      </div>
      {editing ? (
        <form className="inline-management-form" onSubmit={submit}>
          <header>
            <h2>{editing === 'new' ? t('admin.addLocation') : t('common.manage')}</h2>
            <button type="button" aria-label={t('common.close')} onClick={() => setEditing(null)}>×</button>
          </header>
          <label>
            {t('admin.locationName')}
            <input name="name" required defaultValue={selected?.name ?? ''} />
          </label>
          <label>
            {t('admin.displayName')}
            <input name="shortName" required defaultValue={selected?.shortName ?? ''} />
          </label>
          <label>
            {t('admin.address')}
            <input name="address" defaultValue={selected?.address ?? ''} />
          </label>
          <label>
            {t('meeting.timezone')}
            <input
              name="timezone"
              required
              defaultValue={selected?.timezone ?? 'Asia/Ho_Chi_Minh'}
            />
          </label>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <div>
            <Button onClick={() => setEditing(null)}>{t('common.cancel')}</Button>
            <Button type="submit" variant="primary">{t('common.save')}</Button>
          </div>
        </form>
      ) : null}
    </section>
  )
}

function PeopleView() {
  const { t } = useTranslation()
  const {
    users,
    assignments,
    roleBindings,
    locations,
    departments,
    currentBinding,
    saveMemberAssignment,
  } = useClinic()
  const [editing, setEditing] = useState<string | null>(null)
  const [error, setError] = useState('')
  const visibleUsers = users.filter((user) => currentBinding.role === 'owner' || currentBinding.role === 'orgAdmin' || assignments.some((assignment) => assignment.userId === user.id && currentBinding.locationIds.includes(assignment.locationId)))
  const selectedAssignment = assignments.find(
    (assignment) => assignment.userId === editing && assignment.isPrimary,
  )
  const selectedRole = roleBindings.find(
    (binding) => binding.userId === editing,
  )
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editing) return
    const form = new FormData(event.currentTarget)
    setError('')
    try {
      await saveMemberAssignment({
        memberId: editing,
        role: String(form.get('role')) as UserRole,
        locationId: String(form.get('locationId')),
        departmentId: String(form.get('departmentId')),
        employmentType:
          selectedAssignment?.employmentType === 'contractor'
            ? 'contractor'
            : selectedAssignment?.employmentType === 'perDiem'
              ? 'locum'
              : 'employee',
        status: 'active',
        expiresAt: selectedRole?.expiresAt,
      })
      setEditing(null)
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : t('admin.saveFailed'),
      )
    }
  }
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
      {editing ? (
        <form className="inline-management-form" onSubmit={submit}>
          <header>
            <h2>{t('admin.manageAssignment')}</h2>
            <button type="button" aria-label={t('common.close')} onClick={() => setEditing(null)}>×</button>
          </header>
          <label htmlFor="assignment-role">
            {t('common.role')}
            <AppSelect
              id="assignment-role"
              name="role"
              defaultValue={selectedRole?.role ?? 'staff'}
              options={[
                { value: 'staff', label: t('roles.staff') },
                { value: 'departmentLead', label: t('roles.departmentLead') },
                { value: 'locationManager', label: t('roles.locationManager') },
                { value: 'contractor', label: t('roles.contractor') },
                ...(currentBinding.role === 'owner'
                  ? [
                      { value: 'orgAdmin', label: t('roles.orgAdmin') },
                      { value: 'owner', label: t('roles.owner') },
                    ]
                  : []),
                { value: 'itSupport', label: t('roles.itSupport') },
              ]}
            />
          </label>
          <label htmlFor="assignment-location">
            {t('common.location')}
            <AppSelect
              id="assignment-location"
              name="locationId"
              defaultValue={selectedAssignment?.locationId}
              options={locations.map((item) => ({
                value: item.id,
                label: item.shortName,
              }))}
            />
          </label>
          <label htmlFor="assignment-department">
            {t('common.department')}
            <AppSelect
              id="assignment-department"
              name="departmentId"
              defaultValue={selectedAssignment?.departmentId}
              options={departments.map((item) => ({
                value: item.id,
                label: item.name,
              }))}
            />
          </label>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <div>
            <Button onClick={() => setEditing(null)}>{t('common.cancel')}</Button>
            <Button type="submit" variant="primary">{t('common.save')}</Button>
          </div>
        </form>
      ) : null}
    </section>
  )
}

function ChannelsView() {
  const { t } = useTranslation()
  const {
    accessRequests,
    channels,
    users,
    locations,
    resolveAccessRequest,
  } = useClinic()
  const [error, setError] = useState('')
  const resolve = async (
    requestId: string,
    status: 'approved' | 'denied',
  ) => {
    setError('')
    try {
      await resolveAccessRequest(requestId, status)
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : t('admin.saveFailed'),
      )
    }
  }
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
      <aside className="access-request-panel">
        <h2>{t('admin.accessRequests')}</h2>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        {accessRequests.filter((request) => request.status === 'pending').length === 0
          ? <p>{t('common.noResults')}</p>
          : accessRequests
              .filter((request) => request.status === 'pending')
              .map((request) => (
                <article key={request.id}>
                  <strong>{users.find((user) => user.id === request.requesterId)?.name}</strong>
                  <p>{request.reason}</p>
                  <div>
                    <Button onClick={() => void resolve(request.id, 'denied')}>
                      {t('admin.deny')}
                    </Button>
                    <Button
                      variant="primary"
                      onClick={() => void resolve(request.id, 'approved')}
                    >
                      {t('admin.approve')}
                    </Button>
                  </div>
                </article>
              ))}
      </aside>
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
  return (
    <section className="management-section">
      <div className="safety-note">
        <FileWarning size={22} />
        <div>
          <strong>{t('admin.staffingUnavailable')}</strong>
          <p>{t('admin.staffingUnavailableHelp')}</p>
        </div>
      </div>
    </section>
  )
}

function AuditView() {
  const { t } = useTranslation()
  const { auditEvents, users } = useClinic()
  return <section className="management-section"><div className="safety-note"><FileWarning size={22} /><div><strong>{t('admin.metadataOnly')}</strong><p>{t('admin.safetyDetail')}</p></div></div><div className="audit-list">{auditEvents.map((event) => <article key={event.id}><span className="audit-icon"><ShieldCheck size={20} /></span><div><strong>{event.action}</strong><p>{event.targetLabel}</p><small>{users.find((user) => user.id === event.actorId)?.name ?? t('admin.systemActor')} · {new Date(event.createdAt).toLocaleString()}</small></div><StatusBadge tone="neutral">{event.locationId ?? 'organization'}</StatusBadge></article>)}</div></section>
}

function IncidentView() {
  const { t } = useTranslation()
  const { incidentId } = useParams()
  const { auditEvents, channels, users, locations } = useClinic()
  const navigate = useNavigate()
  const incident = channels.find((item) => item.id === incidentId) ?? channels.find((item) => item.type === 'incident')
  const incidentEvents = auditEvents.filter(
    (event) => event.targetLabel === incident?.id,
  )
  if (!incident) {
    return <div className="module-empty"><RadioTower /><h1>{t('admin.noIncidents')}</h1></div>
  }
  return <div className="incident-layout"><section className="incident-command"><header><RadioTower size={26} /><div><span>{incident.name}</span><h2>{incident.displayName}</h2><p>{incident.purpose}</p></div><StatusBadge tone="critical">{t('common.active')}</StatusBadge></header><div className="incident-actions"><Button variant="primary" onClick={() => navigate(`/channels/${incident.id}`)}>{t('inbox.openChannel')}</Button></div><dl><div><dt>{t('common.owner')}</dt><dd>{users.find((user) => user.id === incident.ownerId)?.name}</dd></div><div><dt>{t('common.location')}</dt><dd>{locations.find((location) => location.id === incident.locationIds[0])?.shortName}</dd></div><div><dt>{t('common.members')}</dt><dd>{incident.memberIds.length}</dd></div></dl></section><section className="incident-timeline"><h2>{t('admin.incidentTimeline')}</h2>{incidentEvents.length ? <ol>{incidentEvents.map((event) => <li key={event.id}><CheckCircle2 size={18} /><div><strong>{event.action}</strong><small>{new Date(event.createdAt).toLocaleString()} · {users.find((user) => user.id === event.actorId)?.name ?? t('admin.systemActor')}</small></div></li>)}</ol> : <p>{t('common.noResults')}</p>}</section></div>
}

function SettingsView() {
  const { t } = useTranslation()
  const {
    organization,
    currentBinding,
    users,
    saveOrganizationSettings,
  } = useClinic()
  const ownerBinding = currentBinding.role === 'owner'
    ? currentBinding
    : undefined
  const owner = users.find((user) => user.id === ownerBinding?.userId)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setError('')
    try {
      await saveOrganizationSettings({
        name: String(form.get('name') ?? '').trim(),
        shortName: String(form.get('shortName') ?? '').trim(),
        legalName: String(form.get('legalName') ?? '').trim(),
        defaultLocale: String(form.get('defaultLocale')) as 'en-US' | 'vi-VN',
        timezone: String(form.get('timezone') ?? '').trim(),
        retentionDays: Number(form.get('retentionDays')) as 30 | 90 | 365,
        operationalWarningDefault:
          form.get('operationalWarningDefault') === 'on',
      })
      setSaved(true)
      window.setTimeout(() => setSaved(false), 1400)
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : t('admin.saveFailed'),
      )
    }
  }
  return (
    <form className="settings-form" onSubmit={submit}>
      <section>
        <h2>{t('admin.organizationProfile')}</h2>
        <label>
          {t('admin.organizationName')}
          <input name="name" required defaultValue={organization.name} />
        </label>
        <label>
          {t('admin.displayName')}
          <input name="shortName" required defaultValue={organization.shortName} />
        </label>
        <label>
          {t('admin.legalName')}
          <input name="legalName" required defaultValue={organization.legalName} />
        </label>
        <label htmlFor="organization-default-locale">
          {t('admin.defaultLocale')}
          <AppSelect
            id="organization-default-locale"
            name="defaultLocale"
            defaultValue={organization.defaultLocale}
            options={[
              { value: 'en-US', label: 'English' },
              { value: 'vi-VN', label: 'Tiếng Việt' },
            ]}
          />
        </label>
        <label>
          {t('meeting.timezone')}
          <input
            name="timezone"
            required
            defaultValue={organization.timezone ?? 'Asia/Ho_Chi_Minh'}
          />
        </label>
      </section>
      <section>
        <h2>{t('admin.defaultPolicies')}</h2>
        <label htmlFor="organization-retention">
          {t('admin.retention')}
          <AppSelect
            id="organization-retention"
            name="retentionDays"
            defaultValue={String(organization.retentionDays ?? 90)}
            options={[
              { value: '30', label: t('admin.days30') },
              { value: '90', label: t('admin.days90') },
              { value: '365', label: t('admin.year1') },
            ]}
          />
        </label>
        <p className="admin-scope-note">{t('admin.retentionDisabled')}</p>
        <label className="choice-row">
          <input
            name="operationalWarningDefault"
            type="checkbox"
            defaultChecked={organization.operationalWarningDefault ?? true}
          />
          <span>{t('admin.warningDefault')}</span>
        </label>
      </section>
      <section>
        <h2>{t('admin.ownership')}</h2>
        <p>{owner?.name} · {owner?.email}</p>
      </section>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {saved ? <div className="success-banner" role="status">{t('admin.settingsSaved')}</div> : null}
      <Button variant="primary" icon={<Save size={18} />} type="submit">
        {t('admin.saveSettings')}
      </Button>
    </form>
  )
}
