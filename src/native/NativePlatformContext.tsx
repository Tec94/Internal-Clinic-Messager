import { App as CapacitorApp } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
import {
  type PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  NativePlatformContext,
  type NativeBackHandler,
} from './nativePlatformContextValue'

export function NativePlatformProvider({ children }: PropsWithChildren) {
  const isNative = Capacitor.isNativePlatform()
  const location = useLocation()
  const navigate = useNavigate()
  const backHandlers = useRef<NativeBackHandler[]>([])
  const currentPath = useRef(location.pathname)
  currentPath.current = location.pathname

  const registerBackHandler = useCallback((handler: NativeBackHandler) => {
    backHandlers.current.push(handler)
    return () => {
      const index = backHandlers.current.lastIndexOf(handler)
      if (index >= 0) backHandlers.current.splice(index, 1)
    }
  }, [])

  const openExternalUrl = useCallback(async (url: string) => {
    if (!isNative) {
      window.open(url, '_blank', 'noopener,noreferrer')
      return
    }
    await Browser.open({ url })
  }, [isNative])

  useEffect(() => {
    if (!isNative) return

    document.documentElement.dataset.nativePlatform = Capacitor.getPlatform()
    void StatusBar.setOverlaysWebView({ overlay: false })
    void StatusBar.setStyle({ style: Style.Dark })
    if (Capacitor.getPlatform() === 'android') {
      void StatusBar.setBackgroundColor({ color: '#f4f4f8' })
    }

    const listener = CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      const handler = backHandlers.current.at(-1)
      if (handler?.()) return
      if (canGoBack) {
        window.history.back()
        return
      }
      if (currentPath.current !== '/' && currentPath.current !== '/inbox') {
        navigate('/inbox')
        return
      }
      void CapacitorApp.minimizeApp()
    })

    return () => {
      delete document.documentElement.dataset.nativePlatform
      void listener.then((handle) => handle.remove())
    }
  }, [isNative, navigate])

  const value = useMemo(() => ({
    isNative,
    openExternalUrl,
    registerBackHandler,
  }), [isNative, openExternalUrl, registerBackHandler])

  return (
    <NativePlatformContext.Provider value={value}>
      {children}
    </NativePlatformContext.Provider>
  )
}
