import * as Dialog from '@radix-ui/react-dialog'
import {
  CalendarDays,
  CircleHelp,
  FileText,
  LayoutDashboard,
  Menu as MoreIcon,
  MessageCircle,
  MessageSquareText,
  Settings,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, useLocation } from 'react-router-dom'
import { useNativeBackHandler } from '../native/useNativePlatform'
import { useClinic } from '../state/ClinicContext'
import { IconButton } from './ui'

export function MobileNavigation({
  unreadTotal,
  chatPath,
  zaloEnabled = false,
  onOpenZalo,
}: {
  unreadTotal: number
  chatPath: string
  zaloEnabled?: boolean
  onOpenZalo?: () => void
}) {
  const { t } = useTranslation()
  const { hasPermission } = useClinic()
  const location = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)
  const [helpVisible, setHelpVisible] = useState(false)
  const moreActive = ['/documents', '/people', '/admin'].some((path) => location.pathname.startsWith(path))

  useNativeBackHandler(moreOpen, () => {
    setMoreOpen(false)
    return true
  })

  const primaryItems = [
    { to: '/inbox', label: t('nav.inbox'), icon: LayoutDashboard, active: location.pathname === '/inbox' },
    { to: chatPath, label: t('nav.chats'), icon: MessageSquareText, active: location.pathname.startsWith('/channels'), badge: unreadTotal },
    { to: '/tasks', label: t('nav.tasks'), icon: ShieldCheck, active: location.pathname.startsWith('/tasks') },
    { to: '/meetings', label: t('nav.meetings'), icon: CalendarDays, active: location.pathname.startsWith('/meetings') },
  ]

  return (
    <>
      <nav className="mobile-bottom-nav" aria-label={t('mobile.navigation')}>
        {primaryItems.map(({ to, label, icon: Icon, active, badge }) => (
          <NavLink key={to} to={to} className={`mobile-nav-link ${active ? 'is-active' : ''}`}>
            <span className="mobile-nav-link__icon">
              <Icon size={21} aria-hidden="true" />
              {badge ? <span className="mobile-nav-badge" aria-hidden="true">{badge > 99 ? '99+' : badge}</span> : null}
            </span>
            <span>{label}</span>
          </NavLink>
        ))}
        <button className={`mobile-nav-link ${moreActive || moreOpen ? 'is-active' : ''}`} type="button" onClick={() => setMoreOpen(true)} aria-expanded={moreOpen} aria-haspopup="dialog">
          <MoreIcon size={21} aria-hidden="true" />
          <span>{t('mobile.more')}</span>
        </button>
      </nav>

      <Dialog.Root open={moreOpen} onOpenChange={(open) => {
        setMoreOpen(open)
        if (!open) setHelpVisible(false)
      }}>
        <Dialog.Portal>
          <Dialog.Overlay className="mobile-more-overlay" />
          <Dialog.Content className="mobile-more-sheet" aria-describedby="mobile-more-description">
            <header className="mobile-more-sheet__header">
              <div>
                <Dialog.Title>{t('mobile.more')}</Dialog.Title>
                <Dialog.Description id="mobile-more-description">{t('mobile.moreDescription')}</Dialog.Description>
              </div>
              <Dialog.Close asChild><IconButton aria-label={t('common.close')}><X size={20} /></IconButton></Dialog.Close>
            </header>

            <nav className="mobile-more-links" aria-label={t('mobile.moreNavigation')}>
              <Dialog.Close asChild><NavLink to="/documents"><FileText size={20} />{t('nav.documents')}</NavLink></Dialog.Close>
              <Dialog.Close asChild><NavLink to="/people"><Users size={20} />{t('nav.people')}</NavLink></Dialog.Close>
              {zaloEnabled && onOpenZalo ? (
                <Dialog.Close asChild>
                  <button type="button" onClick={onOpenZalo}><MessageCircle size={20} />{t('nav.zalo')}</button>
                </Dialog.Close>
              ) : null}
              {hasPermission('viewAdmin') ? <Dialog.Close asChild><NavLink to="/admin/overview"><ShieldCheck size={20} />{t('nav.admin')}</NavLink></Dialog.Close> : null}
              <button type="button" onClick={() => setHelpVisible((visible) => !visible)} aria-expanded={helpVisible}><CircleHelp size={20} />{t('nav.help')}</button>
              <Dialog.Close asChild><NavLink to="/settings"><Settings size={20} />{t('nav.settings')}</NavLink></Dialog.Close>
            </nav>

            {helpVisible ? <p className="mobile-help-copy" role="status">{t('mobile.helpBody')}</p> : null}

          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}
