import {
  type PropsWithChildren,
  useLayoutEffect,
} from 'react'

const FIXED_THEME = 'graphite-indigo'

export function AppearanceProvider({ children }: PropsWithChildren) {
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = FIXED_THEME
    localStorage.setItem('clinic-theme', FIXED_THEME)
  }, [])

  return children
}
