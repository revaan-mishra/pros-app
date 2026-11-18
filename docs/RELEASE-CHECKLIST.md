# PROS core release checklist

This checklist defines the validation that must be completed before calling PROS production-stable. It is not a claim that every item has already passed. Record actual test output, device/version, and date when verifying a release.

## Recorded validation

The [repository status](IMPLEMENTATION-CHECKPOINT.md) links to the recorded GitHub build and the current verification workflow. Physical-device and hosted account acceptance remain separate from unit and build checks.

## Automated checks

- [x] TypeScript and production build succeed.
- [x] Domain tests verify level boundaries and conserved effort allocations.
- [x] Domain tests verify duplicate activity/session handling and overlapping timed evidence.
- [x] Domain tests verify quest completion creates no duplicate effort XP.
- [x] Domain tests verify strict world/cosmetic re-locking after corrections and deletion.
- [x] Domain tests reconstruct consistent progression from 10,000 activity records.
- [x] Storage tests verify atomic records plus command receipts, duplicate commands, and stale revisions.
- [x] Storage tests verify isolation between profiles and drafts.
- [x] Backup tests verify export/import validation, conflict handling, and restoration.
- [x] Recovery tests verify seven-snapshot retention and restoration behavior.
- [ ] Browser tests cover the primary navigation and meaningful creation/edit/undo workflows.
- [ ] Browser accessibility scan reports no serious or critical violations in tested states.

## Everyday workflows

- [ ] A fresh local profile starts without sample progress.
- [ ] Sample preview stays isolated from real profiles.
- [ ] Common activity logging takes three taps after initial setup.
- [ ] A logged activity updates its skill, character, relevant region, and history consistently.
- [ ] Projects can progress through preparation, relevant effort, output, completion, pause, and archive.
- [ ] Routine occurrences can be completed, skipped, rescheduled, and paused without artificial penalties.
- [ ] Focus survives navigation, pause, suspension, and reopening; confirmation creates one activity.
- [ ] Correcting an activity previews and applies changes to XP and unlock eligibility.
- [ ] Undo restores the original record without creating a duplicate activity.
- [ ] Journal drafts survive closing and reopening the composer.
- [ ] Books can be completed and reopened without duplicate effort or duplicate completion outcomes.
- [ ] Insights reflect credited activities and valid outcomes, including corrections.
- [ ] Exported backups contain the expected private records and no credentials/tokens.
- [ ] Import conflicts require a deliberate choice and failed imports preserve existing records.
- [ ] A restored snapshot rebuilds the expected world and character.
- [ ] Removing one profile leaves other profiles unaffected.

## Physical-device and accessibility checks

These require actual hands-on verification. Desktop emulation does not establish that they pass.

- [ ] Physical iPhone Safari on the current supported iOS release.
- [ ] Physical iPhone Home Screen mode on the current supported iOS release.
- [ ] Previous supported iOS release.
- [ ] Mac Safari and Chrome.
- [ ] Device lock, app suspension, termination, and focus-session restoration.
- [ ] Airplane-mode relaunch after offline-ready confirmation.
- [ ] Safe service-worker update during a draft and an active focus session.
- [ ] VoiceOver reading order, labels, dialogs, and announced status changes.
- [ ] Keyboard navigation, focus restoration, 200% zoom, narrow screens, and reduced motion.
- [ ] Text/control contrast and touch targets across each appearance mode.

## Performance and resilience targets

- [ ] Local-save acknowledgement below 250 ms at the 95th percentile on the documented reference device.
- [ ] LCP ≤ 2.5 s, INP < 200 ms, and CLS < 0.1 under documented test conditions.
- [ ] No lost acknowledged writes across 100 interruption/recovery scenarios.
- [ ] No duplicate changes across 1,000 repeated command deliveries.
- [ ] Storage-quota and malformed-backup failures preserve recoverable records/drafts.
- [ ] Return after a thirty-day simulated absence preserves cumulative evidence.
- [ ] Fully restored world remains useful for continuing projects, skills, books, and reflection.

## Owner beta and future cloud release

- [ ] Seven consecutive days of owner use without unresolved data-loss or progression defects.
- [ ] Known defects, test limitations, and supported browser versions documented.
- [ ] Before cloud release: authentication, verification/recovery, per-user authorization, conflict resolution, and two-device convergence tested against the actual backend.
- [ ] Before cloud release: quota limits and outage behavior documented, and offline pending work preserved.
- [ ] Before cloud release: public privacy, data export, account deletion, and operating ownership completed.

Account and private-sync code is connected. Verify the exact emulator and production gates in the checkpoint before publishing; source integration alone is not a verified hosted release.
