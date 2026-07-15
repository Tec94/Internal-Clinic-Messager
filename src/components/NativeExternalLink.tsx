import type { AnchorHTMLAttributes, MouseEvent, PropsWithChildren } from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNativePlatform } from '../native/useNativePlatform'

interface NativeExternalLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href?: string
}

export function NativeExternalLink({
  children,
  href,
  onClick,
  rel = 'noreferrer',
  target = '_blank',
  ...props
}: PropsWithChildren<NativeExternalLinkProps>) {
  const { t } = useTranslation()
  const { isNative, openExternalUrl } = useNativePlatform()
  const [failed, setFailed] = useState(false)

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event)
    if (event.defaultPrevented) return
    if (!href) {
      event.preventDefault()
      return
    }
    if (!isNative) return

    event.preventDefault()
    setFailed(false)
    void openExternalUrl(href).catch(() => setFailed(true))
  }

  return (
    <>
      <a href={href} target={target} rel={rel} onClick={handleClick} {...props}>
        {children}
      </a>
      {failed ? <span className="sr-only" role="alert">{t('native.externalLinkFailed')}</span> : null}
    </>
  )
}
