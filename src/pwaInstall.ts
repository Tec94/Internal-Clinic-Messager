import { useSyncExternalStore } from 'react'

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let promptEvent: InstallPromptEvent | null = null
const listeners = new Set<() => void>()

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    promptEvent = event as InstallPromptEvent
    emit()
  })
  window.addEventListener('appinstalled', () => {
    promptEvent = null
    emit()
  })
}

export function usePwaInstall() {
  const available = useSyncExternalStore(
    subscribe,
    () => promptEvent !== null,
    () => false,
  )
  return {
    available,
    installed: isInstalled(),
    install: async () => {
      if (!promptEvent) return false
      const event = promptEvent
      await event.prompt()
      const choice = await event.userChoice
      if (choice.outcome === 'accepted') {
        promptEvent = null
        emit()
        return true
      }
      return false
    },
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function emit() {
  for (const listener of listeners) listener()
}

function isInstalled() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches
    || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
}
