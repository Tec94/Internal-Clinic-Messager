import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { type ReactNode, useState } from 'react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NativeExternalLink } from '../components/NativeExternalLink'
import {
  NativePlatformProvider,
} from '../native/NativePlatformContext'
import { useNativeBackHandler } from '../native/useNativePlatform'

const nativeMocks = vi.hoisted(() => ({
  addListener: vi.fn(),
  browserOpen: vi.fn(),
  minimizeApp: vi.fn(),
  removeListener: vi.fn(),
  setBackgroundColor: vi.fn(),
  setOverlaysWebView: vi.fn(),
  setStyle: vi.fn(),
  isNative: true,
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: () => 'android',
    isNativePlatform: () => nativeMocks.isNative,
  },
}))

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: nativeMocks.addListener,
    minimizeApp: nativeMocks.minimizeApp,
  },
}))

vi.mock('@capacitor/browser', () => ({
  Browser: { open: nativeMocks.browserOpen },
}))

vi.mock('@capacitor/status-bar', () => ({
  StatusBar: {
    setBackgroundColor: nativeMocks.setBackgroundColor,
    setOverlaysWebView: nativeMocks.setOverlaysWebView,
    setStyle: nativeMocks.setStyle,
  },
  Style: { Dark: 'DARK' },
}))

type BackButtonListener = (event: { canGoBack: boolean }) => void

function BackHandlerProbe({ calls }: { calls: string[] }) {
  const [sheetOpen, setSheetOpen] = useState(true)
  useNativeBackHandler(true, () => {
    calls.push('workspace')
    return true
  })
  useNativeBackHandler(sheetOpen, () => {
    calls.push('sheet')
    setSheetOpen(false)
    return true
  })
  return <span>{sheetOpen ? 'sheet open' : 'sheet closed'}</span>
}

function LocationProbe() {
  return <span>{useLocation().pathname}</span>
}

function renderBridge(children: ReactNode, initialEntries = ['/inbox']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <NativePlatformProvider>{children}</NativePlatformProvider>
    </MemoryRouter>,
  )
}

describe('native platform bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    nativeMocks.isNative = true
  })

  it('opens external links with the native browser', async () => {
    nativeMocks.addListener.mockResolvedValue({ remove: nativeMocks.removeListener })
    nativeMocks.browserOpen.mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderBridge(<NativeExternalLink href="https://meet.google.com/test-room">Join meeting</NativeExternalLink>)

    await user.click(screen.getByRole('link', { name: 'Join meeting' }))

    await waitFor(() => expect(nativeMocks.browserOpen).toHaveBeenCalledWith({ url: 'https://meet.google.com/test-room' }))
  })

  it('preserves a normal anchor on the web', async () => {
    nativeMocks.isNative = false
    const user = userEvent.setup()
    renderBridge(<NativeExternalLink href="https://developers.zalo.me/docs">Zalo documentation</NativeExternalLink>)

    const link = screen.getByRole('link', { name: 'Zalo documentation' })
    expect(link).toHaveAttribute('href', 'https://developers.zalo.me/docs')
    expect(link).toHaveAttribute('target', '_blank')
    await user.click(link)
    expect(nativeMocks.browserOpen).not.toHaveBeenCalled()
  })

  it('closes registered surfaces in LIFO order before root navigation', async () => {
    let backButtonListener: BackButtonListener | undefined
    nativeMocks.addListener.mockImplementation(async (_event: string, listener: BackButtonListener) => {
      backButtonListener = listener
      return { remove: nativeMocks.removeListener }
    })
    const calls: string[] = []
    renderBridge(<BackHandlerProbe calls={calls} />)
    await waitFor(() => expect(backButtonListener).toBeDefined())

    act(() => backButtonListener?.({ canGoBack: false }))
    expect(calls).toEqual(['sheet'])
    await screen.findByText('sheet closed')

    act(() => backButtonListener?.({ canGoBack: false }))
    expect(calls).toEqual(['sheet', 'workspace'])
    expect(nativeMocks.minimizeApp).not.toHaveBeenCalled()
  })

  it('uses browser history before the root fallback', async () => {
    let backButtonListener: BackButtonListener | undefined
    nativeMocks.addListener.mockImplementation(async (_event: string, listener: BackButtonListener) => {
      backButtonListener = listener
      return { remove: nativeMocks.removeListener }
    })
    const historyBack = vi.spyOn(window.history, 'back').mockImplementation(() => undefined)
    renderBridge(<LocationProbe />, ['/tasks'])
    await waitFor(() => expect(backButtonListener).toBeDefined())

    act(() => backButtonListener?.({ canGoBack: true }))

    expect(historyBack).toHaveBeenCalledOnce()
    expect(nativeMocks.minimizeApp).not.toHaveBeenCalled()
    historyBack.mockRestore()
  })

  it('returns a deep-linked native route to Inbox before minimizing', async () => {
    let backButtonListener: BackButtonListener | undefined
    nativeMocks.addListener.mockImplementation(async (_event: string, listener: BackButtonListener) => {
      backButtonListener = listener
      return { remove: nativeMocks.removeListener }
    })
    renderBridge(<LocationProbe />, ['/tasks'])
    await waitFor(() => expect(backButtonListener).toBeDefined())

    act(() => backButtonListener?.({ canGoBack: false }))

    await screen.findByText('/inbox')
    expect(nativeMocks.minimizeApp).not.toHaveBeenCalled()
  })

  it('minimizes Android from the root when no surface handles Back', async () => {
    let backButtonListener: BackButtonListener | undefined
    nativeMocks.addListener.mockImplementation(async (_event: string, listener: BackButtonListener) => {
      backButtonListener = listener
      return { remove: nativeMocks.removeListener }
    })
    renderBridge(<span>Native app</span>)
    await waitFor(() => expect(backButtonListener).toBeDefined())

    act(() => backButtonListener?.({ canGoBack: false }))

    expect(nativeMocks.minimizeApp).toHaveBeenCalledOnce()
  })
})
