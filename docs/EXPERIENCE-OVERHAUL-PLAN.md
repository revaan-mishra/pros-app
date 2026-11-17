# PROS — experience overhaul

Planning baseline: 16 November 2026. Status: proposed implementation plan, not completed functionality.

**Product promise: real work leaves a recognizable, lasting mark on a world you enjoy returning to.**

This plan takes precedence over earlier cosmetic enhancement suggestions where they conflict. Keep the existing React/TypeScript/Vite application and its progression records. Build in `outputs/pros-app`; `pros-app-enhanced` remains reference material. The current request is planning only: no application code, infrastructure, or production data was changed for this document.

## 1. What needs to change

The source has substantial breadth: quests, projects, skills, six regions, character equipment, focus, journals, books, history, a tour, music, and recovery. The weak point is how these pieces become an experience.

| Observation from the current source | Consequence | Overhaul decision |
| --- | --- | --- |
| Today stacks a scene, metrics, next steps, skill cards, focus invitation, project invitation, and guide. | Several elements compete to explain why to open the app. | Give the opening one dominant scene and one useful next action. Put detail behind deliberate expansion. |
| Today selects the first active project through `projects[0]`. | The app can emphasize a project the user does not currently care about. | Explicitly pin a current expedition; otherwise offer a transparent, dismissible suggestion. |
| Regions share the same effort/output thresholds and broadly similar presentation. | The same numbers are repeated with different names. | Preserve the accounting, but give each region distinct actions, visual transformations, characters, and completed-work displays. |
| Existing paintings are separate from the interactive vector world and avatar. | The opening promises a richer place than most daily screens deliver. | Use a coherent painted scene system with lightweight interactive foreground layers. |
| Most durable rewards live in progression and wardrobe screens. | A reward can be earned without changing the next opening meaningfully. | Put earned artifacts, occupied spaces, and restored landmarks directly into the home and atlas. |
| Orel currently cycles through a few regional notes. | The guide has limited awareness of the user's actual next step. | Use authored responses to specific record states, each with an appropriate action. |
| Music is largely a separate listening-room feature. | Sound contributes less to the world and focus experience than it could. | Introduce regional soundscapes and a small, consistent feedback vocabulary. |
| Monolithic page/form files carry many responsibilities. | Large visual changes can unintentionally alter saving or progression. | Extract the changed experience by feature while retaining the existing command boundary. |

These are code/design findings, not results of a new hands-on usability study. Manual app testing remains paused under the existing instruction.

## 2. Research translated into decisions

Reddit is qualitative inspiration. Its participants disagree, and these threads do not prove improved motivation or retention.

