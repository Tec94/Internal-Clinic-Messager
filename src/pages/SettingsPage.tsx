import {
  Check,
  Download,
  KeyRound,
  Languages,
  Save,
  SlidersHorizontal,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n'
import {
  changePassword,
  loadAccountSettings,
  saveAccountSettings,
  syncPushSubscription,
  type AccountSettings,
  type SupportedLocale,
} from '../services/accountSettingsRepository'
import { useAuth } from '../state/AuthContext'
import { useClinic } from '../state/ClinicContext'
import { AppSelect } from '../components/AppSelect'
import { Button, ProgressBar } from '../components/ui'
import { useNativePlatform } from '../native/useNativePlatform'
import { usePwaInstall } from '../pwaInstall'

const previewStorageKey = 'clinic-preview-account-settings'
const productionEnabled = import.meta.env.VITE_REQUIRE_AUTH !== 'false'

interface PasswordChecks {
  length: boolean
  lowercase: boolean
  uppercase: boolean
  number: boolean
  symbol: boolean
}

function getPasswordChecks(password: string): PasswordChecks {
  return {
    length: password.length >= 12,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    number: /\d/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  }
}

export function SettingsPage() {
  const { t } = useTranslation()
  const auth = useAuth()
  const clinic = useClinic()
  const { isNative } = useNativePlatform()
  const pwaInstall = usePwaInstall()
  const [settings, setSettings] = useState<AccountSettings | null>(null)
  const [savedSettings, setSavedSettings] = useState<AccountSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settingsStatus, setSettingsStatus] = useState<string | null>(null)
  const [settingsError, setSettingsError] = useState<string | null>(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordStatus, setPasswordStatus] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setSettingsError(null)

    const load = async () => {
      if (productionEnabled && auth.membership) {
        return loadAccountSettings(
          auth.membership.organizationId,
          auth.membership.id,
        )
      }

      const stored = localStorage.getItem(previewStorageKey)
      const parsed = stored
        ? JSON.parse(stored) as Partial<AccountSettings>
        : {}
      const locations = clinic.locations.map((location) => ({
        id: location.id,
        name: location.name,
        shortName: location.shortName,
        timezone: location.timezone,
      }))
      return {
        locale: isSupportedLocale(parsed.locale)
          ? parsed.locale
          : isSupportedLocale(i18n.language)
            ? i18n.language
            : 'vi-VN',
        defaultLocationId:
          parsed.defaultLocationId
          ?? clinic.currentLocationId
          ?? locations[0]?.id
          ?? null,
        notificationsEnabled: parsed.notificationsEnabled ?? false,
        quietHoursStart: parsed.quietHoursStart ?? '',
        quietHoursEnd: parsed.quietHoursEnd ?? '',
        timezone:
          parsed.timezone
          ?? locations[0]?.timezone
          ?? 'Asia/Ho_Chi_Minh',
        locations,
      } satisfies AccountSettings
    }

    void load()
      .then((loaded) => {
        if (!active) return
        setSettings(loaded)
        setSavedSettings(loaded)
      })
      .catch((error: Error) => {
        if (active) setSettingsError(error.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [auth.membership, clinic.currentLocationId, clinic.locations])

  const dirty = useMemo(
    () => Boolean(
      settings
      && savedSettings
      && JSON.stringify(settings) !== JSON.stringify(savedSettings)
    ),
    [savedSettings, settings],
  )
  const passwordChecks = getPasswordChecks(newPassword)
  const strength = Object.values(passwordChecks).filter(Boolean).length * 20
  const passwordValid = (
    Object.values(passwordChecks).every(Boolean)
    && newPassword === confirmPassword
    && newPassword !== currentPassword
    && currentPassword.length > 0
  )

  const updateSettings = <Key extends keyof AccountSettings>(
    key: Key,
    value: AccountSettings[Key],
  ) => {
    setSettings((current) => current ? { ...current, [key]: value } : current)
    setSettingsStatus(null)
    setSettingsError(null)
  }

  const submitSettings = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!settings || !dirty) return
    if (
      Boolean(settings.quietHoursStart)
      !== Boolean(settings.quietHoursEnd)
    ) {
      setSettingsError(t('settings.quietHoursPair'))
      return
    }

    setSaving(true)
    setSettingsError(null)
    setSettingsStatus(null)
    try {
      if (productionEnabled && auth.membership) {
        if (
          settings.notificationsEnabled
          !== savedSettings?.notificationsEnabled
        ) {
          await syncPushSubscription(
            auth.membership.organizationId,
            auth.membership.id,
            settings.notificationsEnabled,
          )
        }
        await saveAccountSettings({
          ...settings,
          organizationId: auth.membership.organizationId,
          memberId: auth.membership.id,
        })
      } else {
        localStorage.setItem(previewStorageKey, JSON.stringify(settings))
        clinic.setCurrentLocationId(settings.defaultLocationId ?? 'all')
      }
      await i18n.changeLanguage(settings.locale)
      setSavedSettings(settings)
      setSettingsStatus(t('settings.saved'))
    } catch (error) {
      setSettingsError(
        error instanceof Error ? error.message : t('settings.saveFailed'),
      )
    } finally {
      setSaving(false)
    }
  }

  const submitPassword = async (event: React.FormEvent) => {
    event.preventDefault()
    setPasswordError(null)
    setPasswordStatus(null)
    if (!passwordValid) {
      setPasswordError(t('settings.passwordRequirementsError'))
      return
    }
    setPasswordSaving(true)
    try {
      await changePassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordStatus(t('settings.passwordChanged'))
    } catch (error) {
      setPasswordError(
        error instanceof Error ? error.message : t('settings.passwordFailed'),
      )
    } finally {
      setPasswordSaving(false)
    }
  }

  if (loading) {
    return <div className="route-loading" role="status">{t('common.loading')}</div>
  }
  if (!settings) {
    return (
      <div className="route-loading" role="alert">
        {settingsError ?? t('settings.loadFailed')}
      </div>
    )
  }

  return (
    <div className="settings-page page-scroll">
      <header className="settings-page__header">
        <span className="module-hero__icon"><SlidersHorizontal size={24} /></span>
        <div>
          <span>{t('settings.account')}</span>
          <h1>{t('nav.settings')}</h1>
          <p>{t('settings.description')}</p>
        </div>
      </header>

      <form className="settings-card" onSubmit={submitSettings}>
        <header>
          <Languages size={20} aria-hidden="true" />
          <div>
            <h2>{t('settings.preferences')}</h2>
            <p>{t('settings.preferencesHelp')}</p>
          </div>
        </header>

        <div className="settings-grid">
          <label htmlFor="settings-locale">
            <span>{t('auth.preferredLanguage')}</span>
            <AppSelect
              id="settings-locale"
              value={settings.locale}
              onValueChange={(value) => updateSettings(
                'locale',
                value as SupportedLocale,
              )}
              options={[
                { value: 'en-US', label: 'English' },
                { value: 'vi-VN', label: 'Tiếng Việt' },
              ]}
            />
          </label>
          <label htmlFor="settings-default-location">
            <span>{t('settings.defaultLocation')}</span>
            <AppSelect
              id="settings-default-location"
              value={settings.defaultLocationId ?? ''}
              onValueChange={(value) => {
                const location = settings.locations.find(
                  (item) => item.id === value,
                )
                setSettings((current) => current ? {
                  ...current,
                  defaultLocationId: value || null,
                  timezone: location?.timezone ?? current.timezone,
                } : current)
                setSettingsStatus(null)
              }}
              options={[
                { value: '', label: t('settings.noDefaultLocation') },
                ...settings.locations.map((location) => ({
                  value: location.id,
                  label: `${location.shortName} — ${location.name}`,
                })),
              ]}
            />
          </label>
          <label>
            <span>{t('auth.quietHoursStart')}</span>
            <input
              type="time"
              value={settings.quietHoursStart}
              onChange={(event) => updateSettings(
                'quietHoursStart',
                event.target.value,
              )}
            />
          </label>
          <label>
            <span>{t('auth.quietHoursEnd')}</span>
            <input
              type="time"
              value={settings.quietHoursEnd}
              onChange={(event) => updateSettings(
                'quietHoursEnd',
                event.target.value,
              )}
            />
          </label>
        </div>

        <label className="choice-row settings-card__choice">
          <input
            type="checkbox"
            checked={settings.notificationsEnabled}
            onChange={(event) => updateSettings(
              'notificationsEnabled',
              event.target.checked,
            )}
          />
          <span>{t('auth.notificationsPreference')}</span>
        </label>

        {settingsError ? <p className="form-error" role="alert">{settingsError}</p> : null}
        {settingsStatus ? <p className="success-banner" role="status">{settingsStatus}</p> : null}
        <Button
          type="submit"
          variant="primary"
          icon={<Save size={18} />}
          disabled={!dirty || saving}
        >
          {saving ? t('settings.saving') : t('common.save')}
        </Button>
      </form>

      {!isNative ? (
        <section className="settings-card">
          <header>
            <Download size={20} aria-hidden="true" />
            <div>
              <h2>{t('settings.installApp')}</h2>
              <p>{pwaInstall.installed
                ? t('settings.appInstalled')
                : t('settings.installHelp')}</p>
            </div>
          </header>
          {!pwaInstall.installed ? (
            <Button
              type="button"
              variant="primary"
              disabled={!pwaInstall.available}
              onClick={() => void pwaInstall.install()}
            >
              {pwaInstall.available
                ? t('settings.installApp')
                : t('settings.installUnavailable')}
            </Button>
          ) : null}
        </section>
      ) : null}

      {productionEnabled ? (
        <form className="settings-card" onSubmit={submitPassword}>
          <header>
            <KeyRound size={20} aria-hidden="true" />
            <div>
              <h2>{t('settings.changePassword')}</h2>
              <p>{t('settings.passwordHelp')}</p>
            </div>
          </header>
          <div className="settings-grid">
            <label>
              <span>{t('settings.currentPassword')}</span>
              <input
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
              />
            </label>
            <label>
              <span>{t('settings.newPassword')}</span>
              <input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                minLength={12}
                required
              />
            </label>
            <label>
              <span>{t('settings.confirmPassword')}</span>
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                minLength={12}
                required
              />
            </label>
          </div>
          <div className="password-strength" aria-live="polite">
            <div>
              <span>{t('settings.passwordStrength')}</span>
              <strong>{t(`settings.strength${strength}`)}</strong>
            </div>
            <ProgressBar
              value={strength}
              tone={strength < 80 ? 'warning' : 'primary'}
            />
            <ul>
              {Object.entries(passwordChecks).map(([key, passed]) => (
                <li className={passed ? 'is-passed' : ''} key={key}>
                  <Check size={15} aria-hidden="true" />
                  {t(`settings.passwordCheck.${key}`)}
                </li>
              ))}
              <li className={
                confirmPassword.length > 0 && newPassword === confirmPassword
                  ? 'is-passed'
                  : ''
              }>
                <Check size={15} aria-hidden="true" />
                {t('settings.passwordCheck.matches')}
              </li>
            </ul>
          </div>
          {passwordError ? <p className="form-error" role="alert">{passwordError}</p> : null}
          {passwordStatus ? <p className="success-banner" role="status">{passwordStatus}</p> : null}
          <Button
            type="submit"
            variant="primary"
            disabled={!passwordValid || passwordSaving}
          >
            {passwordSaving
              ? t('settings.changingPassword')
              : t('settings.changePassword')}
          </Button>
        </form>
      ) : null}
    </div>
  )
}

function isSupportedLocale(value: unknown): value is SupportedLocale {
  return value === 'en-US' || value === 'vi-VN'
}
