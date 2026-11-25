# Repository status

The [web app](https://pros-rpg.web.app/) runs on Firebase Hosting. The sample can be tried before sign-in. Android and iPhone use the [same web install guide](https://pros-rpg.web.app/?install=1). The code is available under the [MIT License](../LICENSE).

| Area | Available |
| --- | --- |
| Daily work | Pinned projects, routines, focus sessions, activity logging and corrections, recoverable drafts, Journal, Library, and Chronicle |
| World and skills | 110 authored skill paths, custom skills, six illustrated places, 18 restorations, keepsakes, wardrobe, and story chapters |
| Guidance | Olive’s written guidance, weekly recap, activity parser, and an optional on-device model |
| Data | Local saves, Undo, backup and import, recovery snapshots, and private synchronization for verified accounts |
| Mobile | Phone-first tabs and install guide, offline reopening after setup, a [signed Android APK](https://github.com/revaan-mishra/pros-app/releases/tag/v1.0.2), and an iOS development project |

## Verification

The 25 November 2026 web release passed 321 unit tests, 33 Chromium workflow cases, seven targeted WebKit cases, the production build, asset integrity and 11 HTTP and policy checks. The live guide was checked in an Android browser profile. Both browser engines cached the production preview before sign-in and reopened saved sample work offline. The hosted invitation flow passed signup and private restoration in the earlier release checks.

The public showcase refresh passed Chrome and WebKit layout, keyboard, reduced-motion, and restoration checks at desktop and phone widths. The restoration is a standalone example. See [the showcase notes](SHOWCASE.md) for its sources and captures.

Self-service signup passed 322 unit checks, 40 Firestore rules checks, and nine Firebase SDK integration checks. In the live app, a disposable account opened its first world and synced an activity after completing Firebase email verification. That account had no invitation record. The signed Android 1.0.1 update installed over 1.0 and restored the same activity on the API 37 emulator.

Version 1.0.2 fixes narrow-screen text layout in Finished Results, Focus history, and the Library. Chromium and WebKit checked 15 screens and three common sheets at three phone sizes. The layout regressions also passed in a browser using the files from the signed APK. Android runtime rendering for 1.0.2 remains unverified.

The [Verify PROS workflow](https://github.com/revaan-mishra/pros-app/actions/workflows/verify.yml) checks each current build. Browser and Firebase emulator suites can run separately. See the [release checklist](RELEASE-CHECKLIST.md) for the full acceptance criteria.

## Device and native work

Physical Android and iPhone installation, actual device keyboards, VoiceOver, and measured device responsiveness still need hands-on checks. The Android accounts build uses the same email verification and sync as the live web app. Existing Android installs need the 1.0.1 update for self-service signup. [Native development](NATIVE-MOBILE.md)

For an install or account question, start with [the player guide](QUICK-START.md). The [cloud operations guide](CLOUD-OPERATIONS.md) explains the deployment and private sync contracts.
