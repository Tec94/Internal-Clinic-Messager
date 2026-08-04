import { CircleAlert, ClipboardCheck, KeyRound } from 'lucide-react'
import { type FormEvent, type PropsWithChildren, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import { AppSelect } from '../components/AppSelect'
import { Button } from '../components/ui'
import { useAuth } from '../state/AuthContext'
import { supabase } from '../utils/supabase'

interface ReturnLocation {
  from?: {
    pathname?: string
  }
}

function returnPath(state: unknown) {
  return (state as ReturnLocation | null)?.from?.pathname ?? '/inbox'
}

export function LoginPage() {
  const { t } = useTranslation()
  const { session, status, signIn } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const destination = returnPath(location.state)

  useEffect(() => {
    if (!session || status === 'loading') return
    navigate(authDestination(status, destination), {
      replace: true,
      state: { from: { pathname: destination } },
    })
  }, [destination, navigate, session, status])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    const message = await signIn(email.trim(), password)
    setSubmitting(false)
    if (message) setError(message)
  }

  return (
    <AuthFrame>
      <div className="auth-card__icon"><KeyRound aria-hidden="true" /></div>
      <h1>{t('auth.signIn')}</h1>
      <p>{t('auth.invitationOnly')}</p>
      <form className="auth-form" onSubmit={submit}>
        <label>
          {t('auth.email')}
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label>
          {t('auth.password')}
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error ? <p className="auth-error" role="alert">{error}</p> : null}
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? t('auth.signingIn') : t('auth.signIn')}
        </Button>
      </form>
    </AuthFrame>
  )
}

export function AuthCallbackPage() {
  const { t } = useTranslation()
  const { status } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (status === 'signedOut') navigate('/login', { replace: true })
    if (!['loading', 'signedOut'].includes(status)) {
      navigate(authDestination(status, '/inbox'), { replace: true })
    }
  }, [navigate, status])

  return <AuthFrame><p role="status">{t('auth.finishingSignIn')}</p></AuthFrame>
}

export function OnboardingPage() {
  const { t, i18n } = useTranslation()
  const { status, membership, refreshAccess, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const destination = returnPath(location.state)
  const [fullName, setFullName] = useState('')
  const [locale, setLocale] = useState(
    i18n.language.startsWith('vi') ? 'vi-VN' : 'en-US',
  )
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false)
  const [quietHoursStart, setQuietHoursStart] = useState('22:00')
  const [quietHoursEnd, setQuietHoursEnd] = useState('06:00')
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const [policyAccepted, setPolicyAccepted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (status === 'loading' || status === 'onboarding') return
    navigate(authDestination(status, destination), { replace: true })
  }, [destination, navigate, status])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!membership || !policyAccepted) return

    setSubmitting(true)
    setError('')
    const { error: onboardingError } = await supabase.rpc(
      'complete_staff_onboarding',
      {
        target_member_id: membership.id,
        target_full_name: fullName,
        target_locale: locale,
        target_quiet_hours_start: quietHoursEnabled ? quietHoursStart : null,
        target_quiet_hours_end: quietHoursEnabled ? quietHoursEnd : null,
        target_notifications_enabled: notificationsEnabled,
      },
    )
    if (onboardingError) {
      setSubmitting(false)
      setError(onboardingError.message)
      return
    }

    const accessError = await refreshAccess()
    setSubmitting(false)
    if (accessError) setError(accessError)
  }

  return (
    <AuthFrame>
      <div className="auth-card__icon"><ClipboardCheck aria-hidden="true" /></div>
      <h1>{t('auth.onboardingTitle')}</h1>
      <p>{t('auth.onboardingHelp')}</p>
      <form className="auth-form" onSubmit={submit}>
        <label>
          {t('auth.fullName')}
          <input
            autoComplete="name"
            minLength={2}
            maxLength={120}
            required
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
          />
        </label>
        <label htmlFor="onboarding-locale">
          {t('auth.preferredLanguage')}
          <AppSelect
            id="onboarding-locale"
            value={locale}
            onValueChange={setLocale}
            options={[
              { value: 'vi-VN', label: t('locale.vietnamese') },
              { value: 'en-US', label: t('locale.english') },
            ]}
          />
        </label>
        <label className="auth-check">
          <input
            type="checkbox"
            checked={quietHoursEnabled}
            onChange={(event) => setQuietHoursEnabled(event.target.checked)}
          />
          <span>{t('auth.quietHours')}</span>
        </label>
        {quietHoursEnabled ? (
          <div className="auth-time-range">
            <label>
              {t('auth.quietHoursStart')}
              <input
                type="time"
                required
                value={quietHoursStart}
                onChange={(event) => setQuietHoursStart(event.target.value)}
              />
            </label>
            <label>
              {t('auth.quietHoursEnd')}
              <input
                type="time"
                required
                value={quietHoursEnd}
                onChange={(event) => setQuietHoursEnd(event.target.value)}
              />
            </label>
          </div>
        ) : null}
        <label className="auth-check">
          <input
            type="checkbox"
            checked={notificationsEnabled}
            onChange={(event) => setNotificationsEnabled(event.target.checked)}
          />
          <span>{t('auth.notificationsPreference')}</span>
        </label>
        <label className="auth-check auth-policy-check">
          <input
            type="checkbox"
            required
            checked={policyAccepted}
            onChange={(event) => setPolicyAccepted(event.target.checked)}
          />
          <span>{t('auth.policyAcceptance')}</span>
        </label>
        {error ? <p className="auth-error" role="alert">{error}</p> : null}
        <Button
          type="submit"
          variant="primary"
          disabled={submitting || !membership}
        >
          {submitting ? t('auth.completingOnboarding') : t('auth.completeOnboarding')}
        </Button>
      </form>
      <Button onClick={() => void signOut()}>{t('auth.signOut')}</Button>
    </AuthFrame>
  )
}

