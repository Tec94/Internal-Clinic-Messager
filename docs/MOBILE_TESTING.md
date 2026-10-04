# Mobile test builds

The iOS and Android projects wrap the existing React application with
Capacitor 8. They are intended for device and simulator testing; they do not
include store signing, production authentication, push notifications, or
offline synchronization.

## Prerequisites

Capacitor 8 requires Node.js 22 or later. Node.js 22.13 or later is recommended
for the current lint toolchain. Android builds also require Android Studio, a
supported Android SDK, and Java 21. iOS builds require a Mac with Xcode.

Follow the official
[Capacitor environment setup](https://capacitorjs.com/docs/getting-started/environment-setup)
before opening either native project. The generated application uses these
identifiers:

- App name: `YKSG Messenger`
- App ID: `com.yksg.messenger`
- Web directory: `dist`
- Android scheme: HTTPS

## Refresh the native projects

Install dependencies and copy a current production build into both native
projects whenever the React application or Capacitor configuration changes:

```powershell
cmd /c npm install
cmd /c npm run mobile:sync
```

Regenerate the test icon and splash resources only after changing
`assets/logo.svg` or the resource colors:

```powershell
cmd /c npm run mobile:assets
```

The generated `android/` and `ios/` directories are tracked source. Do not edit
the copied files under either platform's web asset directory; `cap sync`
replaces them from `dist`.

## Test on Android

Install Android Studio and its recommended SDK components first. Then open the
generated project from the repository root:

```powershell
cmd /c npm run mobile:android
```

Select an emulator or connected device in Android Studio and run the `app`
configuration. For a direct Capacitor launch, use:

```powershell
cmd /c npm run mobile:run:android
```

To produce a local debug APK without signing for a store, run:

```powershell
cd android
cmd /c gradlew.bat assembleDebug
```

The APK is written under `android/app/build/outputs/apk/debug/`. Run
`cmd /c npx cap doctor android` when SDK, Java, or Android Studio discovery is
unclear.

## Test on iOS

Copy or clone the repository to a Mac with Xcode. Install dependencies, refresh
the native project, and open it from the repository root:

```bash
npm install
npm run mobile:sync
npm run mobile:ios
```

Choose an iPhone simulator and build the `App` scheme. A command-line simulator
build can be checked without signing:

```bash
xcodebuild -project ios/App/App.xcodeproj \
  -scheme App \
  -sdk iphonesimulator \
  -configuration Debug \
  build CODE_SIGNING_ALLOWED=NO
```

The iOS project cannot be compiled or launched from Windows. Signing, team
selection, and App Store metadata belong to a later release phase.

## Native smoke test

Test both portrait and landscape orientations on a small and a current-size
phone. Verify the following behavior before sharing a build:

- The bottom tabs reach Inbox, Chat, Tasks, Meetings, and More.
- More contains the permission-appropriate entries and both languages.
- The workspace drawer and all dialogs stay within the safe area.
- The software keyboard keeps the chat composer visible.
- Android Back closes the topmost sheet, then the workspace drawer, then
  navigates history, and minimizes the app only from the root route.
- Meeting links open in the system browser.
- The status bar does not overlap the application and uses dark icons.
- The More sheet includes the Zalo control when Zalo is enabled.
- Selecting Zalo opens it through the in-app browser, which shares the
  system browser's retained Zalo session.
- The first use shows Zalo sign-in, and a later use can restore Zalo's own
  session.

The Zalo control opens a Zalo-controlled surface; Capacitor never receives
Zalo credentials or personal inbox data. Read the
[Zalo integration decision](ZALO_INTEGRATION.md) for this boundary.

## Troubleshooting

Use the smallest relevant refresh before rebuilding the native application:

- If native screens show stale React code, run `cmd /c npm run mobile:sync`.
- If npm reports engine warnings, upgrade to Node.js 22.13 or later.
- If Android cannot find an SDK or device, finish Android Studio setup and run
  `cmd /c npx cap doctor android`.
- If native links fail, confirm the Browser plugin was included by `cap sync`.
- If the keyboard overlays the composer, confirm the Keyboard plugin remains
  configured for native resize in `capacitor.config.ts`.
- If iOS dependencies are stale, rerun `npm run mobile:sync` on the Mac before
  reopening Xcode.

## Next steps

A production mobile release still needs signing identities, store records,
privacy disclosures, production authentication, device-level security review,
and release-channel configuration. Add those only after the test wrapper and
native smoke tests are accepted.
