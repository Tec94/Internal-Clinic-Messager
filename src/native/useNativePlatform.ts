import { useContext, useEffect, useRef } from 'react'
import {
  NativePlatformContext,
  type NativeBackHandler,
} from './nativePlatformContextValue'

export function useNativePlatform() {
  return useContext(NativePlatformContext)
}

export function useNativeBackHandler(active: boolean, handler: NativeBackHandler) {
  const { registerBackHandler } = useNativePlatform()
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    if (!active) return
    return registerBackHandler(() => handlerRef.current())
  }, [active, registerBackHandler])
}
