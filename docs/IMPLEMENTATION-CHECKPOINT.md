# Repository status

This page describes the code in this GitHub repository. The maintained product scope and acceptance criteria are in the [experience overhaul plan](EXPERIENCE-OVERHAUL-PLAN.md) and [release checklist](RELEASE-CHECKLIST.md).

| Area | Included in this checkout |
| --- | --- |
| Daily work | Today, pinned expeditions, focus sessions, reviewed activity capture, and recoverable drafts |
| Progression | 74 catalog skills, six illustrated regions, 18 restoration stages, keepsakes, and wardrobe rewards |
| Guidance | Olive's written project guidance, a factual weekly recap, and an on-device activity parser |
| Data | Device profiles, plain JSON backups, recovery snapshots, and an opt-in Firebase account integration |
| Distribution | Builds from source and a local launcher. Hosted release pending. |

## Verification

The GitHub build for `8512563` passed **280 unit tests across 30 files**, verified **14 credited source assets and 9 original artworks**, and produced the production PWA. Its deployment step failed because GitHub Pages was disabled. The [Verify PROS workflow](../.github/workflows/verify.yml) now runs verification without a publishing step. [Previous build results](https://github.com/revaan-mishra/pros-app/actions/runs/44291143794) · [Current checks](https://github.com/revaan-mishra/pros-app/actions/workflows/verify.yml)

The source includes browser and Firebase emulator suites that can be run separately. Device, accessibility, authenticated hosted sync, and release acceptance checks are tracked in the [release checklist](RELEASE-CHECKLIST.md). See [cloud operations](CLOUD-OPERATIONS.md) for the account and Rules compatibility boundary.
