# Zalo personal chat integration

The application must open a user's existing Zalo chats in a Zalo-controlled
window. It must not import, proxy, or store a personal Zalo inbox. The current
Zalo developer products do not provide an API that reads a personal user's
chat list or message history.

## Decision

Use the bottom-right Zalo control as an external personal chat launcher:

1. Open [Zalo Web Chat](https://chat.zalo.me/) in a separate window.
2. Let Zalo request sign-in on the first use.
3. Let Zalo retain and restore its own trusted browser session.
4. Keep YKSG open in the original window.

On a Capacitor build, use the existing Capacitor Browser boundary. On the web,
use a new browser window with a separate opener context. Do not put Zalo in an
iframe or an application WebView.

The YKSG application must not request or store a Zalo password. It also must
not store a Zalo access token, refresh token, contact list, chat list, or
message. Zalo owns the login and session cookie.

## Capability review

The review covered the complete product catalog in the
[Zalo developer documentation](https://developers.zalo.me/docs/): Official
Account, ZBS Template Message, Social API, iOS and Android SDKs, and Social
Plugins. The following table shows the result for this use case.

| Product | Supported use | Personal inbox result |
| --- | --- | --- |
| Zalo Social | Sign in with Zalo and read the permitted user profile. | It does not return a personal chat list or chat history. |
| iOS and Android SDKs | Sign in, read permitted profile or friend data, and open supported share or send actions. | They do not provide a personal inbox reader. |
| Zalo Official Account API | Let an Official Account communicate with users and read OA conversations. | It reads OA conversations, not an employee's personal inbox. |
| Group Management Framework | Create and manage groups that an Official Account controls. | It does not import an employee's existing personal groups. |
| ZBS Template Message | Send approved business templates by phone number or UID. | It is not a personal chat or history API. |
| Social Chat Widget | Embed a conversation with one configured Official Account. | It cannot display personal contacts or personal chats. |
| Share tools | Let a user share a link to friends, groups, or a timeline. | They open a share flow but do not return existing chats. |

Relevant official references include the
[Zalo Social user profile API](https://developers.zalo.me/docs/social-api/tai-lieu/thong-tin-ten-anh-dai-dien),
[Android sign-in](https://developers.zalo.me/docs/sdk/android-sdk/dang-nhap),
[iOS sign-in](https://developers.zalo.me/docs/sdk/ios-sdk/dang-nhap),
[Android friend list](https://developers.zalo.me/docs/sdk/android-sdk/open-api/lay-danh-sach-ban-be-zalo),
[Android send action](https://developers.zalo.me/docs/sdk/android-sdk/tuong-tac-voi-app-zalo/gui-tin-nhan-cho-ban-be),
[Official Account messaging](https://developers.zalo.me/docs/official-account/tin-nhan),
[Official Account groups](https://developers.zalo.me/docs/official-account/nhom-chat-gmf/general),
[ZBS Template Message](https://developers.zalo.me/docs/zbs-template-message/bat-dau/gioi-thieu-zbs-template-message),
[Zalo share](https://developers.zalo.me/docs/social/share), and the
[Official Account Chat Widget](https://developers.zalo.me/docs/social/zalo-chat-widget).

## Login and session behavior

Zalo Web Chat redirects a signed-out user to Zalo's own login page. The page
asks the user to sign in with the Zalo mobile application and a QR code. A
later launch can reuse the Zalo session for that browser profile.

This flow gives employees access to the chats that Zalo already holds. It also
keeps the two products separate. A user can close the Zalo window and continue
work in YKSG without a data transfer between them.

YKSG cannot promise that Zalo will always retain a session. Zalo can request a
new sign-in after logout, cookie removal, session expiry, device policy, or a
security check.

## Official Account option

A clinic Official Account can support a separate migration channel, but it
cannot meet the personal inbox requirement. If the clinic later uses an
Official Account, give it a separate label and a separate feature flag. Do not
call it a personal Zalo inbox.

The Official Account option can provide a clinic help channel, approved
business notifications, or a controlled group that the Official Account owns.
It must not copy patient information or internal operational messages between
Zalo and YKSG.

## Security and privacy requirements

The launcher must keep these controls:

- Use only the official `https://chat.zalo.me/` origin.
- Open the web page in a separate window with `noopener noreferrer`.
- Use the existing Capacitor Browser service on native builds.
- Do not add Zalo credentials or tokens to browser storage, Supabase, logs, or
  analytics.
- Do not add a hidden iframe, DOM scraper, browser extension, or reverse
  engineered personal-chat API.
- Do not send draft text, attachments, patient information, or clinic message
  content to Zalo.
- Label the control as personal Zalo messages in English and Vietnamese.

These controls make the launcher a navigation aid. They do not make Zalo part
of the YKSG authorization, audit, retention, or operational message boundary.

## Acceptance checks

The release check must confirm the supported behavior:

- A web click opens Zalo Web Chat in a separate window.
- A signed-out user sees the official Zalo login flow.
- A signed-in user sees the chats that Zalo provides for that account.
- Closing or signing out of YKSG does not sign the user out of Zalo.
- No Zalo credential, token, contact, or message appears in YKSG storage or
  network requests.
- The launcher stays inside the usable mobile viewport.
- English and Vietnamese labels state that the link opens a separate window.
- A blocked popup or failed native browser launch gives a clear failure
  message.

## Next steps

Enable `VITE_ENABLE_ZALO_LAUNCHER=true` in each approved client environment.
Test the first-login and retained-session paths on the clinic's supported
browsers and mobile devices. Treat any future Official Account work as a
separate integration with its own privacy review.
