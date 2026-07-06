import {
  Bell,
  CalendarDays,
  CircleHelp,
  FileText,
  Languages,
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
import i18n from '../i18n'
import { useClinic } from '../state/ClinicContext'
import { ChannelCreationDialog } from './ChannelCreationDialog'
import { IconButton } from './ui'
import { WorkspaceSidebar } from './WorkspaceSidebar'
import { AppearanceSwitcher } from './AppearanceSwitcher'

export function AppShell() {
  const { t } = useTranslation()
  const { hasPermission } = useClinic()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [createChannelOpen, setCreateChannelOpen] = useState(false)
  const channelDialogTrigger = useRef<HTMLElement | null>(null)

  const openCreateChannel = () => {
    channelDialogTrigger.current = document.activeElement as HTMLElement | null
    setCreateChannelOpen(true)
  }

  const handleCreateChannelOpenChange = (nextOpen: boolean) => {
    setCreateChannelOpen(nextOpen)
    if (!nextOpen) {
      window.setTimeout(() => channelDialogTrigger.current?.focus(), 0)
    }
  }

  const navItems = [
    { to: '/inbox', label: t('nav.inbox'), icon: LayoutDashboard, active: location.pathname === '/inbox' },
    { to: '/channels/front-desk-home', label: t('nav.chats'), icon: MessageSquareText, active: location.pathname.startsWith('/channels/') },
    { to: '/tasks', label: t('nav.tasks'), icon: ShieldCheck, active: location.pathname.startsWith('/tasks') },
    { to: '/documents', label: t('nav.documents'), icon: FileText, active: location.pathname.startsWith('/documents') },
    { to: '/meetings', label: t('nav.meetings'), icon: CalendarDays, active: location.pathname.startsWith('/meetings') },
    { to: '/people', label: t('nav.people'), icon: Users, active: location.pathname.startsWith('/people') },
  ]

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">{t('common.skipToMain')}</a>
      <nav className="icon-rail" aria-label={t('nav.primary')}>
        <button className="clinic-mark" onClick={() => navigate('/inbox')} aria-label={t('app.fullName')}>YK</button>
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

      <WorkspaceSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} onCreateChannel={openCreateChannel} />

      <div className="app-main">
        <div className="compact-topbar">
          <IconButton onClick={() => setSidebarOpen(true)} aria-label={t('nav.openNavigation')}><Menu size={21} /></IconButton>
          <strong>{t('app.name')}</strong>
          <div className="compact-actions">
            <Bell size={19} aria-hidden="true" />
            <AppearanceSwitcher compact />
            <LanguageSwitcher />
          </div>
        </div>
        <main id="main-content" tabIndex={-1}>
          <Outlet context={{ openCreateChannel }} />
        </main>
      </div>

      <ChannelCreationDialog open={createChannelOpen} onOpenChange={handleCreateChannelOpenChange} />
      <button className={`sidebar-scrim ${sidebarOpen ? 'is-visible' : ''}`} onClick={() => setSidebarOpen(false)} aria-label={t('common.close')} />
    </div>
  )
}

function LanguageSwitcher() {
  const { t } = useTranslation()
  const locale = i18n.language
  return (
    <div className="language-switcher" aria-label={t('common.language')}>
      <Languages size={17} aria-hidden="true" />
      <button className={locale === 'en-US' ? 'is-active' : ''} onClick={() => void i18n.changeLanguage('en-US')} aria-pressed={locale === 'en-US'}>EN</button>
      <button className={locale === 'vi-VN' ? 'is-active' : ''} onClick={() => void i18n.changeLanguage('vi-VN')} aria-pressed={locale === 'vi-VN'}>VI</button>
    </div>
  )
}
