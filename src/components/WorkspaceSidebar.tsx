import { LockKeyhole, LogOut, Plus, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../state/AuthContext'
import { useClinic } from '../state/ClinicContext'
import { useMessaging } from '../state/MessagingContext'
import type { Channel, ChannelType } from '../types/domain'
import { AppSelect } from './AppSelect'
import { Avatar, Button, ChannelGlyph, IconButton } from './ui'
import { ModuleSidebar, type ModuleSidebarMode } from './ModuleSidebar'

interface WorkspaceSidebarProps {
  open: boolean
  onClose: () => void
  onCreateChannel: () => void
  authEnabled?: boolean
}

const adminLinks = [
  ['overview', 'admin.overview'],
  ['locations', 'admin.locations'],
  ['people', 'admin.people'],
  ['channels', 'admin.channels'],
  ['announcements', 'admin.announcements'],
  ['staffing', 'admin.staffing'],
  ['audit', 'admin.audit'],
  ['incidents/incident-triage-a', 'admin.incidents'],
  ['settings', 'admin.settings'],
] as const

export function WorkspaceSidebar({
  open,
  onClose,
  onCreateChannel,
  authEnabled = false,
}: WorkspaceSidebarProps) {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const {
    users,
    currentUser,
    currentBinding,
    currentLocationId,
    locations,
    setCurrentLocationId,
    ensureDirectChannel,
  } = useClinic()
  const {
    channels,
    isProduction,
    isLoading: messagingLoading,
    error: messagingError,
    supportsChannelCreation,
  } = useMessaging()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'unread' | 'mentions' | 'urgent'>('all')
  const isAdmin = location.pathname.startsWith('/admin')
  const moduleMode: ModuleSidebarMode | null = location.pathname.startsWith('/tasks')
    ? 'tasks'
    : location.pathname.startsWith('/documents')
      ? 'documents'
      : location.pathname.startsWith('/meetings')
        ? 'meetings'
        : location.pathname.startsWith('/people') || location.pathname.startsWith('/directory')
          ? 'people'
          : null
  const sidebarLabel = isAdmin
    ? t('admin.title')
    : moduleMode
      ? t(`nav.${moduleMode}`)
      : t('nav.chats')

  const visibleChannels = useMemo(() => {
    const allowed = channels.filter((channel) => {
      const roleCanSeeAll = currentBinding.role === 'owner' || currentBinding.role === 'orgAdmin'
      const isMember = channel.memberIds.includes(currentUser.id)
      const inLocation = currentLocationId === 'all' || channel.locationIds.includes(currentLocationId)
      const matchesQuery = `${channel.name} ${channel.displayName}`.toLowerCase().includes(query.toLowerCase())
      const matchesFilter = filter === 'all' || (filter === 'unread' && channel.unreadCount > 0) || (filter === 'urgent' && channel.isUrgent) || filter === 'mentions'
      const canView = (
        isProduction
        || roleCanSeeAll
        || isMember
        || channel.visibility === 'public'
      )
      return (
        canView
        && (isProduction || inLocation)
        && matchesQuery
        && matchesFilter
      )
    })
    return allowed
  }, [
    channels,
    currentBinding.role,
    currentLocationId,
    currentUser.id,
    filter,
    isProduction,
    query,
  ])

  const bindingLocationIds = useMemo(
    () => new Set(currentBinding.locationIds),
    [currentBinding.locationIds],
  )
  const directChannels = useMemo(
    () => visibleChannels.filter((channel) => channel.type === 'direct'),
    [visibleChannels],
  )
  const availableLocations = useMemo(
    () => locations.filter((item) => bindingLocationIds.has(item.id)),
    [bindingLocationIds, locations],
  )
  const otherUsers = useMemo(
    () => users.filter((user) => user.id !== currentUser.id),
    [currentUser.id, users],
  )
  const groups: Array<{ title: string; types: ReadonlySet<ChannelType> }> = [
    { title: t('sidebar.myDepartment'), types: new Set(['department']) },
    { title: t('sidebar.crossDepartment'), types: new Set(['interface', 'project', 'incident']) },
    { title: t('sidebar.announcements'), types: new Set(['announcement', 'leadership', 'location']) },
  ]

  const openDirectMessage = (userId: string) => {
    const channel = ensureDirectChannel(userId)
    if (!channel) return
    navigate(`/channels/${channel.id}`)
    onClose()
  }

  return (
    <aside className={`workspace-sidebar ${open ? 'workspace-sidebar--open' : ''}`} aria-label={sidebarLabel}>
      <header className="workspace-header">
        <div>
          <strong>{t('app.name')}</strong>
          {isProduction ? (
            <span>{t('common.allLocations')}</span>
          ) : (
            <AppSelect
              ariaLabel={t('common.location')}
              value={currentLocationId}
              onValueChange={setCurrentLocationId}
              options={[
                ...((currentBinding.role === 'owner' || currentBinding.role === 'orgAdmin')
                  ? [{ value: 'all', label: t('common.allLocations') }]
                  : []),
                ...availableLocations.map((item) => ({
                  value: item.id,
                  label: item.shortName,
                })),
              ]}
            />
          )}
        </div>
        <IconButton className="sidebar-close" onClick={onClose} aria-label={t('common.close')}><X size={20} /></IconButton>
      </header>

      {isAdmin ? (
        <nav className="admin-nav" aria-label={t('admin.title')}>
          <div className="sidebar-heading-row">
            <span>{t('admin.title')}</span>
          </div>
          {adminLinks.map(([path, label]) => (
            <NavLink key={path} to={`/admin/${path}`} className={({ isActive }) => `admin-nav__item ${isActive ? 'is-active' : ''}`} onClick={onClose}>
              <span>{t(label)}</span>
            </NavLink>
          ))}
          <p className="admin-scope-note">{t('admin.scopeNote')}</p>
        </nav>
      ) : moduleMode ? (
        <ModuleSidebar mode={moduleMode} onSelect={onClose} />
      ) : (
        <>
          <div className="sidebar-tabs" role="group" aria-label={t('nav.inbox')}>
            {(['all', 'unread', 'mentions', 'urgent'] as const).map((item) => (
              <button type="button" key={item} aria-pressed={filter === item} className={filter === item ? 'is-active' : ''} onClick={() => setFilter(item)}>
                {t(`common.${item === 'all' ? 'all' : item}`)}
              </button>
            ))}
          </div>
          <label className="search-field">
            <Search size={18} aria-hidden="true" />
            <span className="sr-only">{t('common.search')}</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('sidebar.searchPlaceholder')} />
          </label>
          <div className="channel-scroll-region">
            {messagingLoading ? <p>{t('common.loading')}</p> : null}
            {messagingError ? <p role="alert">{messagingError}</p> : null}
            {groups.map((group) => {
              const items = visibleChannels.filter((channel) => group.types.has(channel.type))
              if (items.length === 0) return null
              return (
                <section className="channel-group" key={group.title}>
                  <h2>{group.title}</h2>
                  <div className="channel-group__list">
                    {items.map((channel) => <ChannelLink key={channel.id} channel={channel} onSelect={onClose} />)}
                  </div>
                </section>
              )
            })}
            <section className="channel-group">
              <h2>{t('sidebar.directMessages')}</h2>
              <div className="channel-group__list">
                {isProduction
                  ? directChannels.map((channel) => (
                        <ChannelLink
                          key={channel.id}
                          channel={channel}
                          onSelect={onClose}
                        />
                      ))
                  : otherUsers.map((user) => (
                      <button type="button" key={user.id} className="direct-message-row" onClick={() => openDirectMessage(user.id)}>
                        <Avatar initials={user.initials} presence={user.presence} size="small" />
                        <span>{user.name}</span>
                      </button>
                    ))}
              </div>
            </section>
            {!messagingLoading && !messagingError && visibleChannels.length === 0
              ? <p>{t('common.noResults')}</p>
              : null}
          </div>
          {supportsChannelCreation ? <div className="sidebar-create">
            <Button icon={<Plus size={18} />} onClick={onCreateChannel}>{t('sidebar.createChannel')}</Button>
          </div> : null}
        </>
      )}

      {authEnabled ? (
        <footer className="workspace-footer">
          <AuthenticatedAccount />
        </footer>
      ) : null}
    </aside>
  )
}

function AuthenticatedAccount() {
  const { t } = useTranslation()
  const { session, signOut } = useAuth()
  return (
    <div className="authenticated-account">
      <span>{session?.user.email}</span>
      <Button icon={<LogOut size={17} />} onClick={() => void signOut()}>
        {t('auth.signOut')}
      </Button>
    </div>
  )
}

function ChannelLink({ channel, onSelect }: { channel: Channel; onSelect: () => void }) {
  return (
    <NavLink
      to={`/channels/${channel.id}`}
      className={({ isActive }) => `channel-row ${isActive ? 'is-active' : ''} ${channel.isUrgent ? 'is-urgent' : ''}`}
      onClick={onSelect}
    >
      <ChannelGlyph channel={channel} />
      <span className="channel-row__name">{channel.name}</span>
      {channel.visibility === 'private' ? <LockKeyhole className="channel-row__lock" size={13} aria-label="Private" /> : null}
      {channel.unreadCount > 0 ? <span className="unread-badge" aria-label={`${channel.unreadCount} unread`}>{channel.unreadCount}</span> : null}
    </NavLink>
  )
}
