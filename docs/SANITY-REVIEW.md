# PROS sanity review

17 November 2026. This records a code and automated-check review, not hands-on acceptance. See the [implementation checkpoint](IMPLEMENTATION-CHECKPOINT.md) for the final build/test results and remaining release gates.

## Scope

Reviewed the existing progression and command boundary, local account namespaces, interrupted forms, current-record revision checks, start/pause/finish/review/Undo, project/objective links, correction eligibility, import/snapshot recovery, navigation context, skill catalog behavior and the Phase 4 audio/tour integration. The review followed actual source flows; it did not reset or open personal browser profiles.

No additional P0/P1 defect was identified in this review. That is not a guarantee that no such defect exists, nor a production-stability certification.

## Concrete findings and fixes

| Finding | Implemented correction |
| --- | --- |
| Focus could retain an archived last-used skill, and Today could send an unavailable or paused project into a session. | Resolve an available skill/context; route paused, unavailable or delivery-ready projects to review instead of starting misleading work. Existing sessions remain recoverable. |
| Stopwatch depended on the disabled countdown minutes field. | Treat stopwatch duration independently, retaining a valid saved/default countdown preference. |
| A timed activity's date could be edited while its interval evidence still placed effort on the original dates. | Keep the recorded evidence date authoritative and explain the locked date. Manual estimates retain their chosen date. |
| A live skill revision could overwrite unsaved skill edits. | Preserve the editing baseline and local fields; require explicit saved-versus-local review instead of replacing the text. |
| Dirty Settings fields could overwrite newer preferences because submission adopted the latest profile revision. | Capture the baseline on first edit. Merge independently changed fields only; competing same-field edits require explicit review. Preserve unrelated equipment, audio, last-skill and profile metadata. The final write still checks the revision atomically. |
| Reintroducing a removed project objective left its original linked quest archived. | Restore that quest when the objective is explicitly reintroduced relative to the current project. Preserve stable IDs, notes, priorities and scheduling history. Keep intentionally archived quests whose objective never left; Undo restores the prior archive/removal. |
| Profile switching and delayed media operations could retain the wrong component or callback scope. | Key the account provider by account and invalidate stale audio callbacks/operations. Profile changes stop/release playback; no cross-account preference write should be adopted. |
| A partial cached recording could be labeled ready offline, and optional audio needed deliberate removal. | Check full expected byte size, reject truncated/oversized downloads before replacing a valid copy, expose per-file progress/retry/removal, and retain optional media outside essential app caching. |
| Some contextual links, tour route comparisons and the focus guide obscured the current action. | Preserve intended route/query context, use source-specific actions and clear focus/review guidance. Tours and hints do not create progress or silently start sound. |

Targeted automated cases cover preference-field reconciliation and objective restore/Undo, plus the corresponding focus, evidence-date, skill, media, account-scope and tour behaviors. See the checkpoint for the completed combined suite rather than relying on an intermediate test count.

## Streamlining and catalog expansion

- Today retains one dominant next action and reachable logging; collection/recent-work detail is expandable.
- Skill pages lead with useful practice and the next milestone. Full paths and supporting requirements sit behind deliberate expansion; catalog pages load manageable batches rather than one long card wall.
- The catalog now offers **74 skills**: the original **26 stable IDs are preserved**, and **48 additions** are available through an explicit Discover/add action. Browsing or previewing grants no XP and does not bulk-equip or inject progress into an existing profile.
- Existing records, custom skills, historical allocations and world requirements remain authoritative. New guides/templates support those records; they are not a second progression engine.
- Chronicle, soundtrack, settings and other supporting tools remain secondary destinations. No extra main-navigation tab or mandatory reward claim was introduced.

## Limits and next gate

No manual browser, physical-device, VoiceOver, keyboard, touch, zoom, reduced-motion, listening-fatigue or loop-seam verification was performed. A compiler, pure-model test or simulated audio context cannot establish those outcomes. Network/account outages and actual multi-device behavior also require the planned backend verification.

Production authentication and verified private synchronization are still required before publishing. The existing `pros-rpg` project, Mumbai region and free-infrastructure constraints remain in force. The owner/device beta and the release checklist remain open.

[AI coach research](AI-COACH-RESEARCH.md) now informs implemented reviewed smart capture and Olive’s on-device guidance. Journal-body summarization and remote language-model calls are not connected. The later account pass adds real SDK/emulator checks; see the checkpoint for final results.


## Final integration review additions

- Setup now uses the shared guarded draft hook rather than an independent eager autosave. Loading/validation failures preserve the saved draft with retry/export; competing copies require review. Selected starter skills remain visible before the shortlist limit is applied.
- Olive replaces the owl throughout product surfaces. Suggestions seed ordinary recoverable forms, and focus handoff supplies a reviewed time budget without starting a timer or recording effort.
- Character’s inspectable compass is optional, has no record authority and creates no WebGL context while closed. Actual GPU/layout/touch experience remains unverified.
- Account-specific sync status leads directly to Data and recovery. Private account entry, verified email, explicit operator approval, resumed identity and cloud restoration use the existing namespace boundary.
- The conflict resolver was corrected so an independent pending edit is not rebased over another device’s unseen changes. Full cloud wire compatibility and Rules expression budgets are checked in the emulator suite, not assumed from compilation.
