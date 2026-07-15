import { Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n'

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation()
  const locale = i18n.language
  return (
    <div className={`language-switcher ${compact ? 'language-switcher--compact' : ''}`} aria-label={t('common.language')}>
      <Languages size={17} aria-hidden="true" />
      <button className={locale === 'en-US' ? 'is-active' : ''} onClick={() => void i18n.changeLanguage('en-US')} aria-pressed={locale === 'en-US'}>EN</button>
      <button className={locale === 'vi-VN' ? 'is-active' : ''} onClick={() => void i18n.changeLanguage('vi-VN')} aria-pressed={locale === 'vi-VN'}>VI</button>
    </div>
  )
}
