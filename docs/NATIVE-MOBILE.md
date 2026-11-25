# PROS on iOS and Android

Install PROS from your browser on Android or iPhone. Android users can also install the signed APK and open the same account. The Capacitor projects in `native/` reuse the React app. [Browser install guide](https://pros-rpg.web.app/?install=1) · [Android releases](https://github.com/revaan-mishra/pros-app/releases)

## Distribution options

| Route | What users install | Fit for PROS |
| --- | --- | --- |
| Home Screen web app | Safari on iPhone or Chrome on Android installs from the live link | One install guide, account sync, and offline use after setup. [iPhone](https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/27/ios/27) · [Android](https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid&hl=en-G) |
| Android APK | A signed Android app with the web bundle inside | Available as a prerelease. It uses the same account, screens, and progression as the web app. [Android release](https://github.com/revaan-mishra/pros-app/releases/tag/v1.0.1) |
| Android Trusted Web Activity | An Android app opens the hosted site in an Android browser with a verified domain association | A reasonable Play-only route if the goal is discovery and the PWA already covers the experience. Native iOS still needs a separate path. [Chrome TWA documentation](https://developer.chrome.com/docs/android/trusted-web-activity) |
| React Native with Expo, Flutter, or SwiftUI and Compose | An app with native UI or a separate cross-platform rendering stack | Consider when device requirements exceed WebView capabilities. React Native can reuse the TypeScript progression model. Screens, IndexedDB, artwork integration, and offline adapters would need redevelopment for a fully native experience. [Expo web-to-native migration](https://docs.expo.dev/guides/dom-components/) |

**Ionic Framework** is a library of mobile web controls and navigation components. **Capacitor** is the packaging runtime and native plugin bridge. An existing Vite app can use Capacitor independently. PROS already has its own navigation, sheets, art direction, and motion settings, so the prototype uses those components directly. [Ionic React](https://ionicframework.com/docs/react/overview) · [Add Capacitor to an existing app](https://capacitorjs.com/docs/getting-started)

## Free development and store costs

Use a free Apple account with Xcode Personal Team for your own iPhone. The provisioning profile expires after seven days. TestFlight and App Store distribution use the Apple Developer Program, listed at **US$99 per membership year** or local equivalent. Apple reviews app-like value and asks for workable review access when an app uses sign-in. [Personal Team](https://developer.apple.com/help/account/basics/about-your-developer-account) · [Membership](https://developer.apple.com/programs/) · [Review guidelines](https://developer.apple.com/app-store/review/guidelines/)

Android Studio can run the app on an emulator or a connected test phone without Play Console enrollment. For Play distribution, Google lists a **US$25 one-time fee**. New personal accounts covered by the testing rule need a closed test with at least 12 opted-in testers for 14 continuous days before applying for production. For a small direct APK beta, Google documents limited distribution accounts for up to 50 authorized devices where its developer verification requirements apply. [Play enrollment](https://support.google.com/googleplay/android-developer/answer/6112435) · [Play testing](https://support.google.com/googleplay/android-developer/answer/14151465) · [Android developer verification update](https://developer.android.com/blog/posts/android-developer-verification-2027)

## Install the Android accounts build

Download `PROS-android.apk` from GitHub Releases and open it on your Android phone. If Android asks, allow APK installation from the app you used to open the file. The app appears as **PROS**. On a Mac, follow the emulator quickstart. [Download and checksum](https://github.com/revaan-mishra/pros-app/releases/tag/v1.0.1) · [Emulator quickstart](ANDROID-APK-QUICKSTART.md) · [Android installation guide](https://developer.android.com/distribute/marketing-tools/alternative-distribution)

1. Open PROS while online, choose **Begin your journey**, and sign in using the email and password you use at [PROS on the web](https://pros-rpg.web.app/).
2. If you are new, choose **Create an account**. Open the link in your verification email and choose **Complete verification**. Return to PROS and choose **I’ve verified my email**.
3. Choose **Open my world** to restore your progress or set up a new world. After setup, the app saves work on the device and syncs when connected.

## Build the signed Android accounts APK

Install Android SDK Platform 36, a JDK compatible with Gradle 8.14.3, Node 24 and pnpm. From the PROS root, use the four Firebase web client fields in [the example environment file](../.env.example) to create `.env.native-accounts.local` for your Firebase project.

```sh
pnpm install --frozen-lockfile
cd native
pnpm install --ignore-workspace --frozen-lockfile
pnpm run sync:android:accounts
cd android
env JAVA_HOME="$(/usr/libexec/java_home -v 23)" ANDROID_HOME="$HOME/Library/Android/sdk" \
  ./gradlew assembleRelease
```

Sign `app/build/outputs/apk/release/app-release-unsigned.apk` using Android Studio or `apksigner`. Keep the release key and credentials outside the repository. Reuse the same key and application ID `app.prosrpg` for each update and increment `versionCode`. Verify every signed APK with `apksigner verify` before distributing it. [APK signing and verification](https://developer.android.com/tools/apksigner)

## Run the native prototype

The iOS and Android projects use Capacitor 8.6.2 and the development application ID `app.prosrpg.preview`. The local build includes artwork, authored interface, sample mode and local profiles. Its web bundle disables service workers and production Firebase configuration. Installed native and browser profiles have separate on-device storage.

The emulator can run the development build as **PROS Preview** alongside the signed **PROS** app. The preview uses its own local profiles. [Emulator quickstart](ANDROID-APK-QUICKSTART.md)

From the PROS root with Node 24 LTS and pnpm installed:

```sh
pnpm install --frozen-lockfile
cd native
pnpm install --ignore-workspace --frozen-lockfile
pnpm run sync
pnpm exec cap open ios
pnpm exec cap open android
```

- **iOS:** install full Xcode 26 or later and its iOS platform support. Open the generated Swift Package Manager project, select your development team for the app target, and run it on a simulator or your iPhone.
- **Android:** open the generated project in Android Studio. Install the Android 16 SDK platform (API 36) and its tools through SDK Manager. Run the debug configuration on an emulator or connected phone.
- **After a web change:** run `pnpm run sync` from `native/` before building again. The Xcode and Android Studio projects rebuild the bundled version. [Capacitor environment setup](https://capacitorjs.com/docs/getting-started/environment-setup)

## First native milestone

1. Run the prototype on iPhone and Android. Verify safe areas, display scaling, keyboard and rotation, drawer and sheet dismissal with Android Back, audio, offline launch, and draft recovery across suspension and process death.
2. Test the existing Firebase email verification, sign-in persistence, account isolation, pending writes and conflict handling in both WebViews with disposable test accounts. Restore synchronized records by signing in. Transfer unsynced browser work by finishing sync or using the existing versioned backup. Firebase's browser support table covers Safari and several hybrid environments. Verify the exact native containers before shipping. [Firebase SDK support](https://firebase.google.com/docs/web/environments-js-sdk)
3. Add opt-in focus completion and routine reminders through local notifications. Schedule from the persisted session timestamps, and cancel or replace a reminder when that session pauses, stops, or changes. Check notification permission and delivery on both OSes. Use the native share sheet for user-initiated backup export. [Local notifications](https://capacitorjs.com/docs/apis/local-notifications) · [Share](https://capacitorjs.com/docs/apis/share)
4. Keep Olive's written guidance and sentence parser available out of the box. Expose the optional model only if the specific device and WebView pass its graphics and memory checks, including recovery from an interrupted download.
5. Verify account restoration, offline saves, and an in-place update on physical Android hardware before promoting the APK from prerelease.
