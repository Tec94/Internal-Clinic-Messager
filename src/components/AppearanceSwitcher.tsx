import { Palette } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAppearance } from '../state/AppearanceContext'
import type { ThemeId } from '../types/domain'

export function AppearanceSwitcher({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation()
  const { theme, setTheme } = useAppearance()
  const options: Array<{ id: ThemeId; short: string; full: string }> = [
    { id: 'mineral-petrol', short: t('appearance.mineral'), full: t('appearance.mineralFull') },
    { id: 'graphite-indigo', short: t('appearance.graphite'), full: t('appearance.graphiteFull') },
  ]
  return (
    <div className={`appearance-switcher ${compact ? 'appearance-switcher--compact' : ''}`} role="radiogroup" aria-label={t('appearance.label')}>
      <Palette size={17} aria-hidden="true" />
      {options.map((option) => <button key={option.id} type="button" role="radio" aria-checked={theme === option.id} aria-label={compact ? option.full : undefined} className={theme === option.id ? 'is-active' : ''} title={option.full} onClick={() => setTheme(option.id)}>{compact ? option.short.slice(0, 1) : option.short}</button>)}
    </div>
  )
}
