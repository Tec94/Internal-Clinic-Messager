import {
  CalendarClock,
  ClipboardList,
  LayoutTemplate,
  ListPlus,
  Paperclip,
  Repeat2,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react'
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ACCEPTED_ATTACHMENT_EXTENSIONS, MAX_ATTACHMENT_FILES } from '../services/uploadAdapter'
import { useClinic } from '../state/ClinicContext'
import { useMessaging } from '../state/MessagingContext'
import type { Channel, TaskRecurrence } from '../types/domain'
import { AppSelect } from './AppSelect'
import { Button, IconButton } from './ui'
import { Checkbox } from './ui/motion/checkbox'
import { Drawer } from './ui/motion/drawer'
import { FileUpload, type FileUploadItem } from './ui/motion/file-upload'

function toDatetimeLocal(value: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).formatToParts(value)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}

function recurrenceDateParts(value: string) {
  const [date] = value.split('T')
  const [year, month, day] = date.split('-').map(Number)
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  return { monthDay: day, weekday: weekday === 0 ? 7 : weekday }
}

export function TaskAssignmentDrawer({
  channel,
  open,
  sourceMessageId,
  sourceText,
  onOpenChange,
}: {
  channel: Channel
  open: boolean
  sourceMessageId?: string
  sourceText?: string
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const {
    users,
    assignments,
    currentUser,
    currentBinding,
    taskTemplates,
    createTask,
  } = useClinic()
  const { uploadAttachments } = useMessaging()
  const titleRef = useRef<HTMLInputElement>(null)
  const dueRef = useRef<HTMLInputElement>(null)
  const canDelegate = ['owner', 'orgAdmin', 'locationManager', 'departmentLead'].includes(currentBinding.role)
  const memberUsers = useMemo(() => {
    const channelUsers = channel.memberIds
      .map((id) => users.find((user) => user.id === id))
      .filter(Boolean) as typeof users
    if (!canDelegate) return channelUsers.filter((user) => user.id === currentUser.id)
    if (currentBinding.role === 'owner' || currentBinding.role === 'orgAdmin') return channelUsers
    return channelUsers.filter((user) => assignments.some((assignment) => {
      if (assignment.userId !== user.id) return false
      if (currentBinding.role === 'locationManager') return currentBinding.locationIds.includes(assignment.locationId)
      return currentBinding.departmentIds.includes(assignment.departmentId)
    }))
  }, [assignments, canDelegate, channel.memberIds, currentBinding, currentUser.id, users])
  const tomorrow = useMemo(() => new Date(Date.now() + 24 * 60 * 60 * 1000), [])
  const starterTemplates = useMemo(() => [
    { id: 'opening', title: t('task.starter.openingTitle'), checklist: [t('task.starter.opening1'), t('task.starter.opening2'), t('task.starter.opening3')] },
    { id: 'closing', title: t('task.starter.closingTitle'), checklist: [t('task.starter.closing1'), t('task.starter.closing2'), t('task.starter.closing3')] },
    { id: 'coverage', title: t('task.starter.coverageTitle'), checklist: [t('task.starter.coverage1'), t('task.starter.coverage2')] },
    { id: 'supplies', title: t('task.starter.suppliesTitle'), checklist: [t('task.starter.supplies1'), t('task.starter.supplies2')] },
    { id: 'equipment', title: t('task.starter.equipmentTitle'), checklist: [t('task.starter.equipment1'), t('task.starter.equipment2')] },
    { id: 'training', title: t('task.starter.trainingTitle'), checklist: [t('task.starter.training1'), t('task.starter.training2')] },
  ], [t])
  const templateOptions = [
    ...starterTemplates.map((template) => ({ value: `starter:${template.id}`, label: template.title })),
    ...taskTemplates.map((template) => ({ value: `saved:${template.id}`, label: template.name })),
  ]
  const [title, setTitle] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [collaboratorIds, setCollaboratorIds] = useState<string[]>([])
  const [dueAt, setDueAt] = useState('')
  const [checklistText, setChecklistText] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [recurrence, setRecurrence] = useState<'' | TaskRecurrence>('')
  const [uploadItems, setUploadItems] = useState<FileUploadItem[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setTitle(sourceText ? `${t('task.followUp')}: ${sourceText.slice(0, 58)}` : '')
    setOwnerId(canDelegate ? '' : currentUser.id)
    setDueAt(canDelegate ? '' : toDatetimeLocal(tomorrow))
    setChecklistText('')
    setTemplateId('')
    setRecurrence('')
    setCollaboratorIds([])
    setUploadItems([])
    setError('')
  }, [canDelegate, currentUser.id, open, sourceText, t, tomorrow])

  const applyTemplate = (value: string) => {
    setTemplateId(value)
    const [kind, id] = value.split(':')
    const template = kind === 'starter'
      ? starterTemplates.find((item) => item.id === id)
      : taskTemplates.find((item) => item.id === id)
    if (!template) return
    setTitle(template.title)
    setChecklistText(template.checklist.join('\n'))
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const checklist = checklistText.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)
    if (!title.trim()) { setError(t('task.validationTitle')); titleRef.current?.focus(); return }
    if (!ownerId) { setError(t('task.validationOwner')); document.getElementById('task-owner')?.focus(); return }
    if (!dueAt) { setError(t('task.validationDue')); dueRef.current?.focus(); return }
    setSaving(true)
    setError('')
    try {
      const files = uploadItems.flatMap((item) => item.file ? [item.file] : [])
      const uploaded = files.length ? await uploadAttachments(files, channel.id) : []
      const recurrenceParts = recurrenceDateParts(dueAt)
      await createTask({
        channelId: channel.id,
        title: title.trim(),
        ownerId,
        collaboratorIds,
        dueAt: `${dueAt}:00+07:00`,
        checklist,
        sourceMessageId,
        attachmentIds: uploaded.map((attachment) => attachment.id),
        recurrence: recurrence ? {
          frequency: recurrence,
          weekdays: recurrence === 'weekly' ? [recurrenceParts.weekday] : [],
          monthDay: recurrence === 'monthly' ? recurrenceParts.monthDay : undefined,
          timezone: 'Asia/Ho_Chi_Minh',
          createLeadMinutes: 1440,
        } : undefined,
      })
      onOpenChange(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('task.validationUpload'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} ariaLabel={t('task.assignTask')} className="workspace-drawer task-drawer" backdropClassName="workspace-drawer-backdrop">
      <form onSubmit={submit} noValidate>
        <header className="drawer-header">
          <div><span>{channel.displayName}</span><h2>{t('task.assignTask')}</h2></div>
          <IconButton onClick={() => onOpenChange(false)} aria-label={t('common.close')}><X size={20} /></IconButton>
        </header>
        <div className="drawer-body">
          {sourceText ? <section className="task-drawer-section task-drawer-section--source"><p className="task-source-preview">{sourceText}</p></section> : null}
          <p className="task-operational-note">{t('auth.operationalOnly')}</p>
          <section className="task-drawer-section task-drawer-section--core">
            <header className="task-drawer-section__header"><UserRound size={18} /><div><h3>{t('task.details')}</h3><p>{t('task.detailsHelp')}</p></div></header>
            {templateOptions.length ? <label className="form-field" htmlFor="task-template"><span>{t('task.template')}</span><AppSelect id="task-template" value={templateId} onValueChange={applyTemplate} placeholder={t('task.templatePlaceholder')} options={templateOptions} /></label> : null}
            <label className="form-field"><span>{t('task.title')}</span><input ref={titleRef} value={title} onChange={(event) => setTitle(event.target.value)} aria-invalid={Boolean(error && !title.trim()) || undefined} /></label>
            <label className="form-field" htmlFor="task-owner"><span>{t('common.owner')}</span><AppSelect id="task-owner" value={ownerId} onValueChange={setOwnerId} placeholder={t('task.ownerPlaceholder')} options={memberUsers.map((user) => ({ value: user.id, label: user.id === currentUser.id ? `${user.name} (${t('people.self')})` : user.name }))} disabled={!canDelegate} /></label>
            <label className="form-field"><span>{t('common.due')}</span><input ref={dueRef} type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} aria-invalid={Boolean(error && !dueAt) || undefined} /></label>
          </section>

          <details className="task-drawer-disclosure" open={Boolean(checklistText)}>
            <summary><ClipboardList size={18} /><span><strong>{t('task.checklist')}</strong><small>{t('task.checklistHelp')}</small></span></summary>
            <label className="form-field"><span className="sr-only">{t('task.checklist')}</span><textarea rows={4} value={checklistText} onChange={(event) => setChecklistText(event.target.value)} /></label>
          </details>
          <details className="task-drawer-disclosure">
            <summary><UsersRound size={18} /><span><strong>{t('task.collaborators')}</strong><small>{t('task.collaboratorsHelp')}</small></span></summary>
            <div className="collaborator-picker__list">{memberUsers.filter((user) => user.id !== ownerId).map((user) => <Checkbox key={user.id} checked={collaboratorIds.includes(user.id)} onCheckedChange={(checked) => setCollaboratorIds((items) => checked ? [...items, user.id] : items.filter((id) => id !== user.id))} label={user.name} className="collaborator-option" />)}</div>
          </details>
          {canDelegate ? <details className="task-drawer-disclosure">
            <summary><Repeat2 size={18} /><span><strong>{t('task.repeat')}</strong><small>{t('task.repeatHelp')}</small></span></summary>
            <label className="form-field" htmlFor="task-repeat"><span>{t('task.repeat')}</span><AppSelect id="task-repeat" value={recurrence} onValueChange={(value) => setRecurrence(value as '' | TaskRecurrence)} options={[{ value: '', label: t('task.repeatNone') }, { value: 'daily', label: t('task.repeatDaily') }, { value: 'weekly', label: t('task.repeatWeekly') }, { value: 'monthly', label: t('task.repeatMonthly') }]} /></label>
            {recurrence ? <p className="task-repeat-note"><CalendarClock size={16} />{t('task.repeatLead')}</p> : null}
          </details> : null}
          <details className="task-drawer-disclosure">
            <summary><Paperclip size={18} /><span><strong>{t('task.attachments')}</strong><small>{t('task.attachmentsHelp')}</small></span></summary>
            <FileUpload value={uploadItems} onValueChange={setUploadItems} accept={ACCEPTED_ATTACHMENT_EXTENSIONS.join(',')} maxFiles={MAX_ATTACHMENT_FILES} title={t('attachment.dropTitle')} description={t('attachment.dropDescription')} browseLabel={t('attachment.browse')} className="yksg-file-upload" />
          </details>
          <div className="task-template-footnote"><LayoutTemplate size={16} /><span>{t('task.templateFootnote')}</span></div>
          {error ? <p id="task-form-error" className="field-error" role="alert">{error}</p> : null}
        </div>
        <footer className="drawer-footer"><Button onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button><Button type="submit" variant="primary" icon={<ListPlus size={17} />} disabled={saving}>{saving ? t('common.loading') : canDelegate ? t('task.assignTask') : t('task.createForMe')}</Button></footer>
      </form>
    </Drawer>
  )
}
