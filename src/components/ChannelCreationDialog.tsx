import { zodResolver } from '@hookform/resolvers/zod'
import * as Dialog from '@radix-ui/react-dialog'
import { AlertCircle, Info, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { inspectOperationalContent } from '../services/mockClinicService'
import { useClinic } from '../state/ClinicContext'
import type { CreateChannelInput } from '../types/domain'
import { AppSelect } from './AppSelect'
import { Button, IconButton } from './ui'

interface ChannelCreationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ChannelCreationDialog({
  open,
  onOpenChange,
}: ChannelCreationDialogProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { createChannel, departments, locations, currentLocationId } = useClinic()
  const [policyWarning, setPolicyWarning] = useState(false)
  const [policyConfirmed, setPolicyConfirmed] = useState(false)

  const schema = useMemo(
    () =>
      z.object({
        name: z
          .string()
          .regex(/^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/, t('createChannel.validationName')),
        purpose: z.string().min(10, t('createChannel.validationPurpose')),
        departmentIds: z.array(z.string()).min(1, t('createChannel.validationParticipants')),
        visibility: z.enum(['public', 'private', 'restricted']),
        locationId: z.string().min(1),
        archivePolicy: z.enum(['24h', '7d', 'indefinite']),
        urgent: z.boolean(),
      }),
    [t],
  )

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateChannelInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: 'same-day-schedule-dr-nguyen',
      purpose: 'Điều phối thay đổi lịch trong ngày tại Cơ sở Trung tâm',
      departmentIds: ['front-desk', 'nursing'],
      visibility: 'private',
      locationId: currentLocationId,
      archivePolicy: '24h',
      urgent: false,
    },
  })

  const values = watch()

  useEffect(() => {
    if (!open) {
      setPolicyWarning(false)
      setPolicyConfirmed(false)
    }
  }, [open])

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen)
    if (!nextOpen) {
      reset()
      setPolicyWarning(false)
      setPolicyConfirmed(false)
    }
  }

  const onSubmit = async (input: CreateChannelInput) => {
    const warnings = [
      ...inspectOperationalContent(input.name, 'channelName'),
      ...inspectOperationalContent(input.purpose, 'purpose'),
    ]
    if (warnings.length > 0 && !policyConfirmed) {
      setPolicyWarning(true)
      return
    }
    const channel = await createChannel(input)
    onOpenChange(false)
    navigate(`/channels/${channel.id}`)
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <div className="channel-dialog-stage">
          <Dialog.Content className="channel-dialog" aria-describedby="channel-dialog-description">
            <header className="dialog-header">
              <div>
                <Dialog.Title>{t('createChannel.title')}</Dialog.Title>
                <Dialog.Description id="channel-dialog-description" className="sr-only">
                  {t('createChannel.guidance')} {t('createChannel.noPatient')}
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <IconButton aria-label={t('common.close')}>
                  <X size={20} />
                </IconButton>
              </Dialog.Close>
            </header>

            <form onSubmit={handleSubmit(onSubmit)} className="channel-form" noValidate>
              <div className="form-field">
                <label htmlFor="channel-name">{t('createChannel.name')}</label>
                <input id="channel-name" autoFocus {...register('name')} aria-invalid={Boolean(errors.name)} />
                {errors.name ? <p className="field-error">{errors.name.message}</p> : null}
              </div>

              <div className="form-field">
                <label htmlFor="channel-purpose">{t('createChannel.purpose')}</label>
                <input id="channel-purpose" {...register('purpose')} aria-invalid={Boolean(errors.purpose)} />
                {errors.purpose ? <p className="field-error">{errors.purpose.message}</p> : null}
              </div>

              <fieldset className="participant-fieldset">
                <legend>{t('createChannel.participants')}</legend>
                <p>{t('createChannel.selectGroups')}</p>
                <div className="participant-list">
                  {departments.slice(0, 4).map((department) => {
                    const checked = values.departmentIds?.includes(department.id)
                    return (
                      <label key={department.id} className="participant-option">
                        <input type="checkbox" value={department.id} {...register('departmentIds')} />
                        <span className="participant-code">{department.code}</span>
                        <span>{department.name}</span>
                        <span className="participant-count">{department.id === 'nursing' ? 12 : department.id === 'providers' ? 8 : department.id === 'billing' ? 6 : 5}</span>
                        <span className="sr-only">{checked ? t('common.selected') : t('common.notSelected')}</span>
                      </label>
                    )
                  })}
                </div>
                {errors.departmentIds ? <p className="field-error">{errors.departmentIds.message}</p> : null}
              </fieldset>

              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor="channel-privacy">{t('createChannel.privacy')}</label>
                  <Controller
                    name="visibility"
                    control={control}
                    render={({ field }) => (
                      <AppSelect
                        ref={field.ref}
                        id="channel-privacy"
                        value={field.value}
                        onValueChange={field.onChange}
                        onBlur={field.onBlur}
                        ariaInvalid={Boolean(errors.visibility)}
                        options={[
                          { value: 'private', label: t('createChannel.private') },
                          { value: 'restricted', label: t('createChannel.departmentPublic') },
                        ]}
                      />
                    )}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="channel-location">{t('createChannel.locationScope')}</label>
                  <Controller
                    name="locationId"
                    control={control}
                    render={({ field }) => (
                      <AppSelect
                        ref={field.ref}
                        id="channel-location"
                        value={field.value}
                        onValueChange={field.onChange}
                        onBlur={field.onBlur}
                        ariaInvalid={Boolean(errors.locationId)}
                        options={locations.map((location) => ({
                          value: location.id,
                          label: location.shortName,
                        }))}
                      />
                    )}
                  />
                </div>
              </div>

              <div className="form-field">
                <label htmlFor="channel-archive">{t('createChannel.archiveDefault')}</label>
                <Controller
                  name="archivePolicy"
                  control={control}
                  render={({ field }) => (
                    <AppSelect
                      ref={field.ref}
                      id="channel-archive"
                      value={field.value}
                      onValueChange={field.onChange}
                      onBlur={field.onBlur}
                      ariaInvalid={Boolean(errors.archivePolicy)}
                      options={[
                        { value: '24h', label: t('createChannel.archive24') },
                        { value: '7d', label: t('createChannel.archive7') },
                        { value: 'indefinite', label: t('createChannel.indefinite') },
                      ]}
                    />
                  )}
                />
              </div>

              <label className="urgent-checkbox">
                <AlertCircle size={18} aria-hidden="true" />
                <strong>{t('createChannel.urgent')}</strong>
                <input type="checkbox" {...register('urgent')} />
                <span>{t('createChannel.urgentDescription')}</span>
              </label>

              {policyWarning ? (
                <div className="policy-warning" role="alert">
                  <AlertCircle size={20} />
                  <div>
                    <strong>{t('channel.phiPromptTitle')}</strong>
                    <p>{t('channel.phiPromptBody')}</p>
                    <label className="confirm-check">
                      <input
                        type="checkbox"
                        checked={policyConfirmed}
                        onChange={(event) => setPolicyConfirmed(event.target.checked)}
                      />
                      {t('channel.confirmSafe')}
                    </label>
                  </div>
                </div>
              ) : null}

              <footer className="dialog-footer">
                <Dialog.Close asChild>
                  <Button>{t('common.cancel')}</Button>
                </Dialog.Close>
                <Button type="submit" variant="primary" disabled={isSubmitting || (policyWarning && !policyConfirmed)}>
                  {t('createChannel.create')}
                </Button>
              </footer>
            </form>
          </Dialog.Content>

          <aside className="channel-guidance" aria-label={t('createChannel.guidance')}>
            <Info size={22} />
            <p>{t('createChannel.guidance')}</p>
            <strong>{t('createChannel.noPatient')}</strong>
          </aside>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
