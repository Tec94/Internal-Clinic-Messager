import * as ContextMenu from '@radix-ui/react-context-menu'
import {
  Bell,
  CalendarDays,
  CircleHelp,
  FileText,
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
import {
  useNativeBackHandler,
  useNativePlatform,
} from '../native/useNativePlatform'
import { useClinic } from '../state/ClinicContext'
import { useMessaging } from '../state/MessagingContext'
import { ChannelCreationDialog } from './ChannelCreationDialog'
import { DeveloperRolePanel } from './DeveloperRolePanel'
import { MobileNavigation } from './MobileNavigation'
import { PwaStatus } from './PwaStatus'
import { IconButton } from './ui'
import { WorkspaceSidebar } from './WorkspaceSidebar'
import { ZaloPersonalLauncher } from './ZaloPersonalLauncher'

export function AppShell({
  authEnabled = false,
}: {
  authEnabled?: boolean
}) {
  const { t } = useTranslation()
  const { isNative } = useNativePlatform()
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
    { to: '/meetings', label: t('nav.meetings'), icon: CalendarDays, active: location.pathname.startsWith('/meetings') },
    { to: '/documents', label: t('nav.documents'), icon: FileText, active: location.pathname.startsWith('/documents') },
    { to: '/people', label: t('nav.people'), icon: Users, active: location.pathname.startsWith('/people') },
  ]

  const compactTitle = navItems.find((item) => item.active)?.label
    ?? (location.pathname.startsWith('/admin') ? t('nav.admin') : t('app.name'))

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <div className="app-shell">
          <div
            className="app-shell__context-boundary"
            onContextMenu={(event) => {
              if (isEditableContextTarget(event.target)) event.stopPropagation()
            }}
            onPointerDown={(event) => {
              if (isEditableContextTarget(event.target)) event.stopPropagation()
            }}
          >
            <a className="skip-link" href="#main-content">{t('common.skipToMain')}</a>
            <nav className="icon-rail" aria-label={t('nav.primary')}>
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
                <IconButton aria-label={t('nav.settings')} onClick={() => navigate('/settings')}><Settings size={21} /></IconButton>
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
            {!authEnabled ? <DeveloperRolePanel /> : null}
            {!isNative ? <PwaStatus /> : null}
            {(!authEnabled
              || import.meta.env.VITE_ENABLE_ZALO_LAUNCHER === 'true')
              ? <ZaloPersonalLauncher />
              : null}
            <button type="button" className={`sidebar-scrim ${sidebarOpen ? 'is-visible' : ''}`} onClick={closeSidebar} aria-label={t('common.close')} />
          </div>
        </div>
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content
          className="context-menu"
          aria-label={t('contextMenu.navigation')}
          collisionPadding={8}
          loop
        >
          <ContextMenu.Label className="context-menu__label">
            {t('contextMenu.navigation')}
          </ContextMenu.Label>
          {navItems.slice(0, 4).map(({ to, label, icon: Icon }) => (
            <ContextMenu.Item
              className="context-menu__item"
              key={to}
              onSelect={() => navigate(to)}
            >
              <Icon size={16} aria-hidden="true" />
              {label}
            </ContextMenu.Item>
          ))}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  )
}

function isEditableContextTarget(target: EventTarget | null) {
  return target instanceof Element
    && Boolean(target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])'))
}
