import { useTranslation } from 'react-i18next'
import { NativeExternalLink } from './NativeExternalLink'

const ZALO_WEB_CHAT_URL = 'https://chat.zalo.me/'

export function ZaloPersonalLauncher() {
  const { t } = useTranslation()

  return (
    <section className="zalo-widget-shell" aria-label={t('zaloLauncher.landmark')}>
      <NativeExternalLink
        href={ZALO_WEB_CHAT_URL}
        className="zalo-widget-trigger"
        aria-label={t('zaloLauncher.open')}
      >
        <span className="zalo-wordmark" aria-hidden="true">Zalo</span>
      </NativeExternalLink>
    </section>
  )
}
