import type { Firestore } from 'firebase/firestore';
import { firebaseServices } from './firebase';
import { cloudKey, firebaseUid, type CloudAdapter, type CloudReceipt, type CloudRecord } from './types';
import { validateCloudRecord } from './local-sync';
import type { Command } from '../types';
import { decodeCloudRecord, encodeCloudRecord } from './wire-codec';

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, stable(v)]));
  return value;
}
export async function commandFingerprint(command: Command): Promise<string> {
  const text = JSON.stringify(stable({ id: command.id, accountId: command.accountId, mutations: command.mutations, schemaVersion: command.schemaVersion, rulesVersion: command.rulesVersion }));
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('');
}
export async function createFirestoreAdapter(accountId: string, testConnection?: { store: Firestore; assertIdentity: () => void }): Promise<CloudAdapter> {
  const uid = firebaseUid(accountId); const sdk = await import('firebase/firestore');
  const connection = testConnection || await (async () => {
    const { auth, firestore } = await firebaseServices();
    return { store: firestore, assertIdentity() { if (auth.currentUser?.uid !== uid || !auth.currentUser.emailVerified) throw new Error('Sign in to this account and verify its email to resume synchronization.'); } };
  })();
  const store = connection.store;
  const stateRef = sdk.doc(store, 'users', uid, 'state', 'main');
  const recordRef = (kind: Command['mutations'][number]['kind'], id: string) => sdk.doc(store, 'users', uid, 'records', cloudKey(kind, id));
  return {
    async pull(cursor) {
      connection.assertIdentity();
      const state = await sdk.getDocFromServer(stateRef); connection.assertIdentity();
      if (state.data()?.deleting) throw new Error('Account deletion is in progress. Finish it from Account settings before using this world.');
      const access = await sdk.getDocFromServer(sdk.doc(store, 'access', uid)); connection.assertIdentity();
      if (access.exists() && access.data().enabled !== true) {
        throw Object.assign(new Error('Cloud access is paused for this account. Your saved work stays on this device.'), { code: 'permission-denied' });
      }
      const head = state.data()?.sequence || 0;
      if (!Number.isSafeInteger(cursor) || cursor < 0 || !Number.isSafeInteger(head) || head < cursor) throw new Error('The cloud history needs recovery. Local work has been preserved.');
      if (head <= cursor) return { records: [], cursor: head };
      const records: CloudRecord[] = []; let last: import('firebase/firestore').QueryDocumentSnapshot | undefined;
      do {
        connection.assertIdentity();
        const constraints = [sdk.where('sequence', '>', cursor), sdk.where('sequence', '<=', head), sdk.orderBy('sequence'), ...(last ? [sdk.startAfter(last)] : []), sdk.limit(200)];
        const page = await sdk.getDocsFromServer(sdk.query(sdk.collection(store, 'users', uid, 'records'), ...constraints)); connection.assertIdentity();
        records.push(...page.docs.map(doc => decodeCloudRecord(doc.data())));
        last = page.size === 200 ? page.docs[page.docs.length - 1] : undefined;
      } while (last);
      return { records, cursor: head };
    },
    async push(command) {
      connection.assertIdentity();
      if (command.accountId !== accountId) throw new Error('This pending command belongs to another account.');
      if (!command.mutations.length || command.mutations.length > 400) throw new Error('This change is too large to synchronize together. Export a backup before recovering it.');
      if (new Set(command.mutations.map(m => cloudKey(m.kind, m.entity.id))).size !== command.mutations.length) throw new Error('This change contains competing copies of one record. Export a backup before recovering it.');
      const fingerprint = await commandFingerprint(command); const receiptRef = sdk.doc(store, 'users', uid, 'commands', command.id);
      return sdk.runTransaction(store, async transaction => {
        connection.assertIdentity();
        const [receiptSnapshot, stateSnapshot, ...snapshots] = await Promise.all([transaction.get(receiptRef), transaction.get(stateRef), ...command.mutations.map(m => transaction.get(recordRef(m.kind, m.entity.id)))]);
        connection.assertIdentity();
        if (stateSnapshot.data()?.deleting) throw new Error('Account deletion is in progress. No new work will be uploaded.');
        if (receiptSnapshot.exists()) {
          const receipt = receiptSnapshot.data() as CloudReceipt;
          if (receipt.fingerprint !== fingerprint || receipt.id !== command.id || receipt.status !== 'accepted' || !Number.isSafeInteger(receipt.sequence) || receipt.sequence < 1 || JSON.stringify([...receipt.keys].sort()) !== JSON.stringify(command.mutations.map(m => cloudKey(m.kind, m.entity.id)).sort())) throw new Error('A saved change could not be verified. Original and pending work are preserved.');
          return { status: 'accepted' as const, receipt, records: snapshots.filter(s => s.exists()).map(s => decodeCloudRecord(s.data())) };
        }
        const conflicts = command.mutations.flatMap((m, index) => {
          const remote = snapshots[index].exists() ? decodeCloudRecord(snapshots[index].data()) : null;
          return (remote?.revision || 0) !== (m.expectedRevision || 0) ? [{ kind: m.kind, entityId: m.entity.id, remote }] : [];
        });
        if (conflicts.length) return { status: 'conflicted' as const, conflicts };
        const sequence = (stateSnapshot.data()?.sequence || 0) + 1;
        const records = command.mutations.map((m, index) => {
          const previous = snapshots[index].exists() ? decodeCloudRecord(snapshots[index].data()) : undefined;
          const revision = (m.expectedRevision || 0) + 1;
          return validateCloudRecord({ kind: m.kind, entityId: m.entity.id, revision, sequence, commandId: command.id, data: JSON.parse(JSON.stringify({ ...m.entity, revision, createdAt: previous?.data.createdAt || m.entity.createdAt })) });
        });
        const receipt: CloudReceipt = { id: command.id, fingerprint, sequence, keys: records.map(r => cloudKey(r.kind, r.entityId)), status: 'accepted' };
        transaction.set(stateRef, { sequence, commandId: command.id, deleting: false });
        transaction.set(receiptRef, receipt);
        for (const record of records) transaction.set(recordRef(record.kind, record.entityId), encodeCloudRecord(record));
        return { status: 'accepted' as const, receipt, records };
      });
    },
  };
}
