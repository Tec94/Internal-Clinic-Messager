import { RefreshCw, WifiOff, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button, IconButton } from './ui'

export function PwaStatus() {
  const { t } = useTranslation()
  const [online, setOnline] = useState(() => navigator.onLine)
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({ immediate: true })

  useEffect(() => {
    const markOnline = () => setOnline(true)
    const markOffline = () => setOnline(false)
    window.addEventListener('online', markOnline)
    window.addEventListener('offline', markOffline)
    return () => {
      window.removeEventListener('online', markOnline)
      window.removeEventListener('offline', markOffline)
    }
  }, [])

  return (
    <>
      {!online ? (
        <div className="connection-status" role="status">
          <WifiOff size={17} aria-hidden="true" />
          <span>{t('pwa.offline')}</span>
        </div>
      ) : null}
      {needRefresh ? (
        <div className="pwa-update" role="status">
          <RefreshCw size={18} aria-hidden="true" />
          <span>{t('pwa.updateReady')}</span>
          <Button
            variant="primary"
            onClick={() => void updateServiceWorker(true)}
          >
            {t('pwa.update')}
          </Button>
          <IconButton
            aria-label={t('common.close')}
            onClick={() => setNeedRefresh(false)}
          >
            <X size={18} />
          </IconButton>
        </div>
      ) : null}
    </>
  )
}
