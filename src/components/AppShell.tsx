import {
  Bell,
  CalendarDays,
  CircleHelp,
  FileText,
  FlaskConical,
  LayoutDashboard,
  Menu,
  MessageSquareText,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useNativeBackHandler } from '../native/useNativePlatform'
import { useClinic } from '../state/ClinicContext'
import { useMessaging } from '../state/MessagingContext'
import { ChannelCreationDialog } from './ChannelCreationDialog'
import { LanguageSwitcher } from './LanguageSwitcher'
import { MobileNavigation } from './MobileNavigation'
import { IconButton } from './ui'
import { WorkspaceSidebar } from './WorkspaceSidebar'
import { ZaloPersonalWidget } from './ZaloPersonalWidget'

export function AppShell({
  authEnabled = false,
  mfaBypassed = false,
  mfaBypassExpiresAt = null,
}: {
  authEnabled?: boolean
  mfaBypassed?: boolean
  mfaBypassExpiresAt?: string | null
}) {
  const { t, i18n } = useTranslation()
  const { hasPermission } = useClinic()
  const {
    channels,
    supportsChannelCreation,
  } = useMessaging()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [createChannelOpen, setCreateChannelOpen] = useState(false)
  const channelDialogTrigger = useRef<HTMLElement | null>(null)
  const workspaceMenuTrigger = useRef<HTMLButtonElement | null>(null)
  const unreadTotal = channels.reduce((total, channel) => total + channel.unreadCount, 0)

  const closeSidebar = () => {
    setSidebarOpen(false)
    window.setTimeout(() => workspaceMenuTrigger.current?.focus(), 0)
  }

  const openCreateChannel = () => {
    if (!supportsChannelCreation) return
    channelDialogTrigger.current = document.activeElement as HTMLElement | null
    setCreateChannelOpen(true)
  }

  const handleCreateChannelOpenChange = (nextOpen: boolean) => {
    setCreateChannelOpen(nextOpen)
    if (!nextOpen) {
      window.setTimeout(() => channelDialogTrigger.current?.focus(), 0)
    }
  }

  useNativeBackHandler(sidebarOpen || createChannelOpen, () => {
    if (createChannelOpen) handleCreateChannelOpenChange(false)
    else closeSidebar()
    return true
  })

  const navItems = [
    { to: '/inbox', label: t('nav.inbox'), icon: LayoutDashboard, active: location.pathname === '/inbox' },
    { to: '/channels', label: t('nav.chats'), icon: MessageSquareText, active: location.pathname.startsWith('/channels') },
    { to: '/tasks', label: t('nav.tasks'), icon: ShieldCheck, active: location.pathname.startsWith('/tasks') },
    { to: '/documents', label: t('nav.documents'), icon: FileText, active: location.pathname.startsWith('/documents') },
    { to: '/meetings', label: t('nav.meetings'), icon: CalendarDays, active: location.pathname.startsWith('/meetings') },
    { to: '/people', label: t('nav.people'), icon: Users, active: location.pathname.startsWith('/people') },
  ]

  const compactTitle = navItems.find((item) => item.active)?.label
    ?? (location.pathname.startsWith('/admin') ? t('nav.admin') : t('app.name'))

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">{t('common.skipToMain')}</a>
      {mfaBypassed && mfaBypassExpiresAt ? (
        <div className="development-mfa-banner" role="status">
          <FlaskConical size={15} aria-hidden="true" />
          <span>
            {t('auth.mfaBypassActive', {
              expires: new Intl.DateTimeFormat(i18n.language, {
                dateStyle: 'short',
                timeStyle: 'short',
              }).format(new Date(mfaBypassExpiresAt)),
            })}
          </span>
        </div>
      ) : null}
      <nav className="icon-rail" aria-label={t('nav.primary')}>
        <button type="button" className="clinic-mark" onClick={() => navigate('/inbox')} aria-label={t('app.fullName')}>YK</button>
        <div className="rail-main">
          {navItems.map(({ to, label, icon: Icon, active }) => (
            <NavLink key={`${to}-${label}`} to={to} className={`rail-link ${active ? 'is-active' : ''}`}>
              <Icon size={21} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
          {hasPermission('viewAdmin') ? (
            <NavLink to="/admin/overview" className={({ isActive }) => `rail-link ${isActive ? 'is-active' : ''}`}>
              <ShieldCheck size={21} aria-hidden="true" />
              <span>{t('nav.admin')}</span>
            </NavLink>
          ) : null}
        </div>
        <div className="rail-footer">
          <IconButton aria-label={t('nav.help')}><CircleHelp size={21} /></IconButton>
          <IconButton aria-label={t('nav.settings')} onClick={() => navigate(hasPermission('viewAdmin') ? '/admin/settings' : '/inbox')}><Settings size={21} /></IconButton>
        </div>
      </nav>

      <WorkspaceSidebar
        open={sidebarOpen}
        onClose={closeSidebar}
        onCreateChannel={openCreateChannel}
        authEnabled={authEnabled}
      />

      <div className="app-main">
        <div className="compact-topbar">
          <IconButton ref={workspaceMenuTrigger} onClick={() => setSidebarOpen(true)} aria-label={t('nav.openNavigation')}><Menu size={21} /></IconButton>
          <strong className="compact-title compact-title--app">{t('app.name')}</strong>
          <strong className="compact-title compact-title--route">{compactTitle}</strong>
          <div className="compact-actions">
            <span className="notification-counter" aria-label={t('nav.notifications', { count: unreadTotal })}><Bell size={19} aria-hidden="true" />{unreadTotal > 0 ? <span>{unreadTotal}</span> : null}</span>
            <LanguageSwitcher />
          </div>
        </div>
        <main id="main-content" tabIndex={-1}>
          <Outlet context={{ openCreateChannel }} />
        </main>
      </div>

      <MobileNavigation unreadTotal={unreadTotal} chatPath="/channels" />

      {supportsChannelCreation ? (
        <ChannelCreationDialog
          open={createChannelOpen}
          onOpenChange={handleCreateChannelOpenChange}
        />
      ) : null}
      <ZaloPersonalWidget />
      <button type="button" className={`sidebar-scrim ${sidebarOpen ? 'is-visible' : ''}`} onClick={closeSidebar} aria-label={t('common.close')} />
    </div>
  )
}
