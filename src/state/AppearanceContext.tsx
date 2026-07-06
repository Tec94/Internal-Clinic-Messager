import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from 'react'
import type { ThemeId } from '../types/domain'

interface AppearanceContextValue {
  theme: ThemeId
  setTheme: (theme: ThemeId) => void
}

const AppearanceContext = createContext<AppearanceContextValue | null>(null)

function getInitialTheme(): ThemeId {
  const saved = localStorage.getItem('clinic-theme')
  return saved === 'graphite-indigo' ? saved : 'mineral-petrol'
}

export function AppearanceProvider({ children }: PropsWithChildren) {
  const [theme, setTheme] = useState<ThemeId>(getInitialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('clinic-theme', theme)
  }, [theme])

  return (
    <AppearanceContext.Provider value={{ theme, setTheme }}>
      {children}
    </AppearanceContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAppearance() {
  const context = useContext(AppearanceContext)
  if (!context) throw new Error('useAppearance must be used inside AppearanceProvider')
  return context
}
