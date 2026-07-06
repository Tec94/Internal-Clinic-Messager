import { zodResolver } from '@hookform/resolvers/zod'
import * as Dialog from '@radix-ui/react-dialog'
import { BellRing, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { useClinic } from '../state/ClinicContext'
import type { AnnouncementAudience, AnnouncementPriority } from '../types/domain'
import { Button, IconButton } from './ui'

interface AnnouncementForm {
  title: string
  body: string
  organizationWide: boolean
  locationIds: string[]
  departmentIds: string[]
  priority: AnnouncementPriority
  requireAcknowledgement: boolean
}

export function AnnouncementDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const {
    createAnnouncement,
    currentBinding,
    departments,
    locations,
    hasPermission,
  } = useClinic()
  const [submitMode, setSubmitMode] = useState<'draft' | 'published'>('published')
  const [success, setSuccess] = useState(false)

  const schema = useMemo(
    () =>
      z
        .object({
          title: z.string().min(1, t('announcement.titleRequired')),
          body: z.string().min(1, t('announcement.bodyRequired')),
          organizationWide: z.boolean(),
          locationIds: z.array(z.string()),
          departmentIds: z.array(z.string()),
          priority: z.enum(['standard', 'urgent']),
          requireAcknowledgement: z.boolean(),
        })
        .refine(
          (value) =>
            value.organizationWide ||
            value.locationIds.length > 0 ||
            value.departmentIds.length > 0,
          { message: t('announcement.scopeRequired'), path: ['locationIds'] },
        ),
    [t],
  )

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<AnnouncementForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      body: '',
      organizationWide: false,
      locationIds: currentBinding.locationIds,
      departmentIds: [],
      priority: 'standard',
      requireAcknowledgement: false,
    },
  })

  const organizationWide = watch('organizationWide')
  const canSendOrganization = hasPermission('sendOrganizationAnnouncement')

  const submit = (value: AnnouncementForm) => {
    const audience: AnnouncementAudience = {
      organizationWide: canSendOrganization && value.organizationWide,
      locationIds: canSendOrganization && value.organizationWide ? [] : value.locationIds,
      departmentIds: canSendOrganization && value.organizationWide ? [] : value.departmentIds,
    }
    createAnnouncement({
      title: value.title,
      body: value.body,
      audience,
      priority: value.priority,
      requireAcknowledgement: value.requireAcknowledgement,
      status: submitMode,
    })
    setSuccess(true)
    window.setTimeout(() => {
      setSuccess(false)
      reset()
      onOpenChange(false)
    }, 550)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="announcement-dialog">
          <header className="dialog-header">
            <div className="dialog-heading-with-icon"><BellRing size={22} /><div><Dialog.Title>{t('announcement.compose')}</Dialog.Title><Dialog.Description>{t('admin.scopeNote')}</Dialog.Description></div></div>
            <Dialog.Close asChild><IconButton aria-label={t('common.close')}><X size={20} /></IconButton></Dialog.Close>
          </header>
          {success ? <div className="success-banner" role="status">{t('announcement.sent')}</div> : null}
          <form className="announcement-form" onSubmit={handleSubmit(submit)}>
            <fieldset className="audience-fieldset">
              <legend>{t('announcement.targetAudience')}</legend>
              {canSendOrganization ? (
                <label className="choice-row"><input type="checkbox" {...register('organizationWide')} /><span>{t('announcement.organizationWide')}</span></label>
              ) : null}
              <div className="audience-grid" aria-disabled={organizationWide}>
                <div>
                  <strong>{t('announcement.selectedLocations')}</strong>
                  {locations.filter((item) => currentBinding.role === 'owner' || currentBinding.role === 'orgAdmin' || currentBinding.locationIds.includes(item.id)).map((item) => (
                    <label className="choice-row" key={item.id}><input type="checkbox" value={item.id} {...register('locationIds')} disabled={organizationWide} /><span>{item.shortName}</span></label>
                  ))}
                </div>
                <div>
                  <strong>{t('announcement.selectedDepartments')}</strong>
                  {departments.filter((item) => currentBinding.role === 'owner' || currentBinding.role === 'orgAdmin' || currentBinding.departmentIds.includes(item.id)).slice(0, 5).map((item) => (
                    <label className="choice-row" key={item.id}><input type="checkbox" value={item.id} {...register('departmentIds')} disabled={organizationWide} /><span>{item.name}</span></label>
                  ))}
                </div>
              </div>
              {errors.locationIds ? <p className="field-error">{errors.locationIds.message}</p> : null}
            </fieldset>
            <div className="form-field"><label htmlFor="announcement-title">{t('announcement.title')}</label><input id="announcement-title" {...register('title')} aria-invalid={Boolean(errors.title)} />{errors.title ? <p className="field-error">{errors.title.message}</p> : null}</div>
            <div className="form-field"><label htmlFor="announcement-body">{t('announcement.body')}</label><textarea id="announcement-body" rows={6} {...register('body')} aria-invalid={Boolean(errors.body)} />{errors.body ? <p className="field-error">{errors.body.message}</p> : null}</div>
            <div className="announcement-options">
              <fieldset><legend>{t('common.urgent')}</legend><label className="choice-row"><input type="radio" value="standard" {...register('priority')} /><span>{t('announcement.standard')}</span></label><label className="choice-row"><input type="radio" value="urgent" {...register('priority')} /><span>{t('announcement.urgent')}</span></label></fieldset>
              <label className="choice-row"><input type="checkbox" {...register('requireAcknowledgement')} /><span>{t('announcement.requireAck')}</span></label>
            </div>
            <footer className="dialog-footer">
              <Button type="submit" onClick={() => setSubmitMode('draft')}>{t('announcement.saveDraft')}</Button>
              <Button type="submit" variant="primary" onClick={() => setSubmitMode('published')}>{t('announcement.send')}</Button>
            </footer>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
