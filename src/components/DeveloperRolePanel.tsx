import { ChevronDown, FlaskConical } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useClinic } from '../state/ClinicContext'
import { AppSelect } from './AppSelect'

export function DeveloperRolePanel() {
  const { t } = useTranslation()
  const {
    users,
    currentUser,
    setCurrentUserId,
    roleBindings,
  } = useClinic()
  const [open, setOpen] = useState(false)

  return (
    <section className={`developer-role-panel ${open ? 'is-open' : ''}`}>
      <button
        type="button"
        className="developer-role-panel__trigger"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={t('developerPanel.previewRole')}
      >
        <FlaskConical size={17} aria-hidden="true" />
        <span>{t('developerPanel.previewRole')}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open ? (
        <div className="developer-role-panel__body">
          <strong>{t('developerPanel.developmentOnly')}</strong>
          <p>{t('developerPanel.help')}</p>
          <label htmlFor="developer-role-user">
            <span>{t('common.role')}</span>
            <AppSelect
              id="developer-role-user"
              value={currentUser.id}
              onValueChange={setCurrentUserId}
              options={users.map((user) => {
                const role = roleBindings.find((binding) =>
                  user.roleBindingIds.includes(binding.id),
                )?.role ?? 'staff'
                return {
                  value: user.id,
                  label: `${user.name} — ${t(`roles.${role}`)}`,
                }
              })}
            />
          </label>
        </div>
      ) : null}
    </section>
  )
}
