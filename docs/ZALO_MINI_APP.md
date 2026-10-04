# Zalo Mini App research

Status: research brief (2026-08-07). Goal: evaluate building YKSG as a Zalo
Mini App so the clinic workspace lives inside the Zalo client, one tap away
from the colleague chats employees already use.

## What a Mini App is

- A Mini App is a small web-technology program that runs directly inside the
  Zalo mobile app. Users open it without downloading anything.
- Built with the Zalo Mini App framework (ZMP) and a mobile-oriented UI
  component set (ZAUI), using the VS Code Zalo Mini App extension or Mini App
  Studio. A Mini App can call your own HTTPS backend, so the existing Supabase
  project and domain logic are reusable.
- Platform reach: 70M+ Zalo users, shareable into friends and group chats,
  with account / phone-number linking for sign-in.

## Registration and verification flow

From the official getting-started documentation
(`docs.zaloplatforms.com/docs/MA/intro/getting-started`):

1. **Register a Zalo App** at developers.zalo.me with a normal Zalo account
   login. One Zalo App can host multiple Mini Apps. No business documents are
   required at this step.
2. **Create the Mini App** at `mini.zalo.me/developers` to receive a Mini App
   ID. Changing the app's information after creation requires a support
   ticket, so choose names and scopes carefully up front.
3. **Verify the Mini App** — two options: verify through an Official Account,
   or verify with paperwork. The OA path is the low-paperwork route and avoids
   the document-heavy process.
4. **Build**: request the needed permissions, integrate the Mini App APIs,
   and follow Zalo's design guidelines. Optional extras include the Checkout
   SDK and ZAUI components.
5. **Publish**: submit through Zalo's release process. Publication is subject
   to Zalo's moderation policy and developer program agreement — the review
   queue is the main schedule risk.
6. **Notify users** through OA messages and ZNS template messages.

## What it solves for YKSG

- Employees open YKSG from inside Zalo, next to their personal and colleague
  chats — meeting the "live in Zalo" workflow instead of fighting it.
- Sign-in via Zalo OAuth ties the workspace to the employee's Zalo account
  with no separate credential.
- OA/ZNS notifications surface clinic work (shifts, announcements, task
  assignments) inside Zalo where attention already is.
- The existing web app remains the desktop home; the Mini App is the mobile
  companion, not a replacement.

## What it does not solve

- It still provides **no access to the personal inbox**. A Mini App gets its
  own surface; Zalo never exposes a user's chat list or history to it.
- It is mobile-only inside the Zalo client; desktop workflows still need the
  web app (and its managed Zalo side panel).
- Publication review and moderation add lead time, and post-creation metadata
  changes require support tickets.
- Mini Apps are oriented toward business-to-customer experiences; an internal
  staff tool is acceptable but should stay within the design and content
  guidelines to pass review smoothly.

## Recommended strategy

1. Keep the shipped managed side-panel popup as the desktop experience.
2. In parallel, register the Zalo App and create the Mini App shell now —
   both are document-free steps.
3. Verify through the OA path to avoid paperwork.
4. Prototype the highest-value views first (inbox, tasks, meeting
   confirmation) in ZMP against the existing Supabase backend.
5. Submit for review early and treat review time as the critical path. If
   internal capacity is tight, a Zalo solution partner
   (`miniforbusiness.zalo.me`) can build and operate the Mini App.

## References

- Portal: https://mini.zalo.me · https://miniapp.zaloplatforms.com
- Getting started: https://docs.zaloplatforms.com/docs/MA/intro/getting-started
- API reference: https://docs.zaloplatforms.com/docs/MA/api/intro
- VS Code extension: https://docs.zaloplatforms.com/docs/MA/devtools/ext/install
- Publishing: https://docs.zaloplatforms.com/docs/MA/intro/public-mini-program
- Developer agreement and moderation:
  https://mini.zalo.me/documents/zalo-mini-app-developer-program-agreement
- OA/ZNS user messaging:
  https://docs.zaloplatforms.com/docs/MA/tin-mini-app/send-message-oa-to-user
- Solution partners: https://miniforbusiness.zalo.me
