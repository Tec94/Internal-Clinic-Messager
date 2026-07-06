import * as Tabs from '@radix-ui/react-tabs'
import { CalendarDays, Check, FileText, ListChecks, UserRound, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n'
import { useClinic } from '../state/ClinicContext'
import type { Channel, Task } from '../types/domain'
import { Avatar, IconButton, StatusBadge } from './ui'

export function IntegrationPanel({ channel, initialTab, onClose, onTabChange }: { channel: Channel; initialTab: 'tasks' | 'documents'; onClose: () => void; onTabChange: (tab: 'tasks' | 'documents') => void }) {
  const { t } = useTranslation()
  const { users, currentUser, tasks, attachments, channels } = useClinic()
  const panelRef = useRef<HTMLElement>(null)
  const [overlay, setOverlay] = useState(() => window.matchMedia('(max-width: 1180px)').matches)
  const [visible, setVisible] = useState(false)
  const currentTasks = tasks.filter((task) => task.channelId === channel.id)
  const otherTasks = tasks.filter((task) => task.channelId !== channel.id && (task.ownerId === currentUser.id || task.collaboratorIds.includes(currentUser.id)))
  const currentDocuments = attachments.filter((attachment) => attachment.channelId === channel.id)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setVisible(true))
    return () => window.cancelAnimationFrame(frame)
  }, [])

  const requestClose = useCallback(() => {
    setVisible(false)
    window.setTimeout(onClose, 170)
  }, [onClose])

  useEffect(() => {
    const query = window.matchMedia('(max-width: 1180px)')
    const update = () => setOverlay(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (!overlay) return
    const returnFocus = document.activeElement as HTMLElement | null
    const inertTargets = Array.from(document.querySelectorAll<HTMLElement>('.icon-rail, .workspace-sidebar, .compact-topbar, .conversation-column'))
    inertTargets.forEach((target) => { target.inert = true })
    const focusable = () => Array.from(panelRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled])') ?? [])
    focusable()[0]?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); requestClose(); return }
      if (event.key !== 'Tab') return
      const items = focusable()
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      inertTargets.forEach((target) => { target.inert = false })
      window.setTimeout(() => returnFocus?.focus(), 0)
    }
  }, [overlay, requestClose])

  return (
    <>
      <button className={`integration-scrim ${visible ? 'is-visible' : ''}`} onClick={requestClose} aria-label={t('common.close')} tabIndex={overlay ? 0 : -1} />
      <aside ref={panelRef} className={`integration-panel ${visible ? 'is-visible' : ''}`} aria-label={`${t('channel.tasks')} / ${t('channel.documents')}`} role={overlay ? 'dialog' : 'complementary'} aria-modal={overlay || undefined}>
        <Tabs.Root value={initialTab} onValueChange={(value) => onTabChange(value as 'tasks' | 'documents')} className="integration-tabs">
          <header>
            <Tabs.List aria-label={t('channel.integrations')}>
              <Tabs.Trigger value="tasks">{t('channel.tasks')}</Tabs.Trigger>
              <Tabs.Trigger value="documents">{t('channel.documents')}</Tabs.Trigger>
            </Tabs.List>
            <IconButton onClick={requestClose} aria-label={t('common.close')}><X size={20} /></IconButton>
          </header>

          <Tabs.Content value="tasks" className="integration-content" forceMount hidden={initialTab !== 'tasks'}>
            <PanelSection icon={<ListChecks size={18} />} title={t('channel.fromThisChat')} count={currentTasks.length}>
              {currentTasks.length ? currentTasks.map((task) => <TaskCard key={task.id} task={task} users={users} />) : <p className="panel-empty-copy">{t('channel.noChannelTasks')}</p>}
            </PanelSection>
            <PanelSection title={t('channel.otherAssignedTasks')} count={otherTasks.length}>
              {otherTasks.length ? otherTasks.map((task) => <TaskCard key={task.id} task={task} users={users} source={channels.find((item) => item.id === task.channelId)?.displayName} />) : <p className="panel-empty-copy">{t('modules.noTasks')}</p>}
            </PanelSection>
          </Tabs.Content>

          <Tabs.Content value="documents" className="integration-content" forceMount hidden={initialTab !== 'documents'}>
            <PanelSection icon={<FileText size={18} />} title={t('channel.documentsShared')} count={currentDocuments.length}>
              {currentDocuments.length ? <div className="document-list">{currentDocuments.map((attachment) => <button key={attachment.id}><FileText size={22} /><span><strong>{attachment.name}</strong><small>{attachment.sizeLabel} · {formatDate(attachment.uploadedAt)}</small></span></button>)}</div> : <p className="panel-empty-copy">{t('channel.noChannelDocuments')}</p>}
            </PanelSection>
          </Tabs.Content>
        </Tabs.Root>
      </aside>
    </>
  )
}

function PanelSection({ title, count, icon, children }: { title: string; count: number; icon?: React.ReactNode; children: React.ReactNode }) {
  return <section className="panel-section"><header>{icon}<h2>{title}</h2><span className="tabular-nums">{count}</span></header>{children}</section>
}

function TaskCard({ task, users, source }: { task: Task; users: ReturnType<typeof useClinic>['users']; source?: string }) {
  const { t } = useTranslation()
  const owner = users.find((user) => user.id === task.ownerId)
  return <article className="panel-task"><div className="panel-title-row"><h3>{task.title}</h3><StatusBadge tone={task.status === 'done' ? 'success' : 'active'}>{task.status === 'done' ? t('common.done') : t('common.open')}</StatusBadge></div>{source ? <small className="panel-source">{source}</small> : null}<dl className="task-metadata"><div><dt><UserRound size={16} />{t('common.owner')}</dt><dd>{owner ? <><Avatar initials={owner.initials} size="small" />{owner.name}</> : '—'}</dd></div><div><dt><CalendarDays size={16} />{t('common.due')}</dt><dd className="tabular-nums">{formatDate(task.dueAt)}</dd></div></dl><div className="task-checklist">{task.checklist.map((item) => <label key={item.id}><input type="checkbox" defaultChecked={item.completed} /><span>{item.label}</span>{item.completed ? <Check size={16} /> : null}</label>)}</div></article>
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(i18n.language, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value))
}
