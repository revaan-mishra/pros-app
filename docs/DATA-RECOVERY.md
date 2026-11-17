# Local data and recovery

PROS saves changes on this device first. Firebase accounts synchronize through the explicit pending-command queue when identity, access and connectivity allow it; device profiles remain local. The sample preview uses a separate namespace and never contributes to a real profile. See the checkpoint for the exact cloud verification boundary.

## What “saved” means

An acknowledged change has committed its records, revision, pending command, and undo information in one IndexedDB transaction. When submitted from a recoverable form, the exact reviewed draft is consumed in that transaction too. A failed transaction changes none of those records. Repeated command IDs return the previous result instead of applying a change twice.

Your browser's storage can be cleared or evicted. A saved local profile is not an independent backup. Keep an external export for recovery after device loss or browser-data deletion.

## Export

Use **Settings → Data and recovery → Export backup** and save the JSON file somewhere outside the app, such as Files or your Mac. A version 2 export includes source records, preferences, format/rules versions, pending commands and unfinished drafts, read together from the same account namespace. It excludes authentication credentials and tokens. Treat exported journals, notes and drafts as private information.

PROS provides an in-app weekly backup reminder. Saving the export outside the browser requires your action.

## Import

Choose a PROS JSON backup. The app validates its format, dates, field limits, skill references, identifiers and bounded draft contents before making changes. Version 1 backups remain readable; their missing drafts do not erase existing drafts. Version 2 requires a draft collection.

The preview compares records and unfinished drafts. A differing record or draft with the same stable identity requires a choice: keep this device's version or use the backup version. If overlapping local records or drafts change after review, import stops without changing them. Use **Refresh comparison**, inspect the new versions and choose again.

An unresolved conflict aborts the entire import. The app saves a local recovery snapshot before applying an import to an existing profile. Existing profile and record identities are preserved; imported source-device command receipts are not replayed as additional activities.

Drafts based on the restored source record are rebased to its local revision. An older or unproven draft requires saved-record review before submission. Internally this is draft-only `baseRevision: -1`; canonical record revisions remain nonnegative. Import never treats a coincidentally equal revision number as proof that a draft is current.

## Interrupted forms and competing drafts

Project, quest, book, output, journal, activity, continuation and schedule forms save account-scoped drafts. Close preserves the draft after flushing it. **Settings → Unfinished drafts** lets you resume or export a single draft; **Import backup** also accepts that exported draft file and uses the same review/snapshot process.

The form distinguishes waiting, saving, saved and failed states. If another tab changed its draft, compare the copies and explicitly keep yours or use the saved version. Newer saved source records require separate review. Failed saves preserve the current fields; retry or export before discarding. An unreadable draft remains available for export rather than being silently reset.

## Recovery snapshots

Each profile retains seven rolling local snapshots. New snapshots include profile records, source data and drafts. Older snapshots without draft data preserve current drafts when restored. Snapshots remain on the same device, so they protect against mistakes rather than device loss. Before restoration, PROS saves the current state as another recovery point. Records created after a restored snapshot become tombstones, allowing the progression engine to recompute the restored world consistently. Restored drafts undergo revision checks; previously seen restoration scenes remain marked as seen.

## Undo and corrections

Undo preserves stable identifiers and creates a reversing change. If a later action has already modified a record, undo refuses to overwrite that newer work. Activity corrections recalculate XP, skills, attributes, world stages, and cosmetic eligibility. An absence never removes earned progression.

The finished-result gallery previews output corrections and removal. Removing a linked output reopens its completed project or book in the same transaction. Restoring the output record alone does not complete that source again. Invalid equipment falls back safely; Undo restores eligible equipment together with the evidence.

## When something fails

- Keep the current tab open and retry a failed save; the form draft should remain available.
- Export pending work before clearing app data, changing browsers, or removing a profile.
- If a recovery screen appears, retry opening the existing profile or use an external backup. The app does not silently reset records.
- A local profile's namespace never shares records, drafts, command receipts, or snapshots with another profile.

## Verification boundary

Automated tests cover repeated acknowledged writes across database reopenings, duplicate-command delivery, transaction rollback, stale revisions, competing drafts, exact draft consumption, profile isolation, versioned export/import conflicts, stale import previews, snapshot retention and restoration. React/browser interaction, physical-device behavior and a seven-day owner beta require separate verification before a wider release.

## Current preference, guidance and cloud boundaries

Optional `Profile.audio` version 1 stores the four sound channels, preset, levels and selections. First introduction creates a recovery snapshot. Old profiles still read correctly. Tour/hint dismissal and optional portrait presentation are device-local UI choices; they are not progress evidence.

Smart capture’s optional `smartText` is part of its ordinary recoverable activity draft, included when drafts are exported. Olive suggestions are transient; choosing Edit as a next action seeds the ordinary quest draft without replacing an existing saved draft. Onboarding now uses the same guarded draft loader, serialized compare-and-save behavior, conflict review and draft export as other forms. Slow or unreadable setup drafts cannot be overwritten by default fields.

Firebase accounts use the `firebase:<uid>` namespace. Canonical cloud cache, cursor, unresolved conflicts and pending local commands remain separate per account. Device/account removal now cleans the account’s cloud cache metadata as well as records/drafts/snapshots; another namespace is unaffected. Account deletion requires online reauthentication, freezes writes, removes private records/receipts, deletes the Auth identity and then removes the local copy. Interrupted cleanup can resume; a non-content freeze marker can remain for operator cleanup. Other devices’ already downloaded copies and user-saved backup files require separate removal.

See [cloud operations](CLOUD-OPERATIONS.md) for the actual verification boundary. Export remains available when sync is paused or its quota is exhausted. Never describe cloud sync as an external backup or end-to-end encryption.
