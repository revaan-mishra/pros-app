# Repository status

This page describes the code in this GitHub repository. The maintained product scope and acceptance criteria are in the [experience overhaul plan](EXPERIENCE-OVERHAUL-PLAN.md) and [release checklist](RELEASE-CHECKLIST.md).

| Area | Included in this checkout |
| --- | --- |
| Daily work | Today, pinned expeditions, focus sessions, reviewed activity capture, and recoverable drafts |
| Progression | 74 catalog skills, six illustrated regions, 18 restoration stages, keepsakes, and wardrobe rewards |
| Guidance | Olive's written project guidance, a factual weekly recap, and an on-device activity parser |
| Data | Device profiles, plain JSON backups, recovery snapshots, and an opt-in Firebase account integration |
| Distribution | Builds from source and a local launcher. The [live invitation-only beta](https://pros-rpg.web.app/) runs on Firebase Hosting. |

## Verification

Verify PROS checks this checkout’s assets, unit tests, local HTTP server, and production build. The hosted beta passed signup, private restoration, and offline relaunch in WebKit at phone dimensions on 23 November 2026. Physical iPhone checks and the owner beta remain in progress. [Current repository checks](https://github.com/revaan-mishra/pros-app/actions/workflows/verify.yml) · [iPhone setup](QUICK-START.md#iphone-and-installation)

The source includes browser and Firebase emulator suites that can be run separately. Device, accessibility, authenticated hosted sync, and release acceptance checks are tracked in the [release checklist](RELEASE-CHECKLIST.md). See [cloud operations](CLOUD-OPERATIONS.md) for the account and Rules compatibility boundary.
