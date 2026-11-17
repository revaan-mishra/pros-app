import { db, gameMutations, loadGame, mutationKey, parseEntity, recordKey, snapshotWithinTransaction, validateGame } from '../storage';
import type { Command, GameData, GameEntity } from '../types';
import { CLOUD_BATCH_SIZE, cloudKey, firebaseUid, type CloudAdapter, type CloudPage, type CloudRecord, type CloudResult, type SyncConflict } from './types';

const stamp = () => new Date().toISOString();
const uid = () => crypto.randomUUID();
const pendingStatus = (command: Command) => command.status === 'pending' || command.status === 'conflict';
/** Revision dependencies break timestamp ties, including many edits made in one millisecond. */
export function orderCommands(commands: Command[]): Command[] {
  const children = new Map<string, Set<string>>(); const indegree = new Map(commands.map(c => [c.id, 0]));
  const byRecord = new Map<string, Command[]>();
  for (const command of commands) for (const m of command.mutations) { const key = cloudKey(m.kind, m.entity.id); byRecord.set(key, [...(byRecord.get(key) || []), command]); }
  for (const [key, entries] of byRecord) {
    entries.sort((a, b) => (a.mutations.find(m => cloudKey(m.kind, m.entity.id) === key)?.expectedRevision || 0) - (b.mutations.find(m => cloudKey(m.kind, m.entity.id) === key)?.expectedRevision || 0));
    for (let index = 1; index < entries.length; index++) {
      const parent = entries[index - 1].id; const child = entries[index].id;
      const edges = children.get(parent) || new Set();
      if (!edges.has(child)) { edges.add(child); indegree.set(child, (indegree.get(child) || 0) + 1); children.set(parent, edges); }
    }
  }
  const available = commands.filter(c => !indegree.get(c.id)); const result: Command[] = [];
  while (available.length) {
    available.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    const next = available.shift()!; result.push(next);
    for (const child of children.get(next.id) || []) { indegree.set(child, indegree.get(child)! - 1); if (!indegree.get(child)) available.push(commands.find(c => c.id === child)!); }
  }
  if (result.length !== commands.length) throw new Error('Pending changes need recovery before synchronization. No records were discarded.');
  return result;
}
export async function pendingCommands(accountId: string) {
  firebaseUid(accountId);
  return orderCommands((await db.commands.where('accountId').equals(accountId).toArray()).filter(pendingStatus));
}
export async function startCloudProfile(accountId: string, input: GameData): Promise<void> {
  firebaseUid(accountId); const data = validateGame(input); const mutations = gameMutations(data);
  await db.transaction('rw', db.records, db.commands, db.snapshots, db.drafts, async () => {
    if (await db.records.where('accountId').equals(accountId).count()) throw new Error('This account already has saved records. Open it or use recovery before starting another world.');
    const normalized = mutations.map(m => ({ kind: m.kind, entity: { ...m.entity, revision: 1 }, expectedRevision: 0 }));
    await db.records.bulkPut(normalized.map(m => ({ key: recordKey(accountId, m.kind, m.entity.id), accountId, kind: m.kind, entityId: m.entity.id, revision: 1, data: m.entity })));
    for (let index = 0; index < normalized.length; index += CLOUD_BATCH_SIZE) {
      await db.commands.add({ id: uid(), accountId, mutations: normalized.slice(index, index + CLOUD_BATCH_SIZE), createdAt: stamp(), status: 'pending', schemaVersion: 1, rulesVersion: 1 });
    }
    await snapshotWithinTransaction(accountId, (await loadGame(accountId))!);
  });
}
export function validateCloudRecord(input: CloudRecord): CloudRecord {
  const data = parseEntity(input.kind, input.data);
  if (input.entityId !== data.id || input.revision !== data.revision || !Number.isSafeInteger(input.sequence) || input.sequence < 1 || typeof input.commandId !== 'string') throw new Error('A cloud record could not be validated. Local work has been preserved.');
  return { ...input, data };
}
async function putCanonical(accountId: string, records: CloudRecord[], protectedKeys: Set<string>) {
  for (const input of records) {
    const remote = validateCloudRecord(input); const key = recordKey(accountId, remote.kind, remote.entityId);
    const current = await db.cloudRecords.get(key);
    if (current && current.sequence > remote.sequence) continue;
    await db.cloudRecords.put({ ...remote, key, accountId });
    if (!protectedKeys.has(cloudKey(remote.kind, remote.entityId))) await db.records.put({ key, accountId, kind: remote.kind, entityId: remote.entityId, data: remote.data, revision: remote.revision });
  }
}
export async function applyCloudPage(accountId: string, page: CloudPage): Promise<void> {
  firebaseUid(accountId);
  if (!Number.isSafeInteger(page.cursor) || page.cursor < 0 || page.records.some(record => record.sequence > page.cursor)) throw new Error('The cloud history could not be verified. Local work is unchanged.');
  await db.transaction('rw', db.records, db.commands, db.cloudRecords, db.syncMetadata, async () => {
    const queued = await pendingCommands(accountId);
    const protectedKeys = new Set(queued.flatMap(c => c.mutations.map(m => cloudKey(m.kind, m.entity.id))));
    await putCanonical(accountId, page.records, protectedKeys);
    const game = await loadGame(accountId); if (game) validateGame(game);
    const meta = await db.syncMetadata.get(accountId);
    await db.syncMetadata.put({ ...meta, accountId, cursor: Math.max(meta?.cursor || 0, page.cursor), accessGranted: true, lastSyncedAt: stamp(), error: '' });
  });
}
export async function applyCloudResult(accountId: string, command: Command, result: CloudResult): Promise<void> {
  if (command.accountId !== accountId) throw new Error('A command belongs to another account.');
  firebaseUid(accountId);
  await db.transaction('rw', db.records, db.commands, db.cloudRecords, db.syncMetadata, db.syncConflicts, async () => {
    const current = await db.commands.get([accountId, command.id]); if (!current || current.status === 'synced' || current.status === 'failed') return;
    if (result.status === 'conflicted') {
      await db.commands.update([accountId, command.id], { status: 'conflict', error: 'This record changed on another device.' });
      for (const conflict of result.conflicts) {
        const mutation = command.mutations.find(m => cloudKey(m.kind, m.entity.id) === cloudKey(conflict.kind, conflict.entityId)); if (!mutation) continue;
        if (conflict.remote) await putCanonical(accountId, [conflict.remote], new Set([cloudKey(conflict.kind, conflict.entityId)]));
        const key = `${accountId}\u0000${command.id}\u0000${cloudKey(conflict.kind, conflict.entityId)}`;
        await db.syncConflicts.put({ key, accountId, commandId: command.id, kind: conflict.kind, entityId: conflict.entityId, local: mutation.entity, remote: conflict.remote, createdAt: stamp() });
      }
      return;
    }
    const keys = command.mutations.map(m => cloudKey(m.kind, m.entity.id)).sort();
    if (result.receipt.id !== command.id || result.receipt.status !== 'accepted' || !Number.isSafeInteger(result.receipt.sequence) || result.receipt.sequence < 1 || JSON.stringify([...result.receipt.keys].sort()) !== JSON.stringify(keys) || JSON.stringify(result.records.map(record => cloudKey(record.kind, record.entityId)).sort()) !== JSON.stringify(keys)) throw new Error('The saved change could not be verified. Pending work is preserved.');
    await db.commands.update([accountId, command.id], { status: 'synced', error: undefined });
    const protectedKeys = new Set((await pendingCommands(accountId)).flatMap(c => c.mutations.map(m => cloudKey(m.kind, m.entity.id))));
    await putCanonical(accountId, result.records, protectedKeys);
    const game = await loadGame(accountId); if (game) validateGame(game);
  });
}
export async function unresolvedConflicts(accountId: string): Promise<SyncConflict[]> {
  return db.syncConflicts.where('accountId').equals(accountId).filter(c => !c.resolvedAt).toArray();
}
export type ConflictChoices = Record<string, 'local' | 'cloud' | 'both'>;
export type ConflictReviews = Record<string, { localRevision: number; remoteSequence: number }>;
export async function resolveCloudConflicts(accountId: string, choices: ConflictChoices, reviewed?: ConflictReviews): Promise<void> {
  firebaseUid(accountId);
  let needsMoreReview = false;
  await db.transaction('rw', [db.records, db.commands, db.cloudRecords, db.syncConflicts, db.snapshots, db.drafts], async () => {
    const conflicts = await unresolvedConflicts(accountId);
    if (!conflicts.length) return;
    if (conflicts.some(c => !choices[c.key])) throw new Error('Choose a version for every conflict. Both versions are still preserved.');
    if (reviewed) for (const conflict of conflicts) {
      const key = recordKey(accountId, conflict.kind, conflict.entityId); const local = await db.records.get(key); const remote = await db.cloudRecords.get(key) || conflict.remote;
      if (!reviewed[conflict.key] || reviewed[conflict.key].localRevision !== (local?.revision || 0) || reviewed[conflict.key].remoteSequence !== (remote?.sequence || 0)) throw new Error('These versions changed while you were reviewing. Review the newer copies before applying a choice.');
    }
    const queue = await pendingCommands(accountId);
    // Preserve independent pending commands and their original compare-and-set
    // revisions. Rebasing the entire queue would hide unrelated competing edits.
    const affectedIds = new Set(conflicts.map(conflict => conflict.commandId));
    const affectedKeys = new Set<string>();
    let expanded = true;
    while (expanded) {
      expanded = false;
      for (const command of queue) {
        const keys = command.mutations.map(m => cloudKey(m.kind, m.entity.id));
        if (affectedIds.has(command.id) || keys.some(key => affectedKeys.has(key))) {
          if (!affectedIds.has(command.id)) { affectedIds.add(command.id); expanded = true; }
          for (const key of keys) if (!affectedKeys.has(key)) { affectedKeys.add(key); expanded = true; }
        }
      }
    }
    const affected = queue.filter(command => affectedIds.has(command.id));
    const firstByKey = new Map<string, { command: Command; mutation: Command['mutations'][number] }>();
    for (const command of affected) for (const mutation of command.mutations) { const key = cloudKey(mutation.kind, mutation.entity.id); if (!firstByKey.has(key)) firstByKey.set(key, { command, mutation }); }
    const covered = new Map<string, ConflictChoices[string]>();
    for (const conflict of conflicts) { const key = cloudKey(conflict.kind, conflict.entityId); if (covered.has(key) && covered.get(key) !== choices[conflict.key]) throw new Error('Choose the same version for competing edits to the same record.'); covered.set(key, choices[conflict.key]); }
    for (const [key, { command, mutation }] of firstByKey) {
      const record = recordKey(accountId, mutation.kind, mutation.entity.id); const remote = await db.cloudRecords.get(record);
      if (!covered.has(key) && (remote?.revision || 0) !== (mutation.expectedRevision || 0)) {
        const local = await db.records.get(record);
        await db.syncConflicts.put({ key: `${accountId}\u0000${command.id}\u0000${key}`, accountId, commandId: command.id, kind: mutation.kind, entityId: mutation.entity.id, local: local?.data || mutation.entity, remote: remote || null, createdAt: stamp() });
        await db.commands.update([accountId, command.id], { status: 'conflict', error: 'Another record in this change also needs review.' });
        needsMoreReview = true;
      }
    }
    if (needsMoreReview) return;
    const game = await loadGame(accountId); if (!game) throw new Error('Open this account before resolving changes.');
    await snapshotWithinTransaction(accountId, game);
    const desiredKeys = new Map(affected.flatMap(c => c.mutations.map(m => [cloudKey(m.kind, m.entity.id), m] as const)));
    const copies: { kind: 'journals'; entity: GameEntity }[] = [];
    for (const conflict of conflicts) {
      const choice = choices[conflict.key]; const key = recordKey(accountId, conflict.kind, conflict.entityId);
      const remote = await db.cloudRecords.get(key) || conflict.remote;
      const local = await db.records.get(key);
      if (choice === 'both') {
        if (conflict.kind !== 'journals' || !local || !remote) throw new Error('Keeping both as separate records is available for journal entries.');
        copies.push({ kind: 'journals', entity: { ...local.data, id: uid(), revision: 0, createdAt: stamp(), updatedAt: stamp() } });
      }
      if (choice === 'cloud' || choice === 'both') {
        desiredKeys.delete(cloudKey(conflict.kind, conflict.entityId));
        if (remote) await db.records.put({ key, accountId, kind: remote.kind, entityId: remote.entityId, revision: remote.revision, data: remote.data });
        else await db.records.delete(key);
      }
      await db.syncConflicts.update(conflict.key, { resolvedAt: stamp() });
    }
    for (const c of affected) await db.commands.update([accountId, c.id], { status: 'failed', error: 'Replaced by the explicitly resolved version. The original command is retained in history.' });
    const mutations: Command['mutations'] = [];
    for (const m of [...desiredKeys.values(), ...copies]) {
      const key = recordKey(accountId, m.kind, m.entity.id); const local = await db.records.get(key);
      const remote = await db.cloudRecords.get(key); const value = copies.includes(m as typeof copies[number]) ? m.entity : local?.data;
      if (!value) continue;
      const entity = parseEntity(m.kind, { ...value, revision: (remote?.revision || 0) + 1, createdAt: remote?.data.createdAt || value.createdAt, updatedAt: stamp() });
      mutations.push({ kind: m.kind, entity, expectedRevision: remote?.revision || 0 });
      await db.records.put({ key, accountId, kind: m.kind, entityId: entity.id, revision: entity.revision, data: entity });
    }
    validateGame(await loadGame(accountId));
    for (let index = 0; index < mutations.length; index += 400) await db.commands.add({ id: uid(), accountId, mutations: mutations.slice(index, index + 400), createdAt: stamp(), status: 'pending', schemaVersion: 1, rulesVersion: 1 });
  });
  if (needsMoreReview) throw new Error('Another record in this change also changed elsewhere. Review its preserved versions before applying your choices.');
}
export async function synchronizeOnce(accountId: string, adapter: CloudAdapter): Promise<'synced' | 'conflict'> {
  firebaseUid(accountId);
  const metadata = await db.syncMetadata.get(accountId);
  await applyCloudPage(accountId, await adapter.pull(metadata?.cursor || 0));
  if ((await unresolvedConflicts(accountId)).length) return 'conflict';
  for (const command of await pendingCommands(accountId)) {
    const result = await adapter.push(command);
    await applyCloudResult(accountId, command, result);
    if (result.status === 'conflicted') return 'conflict';
  }
  const current = await db.syncMetadata.get(accountId);
  await applyCloudPage(accountId, await adapter.pull(current?.cursor || 0));
  return 'synced';
}
