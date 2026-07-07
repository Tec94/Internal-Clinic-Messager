import { CalendarDays, Video, X } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CreateMeetingInput, MeetingCandidate } from '../types/domain'
import { Button, IconButton } from './ui'
import { MorphingModal } from './ui/motion/morphing-modal'

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
  const [view, setView] = useState<'edit' | 'details'>('edit')

  const createInvite = () => {
    const nextErrors: Record<string, string> = {}
    if (!title.trim()) nextErrors.title = t('meeting.validationTitle')
    if (!startsAt) nextErrors.startsAt = t('meeting.validationStart')
    if (!endsAt || new Date(`${endsAt}:00+07:00`) <= new Date(`${startsAt}:00+07:00`)) nextErrors.endsAt = t('meeting.validationEnd')
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      setView('edit')
      return
    }
    onCreate({ channelId, body, title: title.trim(), provider: candidate.provider, joinUrl: candidate.joinUrl, startsAt: `${startsAt}:00+07:00`, endsAt: `${endsAt}:00+07:00`, timezone: candidate.timezone })
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    createInvite()
  }

  return (
    <MorphingModal
      viewId={view}
      onClose={onCancel}
      placement="center"
      ariaLabelledBy="meeting-confirm-title"
      ariaDescribedBy="meeting-confirm-description"
      className="meeting-confirm-dialog"
      contentClassName="meeting-confirm-dialog__content"
      overlayClassName="meeting-morphing-overlay"
    >
      {view === 'edit' ? (
        <>
          <header className="dialog-header"><div><span className="meeting-detected"><Video size={16} />{t('meeting.detected')}</span><h2 id="meeting-confirm-title">{t('meeting.confirmTitle')}</h2></div><IconButton onClick={onCancel} aria-label={t('common.close')}><X size={20} /></IconButton></header>
          <p id="meeting-confirm-description">{t('meeting.confirmBody')}</p>
          <form onSubmit={submit}>
            <label className="form-field"><span>{t('meeting.meetingTitle')}</span><input value={title} onChange={(event) => setTitle(event.target.value)} aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? 'meeting-title-error' : undefined} />{errors.title ? <small id="meeting-title-error" className="field-error">{errors.title}</small> : null}</label>
            <div className="meeting-time-grid">
              <label className="form-field"><span><CalendarDays size={15} />{t('meeting.starts')}</span><input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} aria-invalid={Boolean(errors.startsAt)} />{errors.startsAt ? <small className="field-error">{errors.startsAt}</small> : null}</label>
              <label className="form-field"><span><CalendarDays size={15} />{t('meeting.ends')}</span><input type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} aria-invalid={Boolean(errors.endsAt)} />{errors.endsAt ? <small className="field-error">{errors.endsAt}</small> : null}</label>
            </div>
            <div className="meeting-confirm-summary">
              <span>{t(`meeting.${candidate.provider}`)} · {candidate.timezone}</span>
              <button type="button" onClick={() => setView('details')}>{t('meeting.reviewLink')}</button>
            </div>
            <footer className="dialog-footer"><Button onClick={onSendPlain}>{t('meeting.sendPlain')}</Button><Button type="submit" variant="primary" icon={<Video size={17} />}>{t('meeting.postInvite')}</Button></footer>
          </form>
        </>
      ) : (
        <>
          <header className="dialog-header"><div><span className="meeting-detected"><Video size={16} />{t('meeting.detected')}</span><h2 id="meeting-confirm-title">{t('meeting.linkDetails')}</h2></div><IconButton onClick={onCancel} aria-label={t('common.close')}><X size={20} /></IconButton></header>
          <p id="meeting-confirm-description">{t('meeting.confirmBody')}</p>
          <dl className="meeting-confirm-meta meeting-confirm-meta--stacked"><div><dt>{t('meeting.provider')}</dt><dd>{t(`meeting.${candidate.provider}`)}</dd></div><div><dt>{t('meeting.timezone')}</dt><dd>{candidate.timezone}</dd></div><div><dt>{t('meeting.starts')}</dt><dd>{startsAt}</dd></div><div><dt>{t('meeting.ends')}</dt><dd>{endsAt}</dd></div><div className="meeting-confirm-meta__link"><dt>{t('meeting.link')}</dt><dd><a href={candidate.joinUrl} target="_blank" rel="noreferrer">{candidate.joinUrl}</a></dd></div></dl>
          <footer className="dialog-footer"><Button onClick={() => setView('edit')}>{t('common.back')}</Button><Button variant="primary" icon={<Video size={17} />} onClick={createInvite}>{t('meeting.postInvite')}</Button></footer>
        </>
      )}
    </MorphingModal>
  )
}
