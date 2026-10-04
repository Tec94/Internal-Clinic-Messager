// Managed Zalo panel.
//
// Zalo exposes no personal-inbox API and blocks its login UI inside iframes,
// so the personal inbox cannot be embedded. Instead, Zalo Web Chat opens in a
// named, sized popup that behaves like a side panel: clicking again re-focuses
// the existing window instead of opening a new one. The Zalo session persists
// in the browser profile until the user signs out of Zalo — retained across
// days and YKSG logouts, tied to the device profile, with no credentials
// stored by YKSG.
//
// The returned window is cross-origin. We only ever read `.closed` and call
// `.focus()` / `.close()` — never Zalo credentials, cookies, or messages.

const ZALO_CHAT_URL = 'https://chat.zalo.me/'
const PANEL_NAME = 'yksg-zalo-panel'
const PANEL_WIDTH = 440
const DOCK_GAP = 4

let panelWindow: Window | null = null

export function isZaloPanelOpen(): boolean {
  return Boolean(panelWindow && !panelWindow.closed)
}

export type ZaloPanelStatus = 'opened' | 'focused' | 'blocked'

// Tile the main window and the Zalo panel side by side so they read as one
// composite screen: the workspace on the left, the personal inbox docked on
// the right. Because they never overlap, focusing the workspace no longer
// hides the Zalo panel.
function screenMetrics() {
  const screen = window.screen as Screen & { availLeft?: number; availTop?: number }
  return {
    availW: screen.availWidth || screen.width,
    availH: screen.availHeight || screen.height,
    originX: screen.availLeft ?? 0,
    originY: screen.availTop ?? 0,
  }
}

function tileWithMainWindow(win: Window): void {
  try {
    const { availW, availH, originX, originY } = screenMetrics()
    const panelW = Math.min(460, Math.max(380, Math.round(availW * 0.32)))
    const mainW = Math.max(640, availW - panelW - DOCK_GAP)
    window.moveTo?.(originX, originY)
    window.resizeTo?.(mainW, availH)
    // If the browser ignored the resize (for example a maximized window),
    // docking would push the panel off-screen, so leave it where it opened.
    if (window.outerWidth > mainW + 80) return
    win.moveTo?.(originX + mainW + DOCK_GAP, originY)
    win.resizeTo?.(panelW, availH)
  } catch {
    // Window placement is best-effort; never block the panel itself.
  }
}

// Re-attach the panel flush against the main window's right edge after the
// main window resizes, keeping the two windows docked. Clamped so the panel
// can never be placed off-screen.
export function syncZaloPanelDock(): void {
  if (!isZaloPanelOpen() || !panelWindow) return
  try {
    const { availW, availH, originX } = screenMetrics()
    const panelW = panelWindow.outerWidth || PANEL_WIDTH
    const rawX = window.screenX + window.outerWidth + DOCK_GAP
    const targetX = Math.min(rawX, originX + availW - panelW)
    if (targetX < window.screenX + 240) return // would overlap too much
    panelWindow.moveTo?.(targetX, window.screenY)
    panelWindow.resizeTo?.(panelW, window.outerHeight || availH)
  } catch {
    // The popup may have just closed; the interval sync will clear the state.
  }
}

export function openOrFocusZaloPanel(): ZaloPanelStatus {
  if (isZaloPanelOpen()) {
    panelWindow?.focus()
    syncZaloPanelDock()
    return 'focused'
  }

  const height = Math.max(480, Math.min(760, window.screen.availHeight - 48))
  const left = Math.max(0, window.screen.availWidth - PANEL_WIDTH - 16)
  const top = Math.max(0, Math.round((window.screen.availHeight - height) / 2))
  const features = [
    `width=${PANEL_WIDTH}`,
    `height=${height}`,
    `left=${left}`,
    `top=${top}`,
    'menubar=no',
    'toolbar=no',
    'location=no',
    'status=no',
    'scrollbars=yes',
    'resizable=yes',
  ].join(',')

  // Reusing the named window means a later click re-focuses the existing
  // panel even if this page lost its JS reference (for example after a
  // reload), instead of spawning a duplicate window.
  const win = window.open(ZALO_CHAT_URL, PANEL_NAME, features)
  if (!win || win.closed) return 'blocked'
  panelWindow = win
  tileWithMainWindow(win)
  win.focus()
  return 'opened'
}

export function closeZaloPanel(): void {
  if (isZaloPanelOpen()) panelWindow?.close()
  panelWindow = null
}
