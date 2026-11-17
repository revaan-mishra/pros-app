# PROS implementation checkpoint

Updated 16 November 2026. Implemented through **Phase 3** in the existing app and local production build. Canonical scope: [experience overhaul plan](EXPERIENCE-OVERHAUL-PLAN.md).

## Completed

- **Phases 0–1:** source recovery, living Today, explicitly pinned expedition, Prepare / Practice / Deliver route, complete Atelier, work-derived keepsakes, six home display slots, recovered immersive/minimal/silent focus, shared logging and compact save feedback. See [experience foundation](EXPERIENCE-FOUNDATION.md).
- **Phase 2:** recoverable project/quest/book/output/journal/activity/continuation/schedule forms; competing-draft and newer-record review; stable objectives and linked-quest reconciliation; output gallery/corrections/removal/restoration/Undo; distinct skip/reschedule/pause and scheduling history; focus history and explicit next-action conversion; draft-inclusive backups and snapshots with import comparison freshness. See [data recovery](DATA-RECOVERY.md).
- **Phase 3 — regional scenes:** all six regions now share one scene system across World, expeditions, chapters and Focus. Each has an initial state and three described, visible restorations. Five new original paintings extend the Atelier style; original modular foregrounds add telescopes/charts, fire/bench/mechanism, route markers/pavilion/circuit, gates/council/exchange, and reflection bench/garden/water. The existing finished Sanctuary is reused.
- **Phase 3 — inhabited atlas:** a named region index, URL selection/back support, independent readable requirements and next actions, stage appearance previews, exact cumulative effort/output/project gates, source keepsakes, guardian projects and six-slot home-collection access. Empty regional skill sets offer creation with the correct region preselected. Completed regions remain useful for new practice/projects.
- **Phase 3 — residents and chapters:** six original vector resident portraits, concise dismissible contextual dialogue, one useful action, six regional mysteries and 24 authored arrival/stage chapters. Available chapters can be revisited deliberately; corrections reduce access with current eligibility. Appearance previews grant no evidence, story access or XP. Responses use actual projects/outputs, including changed evidence, paused work and known long absences; no AI service.
- **Phase 3 — character:** improved portrait layout, distinct outfit silhouettes and six actual regional accessories. Every one of the 18 rewards previews on the avatar alongside the saved appearance. Canonical eligibility is rechecked for equip; preview state never saves unlocks. Attributes, titles, achievements, starter reset, custom colors, optional aura and Orel remain functional.

Source recovery archives for Phases 1–3 are in `work/overhaul-baseline/`. Existing profiles/browser data were not opened or replaced. Dependencies and framework remain unchanged.

## Established contracts

- Schema/rules version 1 and existing database/account namespaces remain. XP, outputs, region stages and cosmetics derive from existing records. Phase 3 changes no stored record schema, progression rules, storage adapter or cloud writer.
- Optional `Profile.experience` version 1: pinned project, dismissed suggestions, six unique output-ID display slots and focus presentation/minutes. Optional quest `skippedAt`, `originalDueDate`, bounded `scheduleHistory`; optional focus `continuationNote` and `continuationQuestId`.
- Backup version 2 includes drafts and pending commands; version 1 remains readable. New snapshots contain drafts; older snapshots preserve current drafts. Draft JSON is bounded and rejects credentials. See [data recovery](DATA-RECOVERY.md).
- Draft saves compare the copy read. Record submission consumes only the exact reviewed draft atomically. Imported draft revisions are rebased only when proven current; draft-only `baseRevision: -1` otherwise forces review. Canonical revisions remain nonnegative. Import checks its review token inside the write transaction before snapshots/mutation.
- Regional content is authored presentation in `regions.ts`; scenes consume projected stages and valid keepsakes. Wardrobe previews use a render-only profile/eligibility copy. Region names/stage labels are consistent with the catalog. `ModalState.skill.regionId` is an optional UI context, not persisted data.
- Art prompts, dimensions, master paths, intended uses, fallbacks and hashes are in [original-artwork.json](../public/licenses/original-artwork.json). PNG masters are retained in `work/art-masters/`; optimized WebP assets ship in `public/art/`.

## Verification

- **171 unit tests pass across 15 files.** New Phase 3 checks cover all-region completion/continued use, exact gates, custom and moved/archived skills, incompatible quest handoffs, factual responses after correction/absence, scene tier boundaries, render-only reward previews, canonical equip, fractional requirements, and simultaneous SVG identity/fallback safety.
- **TypeScript and production/PWA build pass.** World, Character, regional chapters, Focus and expeditions load separately. Main JS is 366.30 kB plus shared UI 304.91 kB; these are build sizes, not measured performance.
- **12 credited source assets and 8 original overhaul paintings pass integrity checks.** Five new optimized paintings total about 1.6 MiB. Production precache includes all essential artwork; optional music remains separate.
- Package manifest, lockfile, `storage.ts`, `domain.ts` and `types.ts` match the pre-Phase-3 archive. Focused code reviews completed for World actions and avatar preview/equipment. Existing browser-case selectors for World/Character and the output/equip/correction flow were updated to the new controls; those cases were not executed.
- **No manual/browser/device testing or deployment.** Asset inspection and automated server-side SVG rendering do not verify browser layout, keyboard/VoiceOver, reduced motion, touch, offline relaunch, actual performance or physical iPhone behavior. Seven-day owner beta remains unverified; no stability certification is claimed.

Checks use installed Node directly: `node_modules/typescript/bin/tsc -b`, `node_modules/vitest/vitest.mjs run`, `node_modules/vite/bin/vite.js build`, and `scripts/verify-assets.mjs`. The environment's pnpm wrapper previously attempted an unnecessary online dependency refresh.

## Next: Phase 4 — atmosphere and memory

Implement the planned music/ambience/interface/milestone controls and presets, curated regional audio with optional downloads, factual evidence-linked Chronicle and on-demand weekly recap, three-stop optional tour with longer Help reference, then responsive/reduced-motion polish. Reuse the existing soundtrack lifecycle, drafts/exports, authored regional scenes and correction rules. Do not replace the data engine or repeat research.

Firebase accounts, Security Rules and verified private synchronization remain unfinished and mandatory before publishing. Keep project `pros-rpg`, Mumbai `asia-south1`, free-tier-only operation and the current local origin. Physical-device/accessibility/performance checks and owner beta remain release gates when manual testing resumes.
