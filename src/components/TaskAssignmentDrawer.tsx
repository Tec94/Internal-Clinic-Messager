import { CalendarClock, ClipboardList, ListPlus, Paperclip, UserRound, UsersRound, X } from 'lucide-react'
import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ACCEPTED_ATTACHMENT_EXTENSIONS, MAX_ATTACHMENT_FILES } from '../services/uploadAdapter'
import { useClinic } from '../state/ClinicContext'
import { useMessaging } from '../state/MessagingContext'
import type { Channel } from '../types/domain'
import { AppSelect } from './AppSelect'
import { Button, IconButton } from './ui'
import { Checkbox } from './ui/motion/checkbox'
import { Drawer } from './ui/motion/drawer'
import { FileUpload, type FileUploadItem } from './ui/motion/file-upload'

function toDatetimeLocal(value: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).formatToParts(value)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
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
  const { users, currentUser, createTask } = useClinic()
  const { uploadAttachments } = useMessaging()
  const memberUsers = useMemo(
    () => channel.memberIds.map((id) => users.find((user) => user.id === id)).filter(Boolean) as typeof users,
    [channel.memberIds, users],
  )
  const tomorrow = useMemo(() => new Date(Date.now() + 24 * 60 * 60 * 1000), [])
  const [title, setTitle] = useState(sourceText ? `${t('task.followUp')}: ${sourceText.slice(0, 58)}` : '')
  const [ownerId, setOwnerId] = useState(memberUsers.some((user) => user.id === currentUser.id) ? currentUser.id : memberUsers[0]?.id ?? '')
  const [collaboratorIds, setCollaboratorIds] = useState<string[]>([])
  const [dueAt, setDueAt] = useState(toDatetimeLocal(tomorrow))
  const [checklistText, setChecklistText] = useState(`${t('task.confirmOwner')}\n${t('task.postUpdate')}`)
  const [uploadItems, setUploadItems] = useState<FileUploadItem[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setTitle(sourceText ? `${t('task.followUp')}: ${sourceText.slice(0, 58)}` : '')
    setCollaboratorIds([])
    setUploadItems([])
    setError('')
  }, [open, sourceText, t])

  const reset = () => {
    setTitle('')
    setCollaboratorIds([])
    setUploadItems([])
    setError('')
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const checklist = checklistText.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)
    if (!title.trim()) { setError(t('task.validationTitle')); return }
    if (!ownerId) { setError(t('task.validationOwner')); return }
    if (!dueAt) { setError(t('task.validationDue')); return }
    if (checklist.length === 0) { setError(t('task.validationChecklist')); return }
    setSaving(true)
    setError('')
    try {
      const files = uploadItems.flatMap((item) => item.file ? [item.file] : [])
      const uploaded = files.length
        ? await uploadAttachments(files, channel.id)
        : []
      await createTask({
        channelId: channel.id,
        title: title.trim(),
        ownerId,
        collaboratorIds,
        dueAt: `${dueAt}:00+07:00`,
        checklist,
        sourceMessageId,
        attachmentIds: uploaded.map((attachment) => attachment.id),
      })
      reset()
      onOpenChange(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('task.validationUpload'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      ariaLabel={t('task.assignTask')}
      className="workspace-drawer task-drawer"
      backdropClassName="workspace-drawer-backdrop"
    >
      <form onSubmit={submit}>
        <header className="drawer-header">
          <div>
            <span>{channel.displayName}</span>
            <h2>{t('task.assignTask')}</h2>
          </div>
          <IconButton onClick={() => onOpenChange(false)} aria-label={t('common.close')}><X size={20} /></IconButton>
        </header>
        <div className="drawer-body">
          {sourceText ? <section className="task-drawer-section task-drawer-section--source"><p className="task-source-preview">{sourceText}</p></section> : null}
          <section className="task-drawer-section">
            <header className="task-drawer-section__header"><UserRound size={18} /><div><h3>{t('task.details')}</h3><p>{t('task.detailsHelp')}</p></div></header>
            <label className="form-field">
              <span>{t('task.title')}</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label className="form-field" htmlFor="task-owner">
              <span>{t('common.owner')}</span>
              <AppSelect
                id="task-owner"
                value={ownerId}
                onValueChange={setOwnerId}
                options={memberUsers.map((user) => ({
                  value: user.id,
                  label: user.name,
                }))}
              />
            </label>
          </section>
          <fieldset className="task-drawer-section collaborator-picker">
            <legend><UsersRound size={18} /><span>{t('task.collaborators')}</span></legend>
            <p>{t('task.collaboratorsHelp')}</p>
            <div className="collaborator-picker__list">
              {memberUsers.filter((user) => user.id !== ownerId).map((user) => (
                <Checkbox
                  key={user.id}
                  checked={collaboratorIds.includes(user.id)}
                  onCheckedChange={(checked) => {
                    setCollaboratorIds((items) => checked ? [...items, user.id] : items.filter((id) => id !== user.id))
                  }}
                  label={user.name}
                  className="collaborator-option"
                />
              ))}
            </div>
          </fieldset>
          <section className="task-drawer-section">
            <header className="task-drawer-section__header"><CalendarClock size={18} /><div><h3>{t('task.schedule')}</h3><p>{t('task.scheduleHelp')}</p></div></header>
            <label className="form-field">
              <span>{t('common.due')}</span>
              <input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
            </label>
          </section>
          <section className="task-drawer-section">
            <header className="task-drawer-section__header"><ClipboardList size={18} /><div><h3>{t('task.checklist')}</h3><p>{t('task.checklistHelp')}</p></div></header>
            <label className="form-field">
              <span className="sr-only">{t('task.checklist')}</span>
              <textarea rows={4} value={checklistText} onChange={(event) => setChecklistText(event.target.value)} />
            </label>
          </section>
          <section className="task-drawer-section">
            <header className="task-drawer-section__header"><Paperclip size={18} /><div><h3>{t('task.attachments')}</h3><p>{t('task.attachmentsHelp')}</p></div></header>
            <FileUpload
              value={uploadItems}
              onValueChange={setUploadItems}
              accept={ACCEPTED_ATTACHMENT_EXTENSIONS.join(',')}
              maxFiles={MAX_ATTACHMENT_FILES}
              title={t('attachment.dropTitle')}
              description={t('attachment.dropDescription')}
              browseLabel={t('attachment.browse')}
              className="yksg-file-upload"
            />
          </section>
          {error ? <p className="field-error" role="alert">{error}</p> : null}
        </div>
        <footer className="drawer-footer">
          <Button onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button type="submit" variant="primary" icon={<ListPlus size={17} />} disabled={saving}>{saving ? t('common.loading') : t('task.assignTask')}</Button>
        </footer>
      </form>
    </Drawer>
  )
}
