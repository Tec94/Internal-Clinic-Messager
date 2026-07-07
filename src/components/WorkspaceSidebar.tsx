import { ChevronDown, Languages, LockKeyhole, Plus, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import i18n from '../i18n'
import { useClinic } from '../state/ClinicContext'
import type { Channel, ChannelType } from '../types/domain'
import { Avatar, Button, ChannelGlyph, IconButton } from './ui'
import { ModuleSidebar, type ModuleSidebarMode } from './ModuleSidebar'
import { AppearanceSwitcher } from './AppearanceSwitcher'

interface WorkspaceSidebarProps {
  open: boolean
  onClose: () => void
  onCreateChannel: () => void
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

export function WorkspaceSidebar({ open, onClose, onCreateChannel }: WorkspaceSidebarProps) {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const {
    channels,
    users,
    currentUser,
    currentBinding,
    currentLocationId,
    locations,
    setCurrentLocationId,
    setCurrentUserId,
    roleBindings,
    ensureDirectChannel,
  } = useClinic()
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
      return (roleCanSeeAll || isMember || channel.visibility === 'public') && inLocation && matchesQuery && matchesFilter
    })
    return allowed
  }, [channels, currentBinding.role, currentLocationId, currentUser.id, filter, query])

  const groups: Array<{ title: string; types: ChannelType[] }> = [
    { title: t('sidebar.myDepartment'), types: ['department'] },
    { title: t('sidebar.crossDepartment'), types: ['interface', 'project', 'incident'] },
    { title: t('sidebar.announcements'), types: ['announcement', 'leadership', 'location'] },
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
          <select
            aria-label={t('common.location')}
            value={currentLocationId}
            onChange={(event) => setCurrentLocationId(event.target.value)}
          >
            {(currentBinding.role === 'owner' || currentBinding.role === 'orgAdmin') ? <option value="all">{t('common.allLocations')}</option> : null}
            {locations.filter((item) => currentBinding.locationIds.includes(item.id)).map((item) => <option key={item.id} value={item.id}>{item.shortName}</option>)}
          </select>
        </div>
        <ChevronDown size={18} aria-hidden="true" />
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
              <button key={item} aria-pressed={filter === item} className={filter === item ? 'is-active' : ''} onClick={() => setFilter(item)}>
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
            {groups.map((group) => {
              const items = visibleChannels.filter((channel) => group.types.includes(channel.type))
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
                {users.filter((user) => user.id !== currentUser.id).map((user) => (
                  <button key={user.id} className="direct-message-row" onClick={() => openDirectMessage(user.id)}>
                    <Avatar initials={user.initials} presence={user.presence} size="small" />
                    <span>{user.name}</span>
                  </button>
                ))}
              </div>
            </section>
          </div>
          <div className="sidebar-create">
            <Button icon={<Plus size={18} />} onClick={onCreateChannel}>{t('sidebar.createChannel')}</Button>
          </div>
        </>
      )}

      <footer className="workspace-footer">
        <label>
          <span>{t('common.role')}</span>
          <select value={currentUser.id} onChange={(event) => setCurrentUserId(event.target.value)}>
            {users.map((user) => {
              const role = roleBindings.find((binding) => user.roleBindingIds.includes(binding.id))?.role ?? 'staff'
              return <option key={user.id} value={user.id}>{user.name} — {t(`roles.${role}`)}</option>
            })}
          </select>
        </label>
        <div className="sidebar-language">
          <span>{t('common.language')}</span>
          <div className="language-switcher" aria-label={t('common.language')}>
            <Languages size={17} aria-hidden="true" />
            <button className={i18n.language === 'en-US' ? 'is-active' : ''} onClick={() => void i18n.changeLanguage('en-US')} aria-pressed={i18n.language === 'en-US'}>EN</button>
            <button className={i18n.language === 'vi-VN' ? 'is-active' : ''} onClick={() => void i18n.changeLanguage('vi-VN')} aria-pressed={i18n.language === 'vi-VN'}>VI</button>
          </div>
        </div>
        <div className="sidebar-appearance">
          <span>{t('appearance.label')}</span>
          <AppearanceSwitcher />
        </div>
      </footer>
    </aside>
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
