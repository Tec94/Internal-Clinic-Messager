import { createContext } from 'react'

export type NativeBackHandler = () => boolean

export interface NativePlatformContextValue {
  isNative: boolean
  openExternalUrl: (url: string) => Promise<void>
  registerBackHandler: (handler: NativeBackHandler) => () => void
}

export const NativePlatformContext = createContext<NativePlatformContextValue>({
  isNative: false,
  openExternalUrl: async (url) => {
    window.open(url, '_blank', 'noopener,noreferrer')
  },
  registerBackHandler: () => () => undefined,
})
