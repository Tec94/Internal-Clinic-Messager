import { CalendarDays, Check, FileText, ListChecks, Plus, UserRound, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n'
import { useClinic } from '../state/ClinicContext'
import type { Channel, Task } from '../types/domain'
import { Avatar, Button, IconButton } from './ui'
import { Checkbox } from './ui/motion/checkbox'
import { TaskStatusBadge } from './TaskStatusBadge'

export function IntegrationPanel({ channel, initialTab, onClose, onTabChange, onAssignTask }: { channel: Channel; initialTab: 'tasks' | 'documents'; onClose: () => void; onTabChange: (tab: 'tasks' | 'documents') => void; onAssignTask?: () => void }) {
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
    const inertTargets = Array.from(document.querySelectorAll<HTMLElement>('.icon-rail, .workspace-sidebar, .compact-topbar, .conversation-column, .mobile-bottom-nav'))
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
        <div className="integration-tabs">
          <header>
            <div className="integration-tab-list" aria-label={t('channel.integrations')}>
              <button className="integration-tab" type="button" aria-pressed={initialTab === 'tasks'} data-state={initialTab === 'tasks' ? 'active' : 'inactive'} onClick={() => onTabChange('tasks')}>{t('channel.tasks')}</button>
              <button className="integration-tab" type="button" aria-pressed={initialTab === 'documents'} data-state={initialTab === 'documents' ? 'active' : 'inactive'} onClick={() => onTabChange('documents')}>{t('channel.documents')}</button>
            </div>
            <IconButton onClick={requestClose} aria-label={t('common.close')}><X size={20} /></IconButton>
          </header>

          {initialTab === 'tasks' ? <section className="integration-content">
            <div className="panel-action-row">
              <Button variant="primary" icon={<Plus size={17} />} onClick={onAssignTask}>{t('task.assignTask')}</Button>
            </div>
            <PanelSection icon={<ListChecks size={18} />} title={t('channel.fromThisChat')} count={currentTasks.length}>
              {currentTasks.length ? currentTasks.map((task) => <TaskCard key={task.id} task={task} users={users} />) : <p className="panel-empty-copy">{t('channel.noChannelTasks')}</p>}
            </PanelSection>
            <PanelSection title={t('channel.otherAssignedTasks')} count={otherTasks.length}>
              {otherTasks.length ? otherTasks.map((task) => <TaskCard key={task.id} task={task} users={users} source={channels.find((item) => item.id === task.channelId)?.displayName} />) : <p className="panel-empty-copy">{t('modules.noTasks')}</p>}
            </PanelSection>
          </section> : null}

          {initialTab === 'documents' ? <section className="integration-content">
            <PanelSection icon={<FileText size={18} />} title={t('channel.documentsShared')} count={currentDocuments.length}>
              {currentDocuments.length ? <div className="document-list">{currentDocuments.map((attachment) => <button key={attachment.id}><FileText size={22} /><span><strong>{attachment.name}</strong><small>{attachment.sizeLabel} · {formatDate(attachment.uploadedAt)}</small></span></button>)}</div> : <p className="panel-empty-copy">{t('channel.noChannelDocuments')}</p>}
            </PanelSection>
          </section> : null}
        </div>
      </aside>
    </>
  )
}

function PanelSection({ title, count, icon, children }: { title: string; count: number; icon?: React.ReactNode; children: React.ReactNode }) {
  return <section className="panel-section"><header>{icon}<h2>{title}</h2><span className="tabular-nums">{count}</span></header>{children}</section>
}

function TaskCard({ task, users, source }: { task: Task; users: ReturnType<typeof useClinic>['users']; source?: string }) {
  const { t } = useTranslation()
  const { currentUser, updateTask } = useClinic()
  const owner = users.find((user) => user.id === task.ownerId)
  const canCheck = (task.ownerId === currentUser.id || task.collaboratorIds.includes(currentUser.id)) && ['accepted', 'inProgress'].includes(task.status)
  const setChecklistItem = (itemId: string, completed: boolean) => {
    const checklist = task.checklist.map((item) => item.id === itemId ? { ...item, completed } : item)
    updateTask(task.id, {
      checklist,
      status: checklist.every((item) => item.completed) ? 'done' : checklist.some((item) => item.completed) ? 'inProgress' : 'accepted',
    })
  }
  return <article className="panel-task"><div className="panel-title-row"><h3>{task.title}</h3><TaskStatusBadge status={task.status} /></div>{source ? <small className="panel-source">{source}</small> : null}<dl className="task-metadata"><div><dt><UserRound size={16} />{t('common.owner')}</dt><dd>{owner ? <><Avatar initials={owner.initials} size="small" />{owner.name}</> : '—'}</dd></div><div><dt><CalendarDays size={16} />{t('common.due')}</dt><dd className="tabular-nums">{formatDate(task.dueAt)}</dd></div></dl><div className="task-checklist">{task.checklist.map((item) => <div className="task-check-row" key={item.id}><Checkbox checked={item.completed} disabled={!canCheck} onCheckedChange={(checked) => setChecklistItem(item.id, checked)} aria-label={item.label} /><span>{item.label}</span>{item.completed ? <Check size={16} /> : null}</div>)}</div></article>
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(i18n.language, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value))
}