export function AccessStatusPage({
  status: expectedStatus,
}: {
  status: 'suspended' | 'expired'
}) {
  const { t } = useTranslation()
  const { status, refreshAccess, signOut } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (status === 'loading' || status === expectedStatus) return
    navigate(authDestination(status, '/inbox'), { replace: true })
  }, [expectedStatus, navigate, status])

  return (
    <AuthFrame>
      <div className="auth-card__icon"><CircleAlert aria-hidden="true" /></div>
      <h1>{t(`auth.${expectedStatus}Title`)}</h1>
      <p>{t(`auth.${expectedStatus}Help`)}</p>
      <Button variant="primary" onClick={() => void refreshAccess()}>
        {t('common.retry')}
      </Button>
      <Button onClick={() => void signOut()}>{t('auth.signOut')}</Button>
    </AuthFrame>
  )
}

export function AccessErrorPage() {
  const { t } = useTranslation()
  const { status, retryAuthorization, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const destination = returnPath(location.state)

  useEffect(() => {
    if (status === 'loading' || status === 'error') return
    navigate(authDestination(status, destination), { replace: true })
  }, [destination, navigate, status])

  return (
    <AuthFrame>
      <div className="auth-card__icon"><CircleAlert aria-hidden="true" /></div>
      <h1>{t('auth.accessErrorTitle')}</h1>
      <p>{t('auth.accessErrorHelp')}</p>
      <Button variant="primary" onClick={retryAuthorization}>
        {t('common.retry')}
      </Button>
      <Button onClick={() => void signOut()}>{t('auth.signOut')}</Button>
    </AuthFrame>
  )
}

function authDestination(status: string, activeDestination: string) {
  switch (status) {
    case 'active':
      return activeDestination
    case 'onboarding':
      return '/onboarding'
    case 'suspended':
      return '/access/suspended'
    case 'expired':
      return '/access/expired'
    case 'error':
      return '/auth/error'
    default:
      return '/login'
  }
}

function AuthFrame({ children }: PropsWithChildren) {
  const { t } = useTranslation()
  return (
    <main className="auth-page">
      <section className="auth-card" aria-label={t('auth.staffAccess')}>
        <header className="auth-card__header">
          <span className="auth-brand">YKSG</span>
        </header>
        {children}
        <small>{t('auth.operationalOnly')}</small>
      </section>
    </main>
  )
}
