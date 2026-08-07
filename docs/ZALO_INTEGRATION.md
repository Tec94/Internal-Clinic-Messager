# Zalo integration

Zalo is accessed from a sidebar control that opens the employee's personal
Zalo inbox in a **managed side-panel popup** instead of navigating away from
the workspace. Clicking the control again re-focuses the existing panel, so
employees keep their place in YKSG while chatting with colleagues on Zalo.

## Decision

Zalo exposes no official API for personal inboxes, and its login page
deliberately withholds the sign-in UI when framed (verified 2026-08: the
`id.zalo.me` login renders an empty body inside an iframe while the same URL
renders the full QR login at the top level). Embedding the personal inbox is
therefore impossible through any legitimate channel. The managed panel is the
closest supported experience:

1. The sidebar rail shows a `Zalo` button (and the mobile More sheet exposes
   the same control) when Zalo is enabled.
2. `openOrFocusZaloPanel()` opens `https://chat.zalo.me/` in a named popup
   (`yksg-zalo-panel`). A second click focuses the existing window instead of
   opening a new one.
3. On open, `tileWithMainWindow()` resizes the workspace and the panel side
   by side so they fill the screen like one composite view; `syncZaloPanelDock()`
   re-attaches the panel flush against the workspace's right edge whenever the
   workspace is resized. Because the windows never overlap, focusing the
   workspace no longer hides the panel.
4. The rail button shows an active state while the panel window is open and
   announces a localized message if the browser blocks pop-ups.
5. On Capacitor builds the same control opens Zalo through the in-app
   browser, which shares the system browser's retained Zalo session.

Docking is best-effort: browsers may refuse `moveTo`/`resizeTo` (for example
when the window is maximized or the user disabled script window placement),
and the panel degrades to a normal independent popup in that case.

## Session persistence

Zalo owns the login and session cookie inside the browser profile. An
employee who signs in once stays signed in across days, shifts, and YKSG
logouts on that device/profile until they sign out of Zalo. YKSG never
requests, stores, or proxies a Zalo password, token, contact, or message —
persistence comes from the browser profile, not from the YKSG database.

## Capability review

| Product | Result for the personal inbox |
| --- | --- |
| Zalo Web Chat (`chat.zalo.me`) | Usable only in a Zalo-controlled window. Login UI is withheld inside iframes. Used by the managed panel. |
| Zalo Chat Widget (Social Plugins) | Embeds a conversation with one configured Official Account only — not colleague chats. Rejected for this requirement. |
| Zalo Social API / SDKs | Profile, friends, and share actions. No personal chat reader. |
| Zalo Official Account API | OA-to-user messaging and OA conversation reads. Not a personal inbox. |
| Zalo Mini App | Runs YKSG inside the Zalo mobile app. Candidate follow-up; still no personal-inbox API. |

## Security and privacy requirements

- Use only the official `https://chat.zalo.me/` origin.
- Open the panel from a direct user gesture (`window.open` inside the click
  handler) so pop-up blockers treat it as user-initiated.
- Do not add Zalo credentials, tokens, contacts, or messages to browser
  storage, Supabase, logs, or analytics.
- Do not add a hidden iframe, DOM scraper, browser extension, or reverse
  engineered personal-chat API.
- Label the control as personal Zalo messages in English and Vietnamese.

## Acceptance checks

- The sidebar shows the Zalo control, and clicking it opens the named panel
  window beside the workspace.
- Clicking again focuses the existing panel instead of opening a duplicate.
- Closing the panel returns the control to its inactive state.
- A blocked pop-up surfaces the localized guidance message.
- The mobile More sheet exposes the same control.
- Signing out of YKSG does not sign the user out of Zalo, and the Zalo
  session survives closing and reopening YKSG on the same device.
