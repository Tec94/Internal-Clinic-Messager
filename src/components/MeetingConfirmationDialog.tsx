import * as Dialog from '@radix-ui/react-dialog'
import { CalendarDays, Video, X } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CreateMeetingInput, MeetingCandidate } from '../types/domain'
import { Button, IconButton } from './ui'

interface MeetingConfirmationDialogProps {
  channelId: string
  channelName: string
  body: string
  candidate: MeetingCandidate
  onCancel: () => void
  onSendPlain: () => void
  onCreate: (input: CreateMeetingInput) => void
}

function toLocalInput(value?: string) {
  if (!value) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    hourCycle: 'h23', timeZone: 'Asia/Ho_Chi_Minh',
  }).formatToParts(new Date(value))
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}

export function MeetingConfirmationDialog({ channelId, channelName, body, candidate, onCancel, onSendPlain, onCreate }: MeetingConfirmationDialogProps) {
  const { t } = useTranslation()
  const [title, setTitle] = useState(candidate.title ?? `${t('nav.meetings')} — ${channelName}`)
  const [startsAt, setStartsAt] = useState(toLocalInput(candidate.startsAt))
  const [endsAt, setEndsAt] = useState(toLocalInput(candidate.endsAt))
  const [errors, setErrors] = useState<Record<string, string>>({})

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const nextErrors: Record<string, string> = {}
    if (!title.trim()) nextErrors.title = t('meeting.validationTitle')
    if (!startsAt) nextErrors.startsAt = t('meeting.validationStart')
    if (!endsAt || new Date(`${endsAt}:00+07:00`) <= new Date(`${startsAt}:00+07:00`)) nextErrors.endsAt = t('meeting.validationEnd')
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    onCreate({ channelId, body, title: title.trim(), provider: candidate.provider, joinUrl: candidate.joinUrl, startsAt: `${startsAt}:00+07:00`, endsAt: `${endsAt}:00+07:00`, timezone: candidate.timezone })
  }

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onCancel() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="meeting-confirm-dialog" aria-describedby="meeting-confirm-description">
          <header className="dialog-header"><div><span className="meeting-detected"><Video size={16} />{t('meeting.detected')}</span><Dialog.Title>{t('meeting.confirmTitle')}</Dialog.Title></div><Dialog.Close asChild><IconButton aria-label={t('common.close')}><X size={20} /></IconButton></Dialog.Close></header>
          <Dialog.Description id="meeting-confirm-description">{t('meeting.confirmBody')}</Dialog.Description>
          <form onSubmit={submit}>
            <label className="form-field"><span>{t('meeting.meetingTitle')}</span><input value={title} onChange={(event) => setTitle(event.target.value)} aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? 'meeting-title-error' : undefined} />{errors.title ? <small id="meeting-title-error" className="field-error">{errors.title}</small> : null}</label>
            <div className="meeting-time-grid">
              <label className="form-field"><span><CalendarDays size={15} />{t('meeting.starts')}</span><input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} aria-invalid={Boolean(errors.startsAt)} />{errors.startsAt ? <small className="field-error">{errors.startsAt}</small> : null}</label>
              <label className="form-field"><span><CalendarDays size={15} />{t('meeting.ends')}</span><input type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} aria-invalid={Boolean(errors.endsAt)} />{errors.endsAt ? <small className="field-error">{errors.endsAt}</small> : null}</label>
            </div>
            <dl className="meeting-confirm-meta"><div><dt>{t('meeting.provider')}</dt><dd>{t(`meeting.${candidate.provider}`)}</dd></div><div><dt>{t('meeting.timezone')}</dt><dd>{candidate.timezone}</dd></div></dl>
            <footer className="dialog-footer"><Button onClick={onSendPlain}>{t('meeting.sendPlain')}</Button><Button type="submit" variant="primary" icon={<Video size={17} />}>{t('meeting.postInvite')}</Button></footer>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