| Source | Useful signal | PROS decision |
| --- | --- | --- |
| [Habitica: why people quit](https://www.reddit.com/r/habitica/comments/1t59nas/what_made_people_quit_habitica/) | Some replies describe repetitive rewards, exhausting upkeep, and losing interest after obtaining preferred equipment. | Make completed work permanently interesting to revisit; support flexible commitments and further projects after the finite campaign. |
| [LifeUp: how people use it](https://www.reddit.com/r/LifeUp_HabitRPG/comments/vui5yn/hi_how_does_everyone_use_the_app/) | The original poster describes spending too long organizing and deciding what to do. | Provide a useful default, one next action, and reusable project structures with little setup. |
| [Finch: disabling animations](https://www.reddit.com/r/finch/comments/1ldae1g) | Replies distinguish enjoyable character animation from tedious reward screens, and request more selective sound controls. | Separate ambience, interface feedback, and celebrations. Rewards arrive automatically in one compact receipt. |
| [Spirit City: user experiences](https://www.reddit.com/r/CozyGamers/comments/1d84iki) | Some users value a customizable place and unobtrusive background atmosphere; another found running it unnecessary. | Make immersive focus optional and lightweight. Let practical use remain fast with the scene minimized. |
| [Spirit City: early discussion](https://www.reddit.com/r/CozyGamers/comments/1bzedx9) | A commenter wanted to preview locked decorations before spending points. | Preview all reward appearances and exact requirements. PROS needs no purchase currency for these rewards. |
| [Mooncube's official Spirit City description](https://mooncubegames.com/home/spirit-city-lofi-sessions-press-kit/) | The developer describes adjustable soundscapes, a personal space, and integrated focus tools. | Treat the environment as a usable workspace. Develop PROS's own world and work-derived artifacts rather than reproduce that game's presentation. |

The synthesis is **agency, atmosphere, visible consequences, and low bookkeeping**. The design hypotheses below still need owner use to establish whether they make PROS worth opening.

## 3. Creative direction: a world that remembers

PROS becomes an illustrated field atlas with inhabited places, a home, and evidence of things actually made. Its particular identity comes from the relationship between the user's projects and the details appearing in those places.

The six existing regions stay. The interface stays clear enough to use as an everyday tool. Narrative belongs to places and events; action labels stay literal: **Start focus, Log activity, Complete project, Edit record**.

### Art and interface language

- Use the existing `arrival.webp` as the composition and material reference: believable architecture, weathered stone, ink-blue distance, copper/brass details, moss, warm inhabited windows.
- Replace repeated rounded-card grids with a deliberate hierarchy: one scene, a compact action dock, editorial lists, then supporting detail. Reserve bordered cards for genuinely separate objects.
- Give the atlas engraved routes, readable place labels, regional silhouettes, and a selected-location inspector. Avoid making the entire interface look like a parchment texture.
- Use a restrained display face for place names and a highly readable local body font for controls and records. Keep body text at least 16px.
- Desktop should feel like an opened atlas/workspace; phone should feel like a scene with a useful instrument panel. Recompose artwork for each, rather than crop away its subject.
- Maintain five main destinations: **Today, Quests, Skills, World, Character**. Journal, Library, Insights, listening room, and Settings retain direct secondary routes.
- Remove repetitive inspirational footers and vague praise. Describe a concrete action or an actual change. Example: “The rehearsal room is ready. Finish one recording to open its first exhibition.”
- Keep scene names consistent. “Project” remains the underlying concept; an **expedition** is its visual adventure presentation, not a second kind of work to maintain.

No full 3D engine or free-roaming character is needed for this direction. Layered 2D scenes can provide the identity without consuming the performance and content budget of a separate game.

## 4. The six signature features

### A. A living Today scene

Today opens at a small home overlooking the world. The pinned project determines the nearby working area. Time of day changes light; valid progress changes objects. None of these changes depend on consecutive attendance.

The first phone viewport contains:

1. A quiet saved/sync indicator and compact identity control.
2. The scene, with one clearly labeled interactive landmark.
3. The pinned next action and a dominant **Start focus** button.
4. A persistent, equally reachable **Log activity** action for work already done.

Below it: at most three chosen commitments, a recent-work strip, and an expandable “What changed?” summary. Stats and the guide become supporting information.

The home should show a few recognizable personal details: an output on the desk, a book on the shelf, an earned regional keepsake. Every interactive object also has an ordinary labeled control; nobody should have to hunt through an image to use the app.

**Useful recommendation:** rank a pinned project first, then an unfinished next action, then an explicitly chosen priority. Optional “5 / 15 / 30 / 60 minutes available” filters suggestions using user-editable estimates. Display why an action was suggested. No AI call, inferred mood, or unexplained urgency is required.

### B. Project expeditions with real consequences

Show each project as a short illustrated route with three acts:

- **Prepare:** the user's required preparation objectives.
- **Practice:** relevant effort toward the project's existing target.
- **Deliver:** explicit confirmation of its real output.

Retain the current boss weighting: 20% preparation, 50% relevant effort, 30% confirmed delivery. Each component remains inspectable. A total percentage is a summary; completion still requires the real underlying conditions and confirmation.

Give the route a preview of what it restores. For example, an Atelier project can prepare an empty exhibition alcove, fill it with work in progress, and place the finished output in it. A Foundry project can bring a dormant mechanism into service.

Optional presentation choices select the landmark's final form. They do not multiply XP, erase evidence, require another skill, or create extra mandatory objectives. Preview choices before committing and allow later visual changes.

Pause, change scope, and resume are first-class actions. A smaller project is still a valid project. Editing objectives preserves stable objective IDs and reconciles linked quests.

### C. Maker's Marks: completed work becomes an artifact

Every valid output has a stable illustrated keepsake derived from its output ID. Its detail view shows the user's title, date, region, project/book link, and optional note. The artifact represents the record; it does not invent an uploaded photo, a recording, or a verified accomplishment.

Examples include a performance folio, repaired mechanism, annotated volume, route marker, or decision seal. Use a small family of carefully drawn silhouettes, with user titles and region-specific materials. Do not generate a new image for every log.

Place selected keepsakes into six fixed home display slots. Offer previews and keyboard/touch selection. Fixed slots provide composition and avoid building a furniture editor.

An output correction updates its keepsake. Deleted or invalid evidence removes eligibility; affected placements fall back safely. User-written memories remain in the journal. Re-crossing a threshold restores the same item rather than minting another copy.

This gives the app an enduring collection of actual work after all region stages are complete.

### D. Focus places, with a useful ending

Turn Focus into an inhabited place appropriate to the selected skill: an observatory desk, workshop bench, studio, training pavilion, citadel study, or sanctuary.

Provide three presentations using the same recovered timer:

- **Immersive:** scene, readable time, pause/finish, compact sound controls.
- **Minimal:** static backdrop, time, and essential controls.
- **Practice:** ambience and music off, suitable when the real activity already involves sound.

Save presets combining duration, skill, optional linked quest, place, and sound choices. Presets only configure a session. Time is credited once, after the existing completion review.

At the end, show duration and linked work, then one optional prompt: **“Where will you pick up next?”** Save the answer as a continuation note. Offer an explicit action to turn it into the next quest; do not silently create more tasks. The next Today opening can say “Continue…” using that note.

No story interruptions or reward claims occur during a session. Existing timestamp-based recovery, overlap resolution, and explicit confirmation remain authoritative. Do not promise a closed-app iPhone alarm.

### E. An illustrated, factual Chronicle

Connect journal entries, outputs, books, and world changes into a readable timeline. A chapter spread includes a regional illustration, a small set of actual milestones, and the user's own notes.

Offer an on-demand weekly recap with counts, selected completed work, and one optional reflection. Generate the factual structure locally from records. Use authored sentence templates, never invented praise or an AI summary of private writing.

Each automatic entry links to its evidence. Corrections update its current qualification and mark changed evidence; they do not delete personal writing. A chapter can be revisited without replaying unlock celebrations.

The Chronicle should answer “What did I actually make or learn?” more clearly than another chart.

### F. Residents and regional mysteries

Keep Orel as the central guide. Add one authored caretaker per region, with a concise role and a small story tied to restoring that place. A mystery is resolved through existing effort and output requirements, not through an additional daily checklist.

Residents can respond to: first arrival, a pinned next action, a completed output, a changed record, a paused project, and a return after an absence. Their dialogue should reference only facts the app actually knows.

Dialogue is optional, brief, and actionable. Each interaction offers at most one useful action plus dismissal. No chat service, paid AI, relationship decay, feeding meter, or repeated daily conversation requirement is needed.

## 5. Give every region a different payoff

The established cumulative requirements stay: 60 minutes + one output; 240 minutes + two outputs; 720 minutes + three outputs including a completed project. The following are presentations of those requirements.

| Region | Visual story over its three stages | Caretaker and interaction | Completed work on display | Sound direction |
| --- | --- | --- | --- | --- |
| Observatory | Telescope aligns → chart room opens → living sky atlas | Cartographer; inspect a question or phrase kept from practice | Annotated volumes, star charts, language folios | Air, sparse glass-like tones, distant room noise |
| Foundry | Hearth relights → workshop operates → central mechanism turns | Mechanic; inspect something made or repaired | Working models, diagrams, small mechanisms | Low room tone and gentle material sounds; avoid repetitive hammering |
| Atelier | Practice room opens → exhibition wall fills → performance space opens | Conservator; revisit a take, sketch, or finished piece | Folios, framed work, performance keepsakes | Soft acoustic textures; a silent-practice preset |
| Training Grounds | Path clears → pavilion returns → circuit is complete | Sentinel; record a repeatable practice or technique | Route markers and personal practice records | Leaves, open air, restrained rhythmic texture |
| Citadel | Gates reopen → council room returns → exchange hall is inhabited | Envoy; preserve a decision or conversation outcome | Decision seals, strategy boards, correspondence | Courtyard air, restrained strings, occasional distant bell |
| Sanctuary | Seat appears → garden returns → water garden opens | Gardener; save a reflection or continuation note | Reflection stones and annotated pages | Water, foliage, sparse warm tones |

Do not require all 26 catalog skills to finish the campaign. Custom skills can use the same regional stories. Completing the campaign leaves all everyday tools, new expeditions, keepsakes, and history useful.

## 6. Opening, transitions, and recovery

### First encounter

Use the existing arrival painting with a brief premise, **Start my world**, and **Explore a sample**. Let the sample demonstrate one complete work-to-world transformation, explicitly isolated from real progress.

For real play, preserve the account/verification requirement. Reduce setup by offering one primary starting skill and up to two optional additional skills, one editable project suggestion, and its first action. This is a proposed simplification of the previous three-skill onboarding. Name/avatar refinement can wait; confirm the profile time zone before scheduling.

The first meaningful action should be possible without reading lore. Explain the XP/world relationship in the save receipt. Never fabricate effort to make onboarding more spectacular.

### Guided tour

Keep the existing resumable tour machinery. Replace a general seven-screen lecture with an optional three-stop introduction: **your next action → record work → see its effect**. Offer the longer reference tour through Help.

Use contextual hints when a feature is first used: one sentence, one target, dismiss permanently. Preserve keyboard focus, skip/resume, reduced motion, account isolation, and no automatic record changes. The guide should accompany use; it must not block a common log.

### Returning and changing state

| Situation | Required experience |
| --- | --- |
| Normal launch | Render local records promptly; scene decoration can arrive afterward. Offer the pinned next action. |
| Return after a long break | Show preserved progress, a continuation note, and a manageable action. Reschedule/pause commitments without a backlog wall. |
| Local save succeeds | One compact receipt with duration, affected skill/world requirement, and Undo. Animation never delays saving or navigation. |
| Save fails | Keep the draft and stable submission identity; offer retry/export. No success sound or world change. |
| Working offline | “Saved on this device · Waiting to sync.” Keep logging available for initialized accounts. |
| Authentication expires | Preserve local work, pause sync, and show a clear sign-in action. |
| Conflicting edits | Preserve both versions; resolve explicitly with meaningful previews. |
| Correction relocks something | Preview affected progression and placements; apply the whole change consistently. |
| Active focus during navigation | Persistent compact session banner; return to the correct session. |
| App update | Offer at a safe point; preserve drafts and sessions. |
| Missing artwork/audio | Render a complete readable static fallback. Data actions remain available. |

Use approximately 120ms button response, 180ms tab fade, 240ms sheets, and 300ms progress changes. A major world reveal can last up to 800ms, be skipped, and replay on request. Reduced motion removes movement/parallax and uses immediate state changes or brief fades. Avoid continuous motion in lists and multiple simultaneous effects.

## 7. Artwork production plan

Make a style sheet before generating a large batch: palette, materials, architecture, light, camera, line treatment, foreground scale, and phone/desktop safe areas. Evaluate the existing paintings and vectors against that sheet; reuse what fits.

| Asset family | Full overhaul scope | First implementation slice |
| --- | --- | --- |
| Home scene | One layered home with six fixed keepsake slots, light variants, and readable UI space | One complete home scene |
| Regional key scenes | Six scenes; reuse Sanctuary if it fits, so approximately five new regional paintings | One complete Atelier scene |
| Restoration layers | Eighteen meaningful foreground/state changes across six regions | All three Atelier states |
| Residents | Six consistent portrait/vignette assets; retain existing Orel | Orel plus one caretaker |
| Keepsakes | Twelve original modular silhouettes/material treatments | Four, including a project output and book output |
| Avatar presentation | Improve the existing modular rig, silhouette, lighting, and reward previews | A polished default pose and one correctly equipped reward |

Prefer original painted hero scenes plus code-native vector foregrounds. Generate major scenes with a shared reference and constrained briefs; do not simulate detailed paintings by writing hundreds of SVG paths. Keep functional labels in HTML, never inside generated images.

**Home brief:** an inhabited surveyor's home on the edge of the existing valley, open desk and small shelf in the foreground, distant six-region geography, believable slate stone/timber/brass, blue dusk with limited warm light. Keep the lower center calm for the action dock. Produce a phone composition and a desktop composition with the same landmarks. No text, UI, watermark, excessive glow, or ornamental clutter.

**Atelier brief:** a believable riverside practice/exhibition room in the same world, a clear empty display alcove, a window toward the valley, room for an instrument/folio and one small mechanism. Design the base composition so shutters, lit windows, display objects, and an opened performance arch can be layered without repainting the room. No recognizable franchise or imitation of a named artist.

For each image, record its source/prompt, intended screen, focal point, responsive crop, dimensions, optimized file, master file, and fallback. For each stage, provide an actual before/after difference that remains understandable in a still image.

## 8. Soundtrack and effects plan

Use a small authored sound identity: one short original motif, six related regional moods, and restrained material feedback. Existing recordings are candidates to retain; select additional tracks by listening, not by filename or number of downloads.

Separate four controls: **Music, Ambience, Interface sounds, Milestone sounds**. Provide Silent, Quiet focus, and World presets. Begin silent until deliberate playback. Remember choices per account; selecting a region or receiving remote progress must not start sound unexpectedly.

Steady playback uses one music track and at most two ambience layers. Permit a temporary second music voice during a short crossfade and one brief feedback cue. Do not layer unrelated full songs to imitate adaptive scoring. The original synthesized score can support controlled regional variation separately.

Initial effects: focus start, focus pause/finish, successful ink/save, task complete, output confirmed, keepsake placed, subtle sheet open/close, and one combined major-unlock cue. Ordinary navigation need not make a sound. Do not stack a cue for every simultaneous XP, level, region, and equipment change.

Music/ambience downloads remain optional, with size, progress, offline-ready, retry, and removal controls. A missing recording falls back to silence or the user's chosen synthesized option. Audio errors never become record-save errors. Verify actual loop seams, fatigue, loudness differences, and iPhone playback behavior when hands-on checks resume.

### Verified free-source shortlist

These source pages were checked during planning. Audio was not auditioned in this pass; exact selections still need curation. Download only chosen files and retain their actual license, creator, source URL, and hashes in the existing asset manifest.

| Source | Verified license on source page | Intended use |
| --- | --- | --- |
| [Kenney Cartography Pack](https://kenney.nl/assets/cartography-pack) | CC0 | Supporting map details and selective textures; already partly included |
| [Kenney Interface Sounds](https://kenney.nl/assets/interface-sounds) | CC0 | A small, softened selection of confirmations and interface feedback |
| [Kenney RPG Audio](https://kenney.nl/assets/rpg-audio) | CC0 | Candidate material/foley effects, selected to fit the quieter setting |
| [troubadour: Fantasy Song Pack Volume 1](https://opengameart.org/content/fantasy-song-pack-volume-1) | CC0 | Retain the three existing recordings if they fit; audition the remaining tracks before adding more |
| [Abstraction/Tallbeard: Free Music Loop Bundle](https://tallbeard.itch.io/music-loop-bundle) | CC0 | Curate complementary focus/exploration loops; do not import the entire library |
| [TinyWorlds: Forest Ambience](https://opengameart.org/content/forest-ambience) | CC0 | Candidate seamless Sanctuary/Training bed; inspect whether its musical content fits the mixer |
| [PMhee: Raining](https://freesound.org/people/PMhee/sounds/856674/) | Creative Commons 0, as listed | Rain recording candidate; assess recording quality and prepare a loop if appropriate |

Free downloads and noncommercial use are not substitutes for a usable asset license. Keep the existing provenance workflow and visible credits. External art should support the original visual direction; an asset pack should not dictate PROS's menu design.

## 9. Practical features that make the game worth using

These improve the work beneath the world. They ship alongside the experience, not as another list of disconnected destinations.

- **Continue exactly where you stopped:** pinned project, remembered skill, recoverable timer, saved continuation note, and context-specific drafts.
- **Fast capture:** recent skill and previous duration presets; detailed allocations/date/note collapsed until needed. Preserve existing 5/15/30/60-minute effort estimates and show the expected effect before save.
- **Project templates with a real finish:** improve all 26 starter projects, each with three adaptable actions, a meaningful output criterion, and an appropriate presentation. No compulsory elaborate setup.
- **Skill paths with evidence:** connect the existing 60/240/720 milestones as an illustrated path with inspectable outputs. These are game milestones, not claims of externally verified mastery.
- **Output gallery and correction:** browse actual completed work, edit evidence, preview progression impact, delete, and undo. Do not leave the collection dependent on uncorrectable outputs.
- **Useful scheduling:** separate skip, reschedule, pause, completion, and archive; make skipped history discoverable.
- **Quiet insights:** lead with actual work completed and practice distribution. Explain the numbers and retain ordinary charts as detail.
- **Export that includes interrupted work:** versioned records, pending commands, relevant drafts, and personal presentation choices. No credentials or tokens. Keep recovery snapshots and the external-backup reminder.
- **Reward previews:** full appearance and exact requirements, with an easy “show this at home” action once eligible.

Later additions, after the core is enjoyable: a keyboard command palette, a printable Chronicle spread, extra home display themes, and further authored expeditions. AI coaching, social systems, tactical combat, push infrastructure, currencies, and a room-building simulation stay outside this overhaul's launch scope.

## 10. Data and engineering boundaries

Keep XP and eligibility derived from valid records. One minute remains one XP; splitting skills conserves effort; task completion does not duplicate effort; absence removes nothing.

Separate the following clearly:

| Data | Authority and behavior |
| --- | --- |
| Effort, outputs, projects, books | Existing validated entities and command path; these remain progression evidence |
| Artifact identity and regional stage | Rebuildable projections from stable record IDs and current eligibility |
| Pinned project, selected landmark form, home placements, sound/presentation settings | Versioned per-account preferences; cloud synchronization through the same explicit command system once supported |
| Story already seen, tour dismissed, celebration already shown | Presentation history, separate from current eligibility; replay does not create rewards |
| Scene configuration, authored dialogue, asset metadata | Versioned bundled content; never trusted as a substitute for user records |

Do not store an independent artifact XP balance, boss reward total, or world-stage counter. Do not add a second Firestore offline mutation writer. If new persisted entity kinds are needed, update their types, validation, local migration, backup/import, cloud adapters, and Security Rules together. Production remains on the existing origin/account namespaces.

Suggested modules, introduced as needed rather than all at once:

| Area | Existing source boundary | Suggested extraction |
| --- | --- | --- |
| Today and scene | `pages.tsx`, `WorldArt.tsx`, shared styles | `features/today`, `features/world/scenes`, `experience/content` |
| Expedition | `pages.tsx`, `modals.tsx`, `domain.ts` | `features/projects`, pure route presentation selectors |
| Keepsakes/Chronicle | `rpg-pages.tsx`, `secondary.tsx`, outputs | `features/collection`, `features/chronicle` |
| Focus and sound | `pages.tsx`, `soundtrack.ts`, `MusicLibrary.tsx` | `features/focus`, `audio` mixer and source manifest |
| Persistence/sync | `storage.ts`, `app-context.tsx`, `src/cloud` | Preserve these boundaries; extract focused helpers only when required |

Before changes to forms, inspect and address these source-review risks with targeted checks: shared new-activity drafts across different contexts; a successful save followed by draft-clear failure allowing duplicate submission; historical affinity preservation during edits; objective identity/linked-quest reconciliation; parent/subtask completion through every entry point; output correction; and cosmetic cleanup interacting with Undo. Treat them as audit targets until reproduced or ruled out.

### Existing launch requirement remains

The user selected Firebase accounts and automatic private sync **before launch**, existing project `pros-rpg`, and Mumbai `asia-south1`. Cloud modules exist, but the current app entry still uses local-profile flows and no `firestore.rules` file was present during this review. Earlier setup progress must not be confused with a completed cloud release.

Finish verified email/password, recovery, account isolation, explicit local-profile transfer, online transactions, conflicts, sign-out with pending work, export, deletion, beta access, and safe deployment before publishing the improved app. Preserve free-tier-only operation. This planning pass did not change or redeploy Firebase.

## 11. Delivery order and clear exit criteria

Implement one phase at a time. The first goal is a convincing complete daily loop, not a mass restyling of every screen.

| Phase | Deliverable | Exit criteria |
| --- | --- | --- |
| **0. Preserve and map** | Recovery export/snapshot, current check results, short architecture map, style sheet, presentation data contract | Existing records/IDs and pending work remain intact; actual failing/unverified checks are recorded; no reset or new app copy |
| **1. One complete experience** | New Today, pinned project, Atelier expedition, one focus place, shared logging, one keepsake, compact receipt | Open → start/continue → record → see change → revisit evidence all work; all three Atelier visual stages exist; every visible control works |
| **2. A usable project system** | Objective identity fixes, interrupted drafts, continuation notes, templates, output gallery/corrections, scheduling/history fixes | Create/edit/pause/resume/finish/reopen/correct/undo behave consistently; a checkbox cannot duplicate effort |
| **3. The whole world** | Apply the established scene system to all six regions, 18 transformations, residents, story scenes, six-slot home display, polished avatar previews | Every region has distinct finished content, exact requirements, an accessible list alternative, and a useful next action |
| **4. Atmosphere and memory** | Curated regional music, ambience mixer, effects, Chronicle, simplified tour, responsive/reduced-motion polish | Silent use is complete; no audio before a gesture; no stacked rewards; factual entries link to records; media failures cannot block work |
| **5. Accounts and launch reliability** | Finish existing Firebase work, private sync, rules, recovery/deletion, migrations and deployment configuration | Emulator authorization/convergence/conflict tests pass; accounts cannot mix records; offline pending work survives outages; backups restore equivalent progression |
| **6. Controlled release** | Reconciled README, release checklist, known limitations, owner beta deployment and recovery instructions | Production build and relevant automated checks pass; cloud gate is met; no unsupported stability claim; broader release waits for owner/device gates |

Phases 1–4 can use an isolated sample profile while cloud integration is unfinished. New persistent preferences must already follow the agreed data contract so they do not need a second implementation later. Do not publish that sample build as the user's synced release.

### What “polished” means for this overhaul

- In a returning profile, a common manual log takes no more than three deliberate taps from Today. A preconfigured focus session starts with one clear action; advanced setup is optional.
- The first viewport identifies what to do next and why the world matters without requiring lore reading.
- Major completions change a recognizable object or place, not only a counter. Small effort receives an honest, lightweight progress change without granting an unearned restoration stage.
- At least three different kinds of completed work have noticeably different keepsakes and gallery detail.
- A user can explain the next world requirement and find the supporting record. Corrections update world, collection, and equipment together.
- All five destinations have intentional empty, populated, loading, unavailable, and recoverable error states. Saving, audio, art, and sync have independent status.
- At narrow phone widths, with the keyboard open, at 200% zoom, in reduced motion, and with artwork unavailable, the workflows remain complete. Targets are at least 44px and contrast meets WCAG 2.2 AA.
- Decoration is lazy-loaded; first-use assets have a small explicit download budget; optional music is not part of the critical render. Keep the original LCP ≤2.5s, INP <200ms, CLS <0.1 and local-save p95 <250ms targets under documented conditions; measure before claiming them.
- The app remains useful after the six-region campaign: new projects create new evidence, keepsakes, and Chronicle entries without resets.

### Verification policy

During implementation, follow the user's current **no manual testing** instruction. Run type checks/build, relevant existing and new domain/storage tests, asset checks, and Firebase emulator tests as appropriate. Test business behavior and recovery, not every decorative component. Avoid repeatedly rerunning unchanged expensive suites.

Before wider release, the original physical iPhone/Safari/Home Screen, accessibility, performance, and seven-day owner-beta gates still matter. Hands-on checks remain pending until that pause is lifted. If the environment cannot run a browser check, record it as unverified rather than converting it to a pass. Never call a passing compiler “A-grade stability.”

## 12. Keep execution economical

Use this document as the product decision record so the implementation model does not repeat the research. Start with `SOL61-HANDOFF.md`, then read only the phase being implemented and relevant source files. Inspect the actual code before assuming a feature or defect exists.

- Deliver one functional slice before multiplying scenes, content, and assets.
- Reuse the progression/storage contracts and the coherent scene/route system; avoid a framework or engine migration.
- Generate the two first-slice scenes before commissioning the full art set. Reuse accepted briefs and references; do not create many speculative variants.
- Download and audition a small audio shortlist. Keep only selected files; do not ingest entire libraries into the repo or conversation.
- Keep a short implementation checkpoint with completed phase, changed contracts, checks actually run, unresolved risks, and the next concrete task. Do not keep appending a transcript.
- For each phase, report what works, actual verification, and remaining limitations. Do not spend a phase producing another plan instead of implementing its deliverable.
- Fix new failures and relevant pre-existing data risks; avoid unrelated refactors or tests that merely mirror visual implementation.

The decisive first result is **one opening, one expedition, one session, and one earned change that feel like a single finished product**. Expand the rest of PROS from that working experience.

## Accepted follow-up decisions — 17 November 2026

The owner’s later instructions extend this plan: Olive, a completely white Indian American Spitz, replaces Orel/the owl; on-device project guidance and reviewed sentence capture implement the AI research’s offline foundation; 48 optional skills expand the catalog to 74; an optional native-WebGL wayfinder adds geometric inspection with static fallback; product copy removes development/release-note language. A product, web and future-store launch kit follows the app implementation. Remote model inference remains disconnected and cannot be described as live AI coaching. These additions preserve deterministic progression, local transactions, original IDs, account namespaces and backups.
