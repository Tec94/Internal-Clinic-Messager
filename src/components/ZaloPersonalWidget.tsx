import { ExternalLink, MessageCircleMore, ShieldCheck, X } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useClinic } from '../state/ClinicContext'
import { useNativeBackHandler } from '../native/useNativePlatform'
import { NativeExternalLink } from './NativeExternalLink'

declare global {
  interface Window {
    ZaloSocialSDK?: {
      reload?: () => void
    }
  }
}

const ZALO_SDK_URL = 'https://sp.zalo.me/plugins/sdk.js'
const ZALO_CHAT_DOCS_URL = 'https://developers.zalo.me/docs/social/zalo-chat-widget'

/**
 * Keeps the third-party Zalo surface separate from the clinic's operational
 * messaging. The supported Zalo widget is only mounted after an OA ID is set.
 */
export function ZaloPersonalWidget() {
  const oaId = import.meta.env.VITE_ZALO_OA_ID?.trim()
  const welcomeMessage = import.meta.env.VITE_ZALO_WELCOME_MESSAGE?.trim()
  const [scriptError, setScriptError] = useState(false)

  useEffect(() => {
    if (!oaId) return

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[data-zalo-social-sdk="true"]',
    )
    const reload = () => window.ZaloSocialSDK?.reload?.()

    if (existingScript) {
      if (window.ZaloSocialSDK) reload()
      else existingScript.addEventListener('load', reload, { once: true })
      return () => existingScript.removeEventListener('load', reload)
    }

    const script = document.createElement('script')
    script.src = ZALO_SDK_URL
    script.async = true
    script.dataset.zaloSocialSdk = 'true'
    script.addEventListener('load', reload, { once: true })
    script.addEventListener('error', () => setScriptError(true), { once: true })
    document.head.append(script)

    return () => script.removeEventListener('load', reload)
  }, [oaId])

  if (oaId && !scriptError) {
    return (
      <div
        className="zalo-chat-widget"
        data-oaid={oaId}
        data-welcome-message={welcomeMessage || undefined}
        data-autopopup="0"
        data-width="360"
        data-height="520"
      />
    )
  }

  return <ZaloWidgetFallback scriptError={scriptError} />
}

function ZaloWidgetFallback({ scriptError }: { scriptError: boolean }) {
  const { t } = useTranslation()
  const { currentUser } = useClinic()
  const [open, setOpen] = useState(false)
  const panelTitleId = useId()

  useNativeBackHandler(open, () => {
    setOpen(false)
    return true
  })

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  return (
    <section className="zalo-widget-shell" aria-label={t('zaloWidget.landmark')}>
      {open ? (
        <section
          className="zalo-widget-panel"
          aria-labelledby={panelTitleId}
          aria-modal="false"
          role="dialog"
        >
          <header className="zalo-widget-panel__header">
            <div className="zalo-widget-panel__identity">
              <span className="zalo-wordmark" aria-hidden="true">Zalo</span>
              <span>
                <strong>{t('zaloWidget.personalMessages')}</strong>
                <small>{currentUser.name}</small>
              </span>
            </div>
            <button
              className="zalo-widget-close"
              onClick={() => setOpen(false)}
              type="button"
              aria-label={t('zaloWidget.close')}
            >
              <X size={19} aria-hidden="true" />
            </button>
          </header>

          <div className="zalo-widget-panel__content">
            <MessageCircleMore size={32} aria-hidden="true" />
            <h2 id={panelTitleId}>{t('zaloWidget.connectTitle')}</h2>
            <p>{scriptError ? t('zaloWidget.loadError') : t('zaloWidget.connectBody')}</p>
            <dl className="zalo-widget-scope">
              <div>
                <dt><ShieldCheck size={16} aria-hidden="true" />{t('zaloWidget.availableLabel')}</dt>
                <dd>{t('zaloWidget.availableBody')}</dd>
              </div>
              <div>
                <dt>{t('zaloWidget.privateLabel')}</dt>
                <dd>{t('zaloWidget.privateBody')}</dd>
              </div>
            </dl>
          </div>

          <footer className="zalo-widget-panel__footer">
            <NativeExternalLink href={ZALO_CHAT_DOCS_URL}>
              {t('zaloWidget.openSetup')}
              <ExternalLink size={15} aria-hidden="true" />
            </NativeExternalLink>
          </footer>
        </section>
      ) : null}

      <button
        className="zalo-widget-trigger"
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={t('zaloWidget.open')}
      >
        <span className="zalo-wordmark" aria-hidden="true">Zalo</span>
        <span className="zalo-widget-trigger__status" aria-hidden="true" />
      </button>
    </section>
  )
}
