# Accounts and private synchronization

Project: **pros-rpg**. The existing default Firestore database was verified read-only on 17 November 2026: **Standard**, **asia-south1 (Mumbai)**, `freeTier: true`, delete protection enabled. Email/password sign-in is enabled. Authorized domains reported by the provider check are `pros-rpg.firebaseapp.com` and `pros-rpg.web.app`; authorize the actual hosting domain before its account release. No billing or paid service was enabled.

## Local and cloud boundaries

- Canonical local records, pending commands, Undo and drafts use Dexie transactions in the original account namespace.
- `firebase:<uid>` is never interchangeable with a device profile or sample namespace. Restored identity is checked before rendering a different authenticated account’s cached world. Expired authentication pauses sync while initialized local work remains recoverable.
- Firestore uses memory cache, not a second persistent offline mutation queue. The explicit pending-command queue is the only offline writer.
- A cloud transaction compares expected revisions, commits records and an immutable command receipt, and advances the per-user sequence. Command fingerprints detect ID reuse. Validated incremental downloads preserve locally pending records and tombstones.
- Competing edits remain visible. Resolution checks the versions actually reviewed; independently queued records retain their own revision expectations and are not silently rebased over unseen changes. A journal can keep both copies as separate records.
- Cloud wire encoding is versioned separately from local schema, progression rules, commands and backup format. Its codec preserves exact historical affinities, ordering, zero weights and fractional values while avoiding Firestore Rules expression limits. Older canonical-array cloud records remain readable. Consult the codec and rules together before changing the representation.

## Enable private access

The client can create/verify an Auth account but cannot grant itself access. `/access/<uid>` contains an operator-managed `enabled` boolean. Rules and the adapter both check approval, including an empty world’s first opening.

Use the pinned workspace CLI login and operator helper; no credentials enter the app or output:

```sh
node scripts/firebase-admin.mjs check
node scripts/firebase-admin.mjs grant ACTUAL_FIREBASE_UID
node scripts/firebase-admin.mjs revoke ACTUAL_FIREBASE_UID
```

`check` is read-only. `grant` and `revoke` change only that supplied UID’s beta permission in `pros-rpg`. The helper uses internal APIs of the installed Firebase CLI; review it when upgrading that dependency. Never guess an owner UID or commit a review password, admin credential, CLI debug log or provider token. No access grant was performed in this implementation pass.

The owner should register and verify their own app account before its UID is enabled. Existing device records can be exported and imported into the chosen account with explicit conflict review; no automatic profile migration or fabricated progress is performed.

## Automated verification

Regular unit checks use fake IndexedDB and an isolated adapter model; they cover repeated delivery, conflict freshness, independent conflicting records, mixed offline convergence, identity gates, canonical validation, deletion interruption and codec round trips.

Real SDK checks use only demo emulators:

```sh
node node_modules/firebase-tools/lib/bin/firebase.js emulators:exec \
  --only auth,firestore --project demo-pros-rules \
  'node --test scripts/firestore-rules.test.mjs && node node_modules/vitest/vitest.mjs run --config vitest.cloud.config.ts'
```

This suite fails without explicit loopback emulator addresses and does not connect to production. Authentication links/password resets use `.test` addresses and emulator action codes. Security cases exercise every record kind, unauthenticated/unverified/disabled/cross-user denial, revision/receipt/sequence coupling, malformed fields, batch limits and deletion. The actual adapter suite includes catalog initialization, replay, conflicts, large project saves and full historical allocation shapes. Record exact current results in the checkpoint; never infer a pass from test existence.

## Security boundary

The Rules enforce verified identity, operator access, allowed fields, bounded values, short progression allocations, CAS updates and private paths. No aggregate client-supplied XP is accepted as history. Rules cannot fully validate every element of legacy long objective/schedule/session arrays or prove every claimed receipt key is written within their access/expression budgets. Those arrays are bounded server-side and fully validated by the client before application. The command protocol is not a tamper-proof competitive game ledger. Do not describe emulator coverage as exhaustive security certification.

## Sign-out, removal and recovery

Sign-out offers export and preserves pending work in its original namespace; explicit device-copy removal is separate. Removing an account requires online reauthentication, freezes new writes, purges synchronized content/receipts, deletes the Auth identity and clears this device’s namespace. Cleanup interruption preserves a resumable frozen state. If Auth removal succeeds before local cleanup, local cleanup can be retried without recreating the deleted identity. Operator permission/freeze markers can remain after content removal; review them separately. Already downloaded data on other devices and external backup files are not remotely wiped.

Quota/network/authentication failures retain the local queue. Reconnect/sign in and retry from Settings → Data and recovery. Export before recovery that could replace local records. A schema/codec error must never reset a world silently.

## Deployment gate

This pass does not publish the app. Before a controlled hosted release: finish the reported emulator cases, review the rules prototype/limitations, deploy reviewed account/rule configuration, enable only the intended owner/beta UIDs, configure the actual authorized domain and free static host, and verify restoration/outage/conflict/account-switch workflows in that environment. Preserve the original local origin for old records and export before moving to the hosted origin.

Physical iPhone/Safari/Home Screen/Mac checks, accessibility review, measured performance, offline installation, audio/GPU inspection and seven consecutive owner-beta days remain unverified while manual testing is paused. Do not call the app production-stable or publicly available until the agreed gates pass.
