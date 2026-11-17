# Experience foundation — 16 November 2026

## Recovery and baseline

Before application edits, the source, public assets, scripts, tests, configuration and documentation were archived in `work/overhaul-baseline/source-before-phase-1.zip`. It excludes environment credentials, dependencies and browser data. The baseline unit suite passed 101 tests.

Existing browser profiles were not opened during this implementation pass. Their raw records and pending commands retain the same database, origin and account namespaces. The first command introducing experience preferences to an existing profile creates a recovery snapshot **before any writes in that command**. This is covered by an IndexedDB transaction test. Old backups remain readable; the ordinary backup export includes the new optional fields.

## Boundaries

- React screens request commands through `GameProvider`; IndexedDB commits records, revisions, command receipts and Undo atomically. The new scene components never create effort or outputs.
- `src/experience/model.ts` derives the chosen expedition, route progress, keepsakes and displayed eligibility from the existing deterministic engine. It also builds validated focus/project commands.
- Today is the opening screen. Expedition, Focus and supporting tools load independently through the existing router. Storage and the focus banner remain outside those page-loading boundaries.
- Real and sample namespaces remain separate. Only the creation of a fresh `demo` uses the new Atelier sample fixture; existing sample and personal records are never replaced.

## Presentation data contract

`Profile.experience` is an optional object with its own `version: 1`: pinned project ID, dismissed suggestion IDs, six unique output-ID display slots, focus presentation, and preferred minutes. It is stored through the normal profile command, exported/imported with the profile, and isolated by account. Defaults are produced at read time; opening Today does not write them or reset records.

`FocusSession.continuationNote` is optional bounded text. It is captured in the existing session-confirmation command. It does not create a quest or grant XP.

Artifacts are projections, identified by existing output IDs. Completed-project outputs reuse existing IDs, including legacy ones. Unavailable evidence renders an empty display slot; Undo restores the same item. Read/celebration history remains separate.

The optional additions require no IndexedDB table migration; existing export/rules version numbers stay unchanged. Firebase's forthcoming rules and compatibility checks must explicitly support these fields before cloud release. No additional Firestore writer was added.

## Visual system

Use ink blue, weathered slate, timber, old brass, moss and warm inhabited light. Major names use Georgia; body text uses the system stack at 16px. The new opening has one painting and an action dock, with editorial lists beneath it. Supporting tools retain the original navigation.

The home and Atelier share the arrival illustration's materials and geography. Atelier painting and keepsake foregrounds use one SVG coordinate system so responsive cropping keeps them aligned. Stages 0–2 use progressive light/display layers; Stage 3 uses a targeted edit with an open terrace and shutters. HTML supplies all actions and records independently of the paintings.

Three new optimized paintings total 703,362 bytes. Production prompts, hashes, dimensions, focal points and fallbacks are in `public/licenses/original-artwork.json`; PNG masters are in `work/art-masters`. Music remains optional. Scene images have readable fallbacks, and minimal focus omits its illustration.
