import 'fake-indexeddb/auto';
import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { assertFails, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDocFromServer, setDoc, setLogLevel, type Firestore } from 'firebase/firestore';
import { db, commitMutations, loadGame } from '../src/storage';
import { makeAllocations, seedGame } from '../src/domain';
import { createFirestoreAdapter } from '../src/cloud/firestore-adapter';
import { pendingCommands, resolveCloudConflicts, startCloudProfile, synchronizeOnce, unresolvedConflicts } from '../src/cloud/local-sync';
import type { Affinity, Command } from '../src/types';

const account = 'firebase:alice';
let environment: RulesTestEnvironment;
beforeAll(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Run with the Firestore emulator and demo-pros-rules project. No production connections are permitted.');
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
  setLogLevel('silent');
  environment = await initializeTestEnvironment({ projectId: 'demo-pros-rules', firestore: { host, port: Number(port), rules: await readFile('firestore.rules', 'utf8') } });
});
beforeEach(async () => {
  await environment.clearFirestore(); if (!db.isOpen()) await db.open(); await Promise.all(db.tables.map(table => table.clear()));
  await environment.withSecurityRulesDisabled(async context => { await setDoc(doc(context.firestore(), 'access', 'alice'), { enabled: true }); await setDoc(doc(context.firestore(), 'access', 'bob'), { enabled: true }); });
});
afterAll(async () => { db.close(); await environment?.cleanup(); });
function connection(uid = 'alice') { return environment.authenticatedContext(uid, { email_verified: true }).firestore() as unknown as Firestore; }
async function setup() {
  const store = connection(); const adapter = await createFirestoreAdapter(account, { store, assertIdentity() {} });
  await startCloudProfile(account, seedGame('empty')); await synchronizeOnce(account, adapter); return { store, adapter };
}
describe('real Firestore adapter against private security rules', () => {
  it.each([2, 8])('round-trips %i allocations with all six fractional and zero historical affinities', async count => {
    const { adapter, store } = await setup(); const game = (await loadGame(account))!, stamp = new Date().toISOString();
    const affinities: Affinity[] = [{ attribute: 'charisma', percent: 0 }, { attribute: 'creativity', percent: 12.5 }, { attribute: 'discipline', percent: 37.5 }, { attribute: 'wisdom', percent: 0 }, { attribute: 'intelligence', percent: 25 }, { attribute: 'strength', percent: 25 }];
    const allocations = game.skills.slice(0, count).map((skill, index) => ({ skillId: skill.id, percent: 100 / count, regionId: skill.regionId, affinities: index % 2 ? [...affinities].reverse() : affinities }));
    await commitMutations(account, [{ kind: 'activities', entity: { id: 'full-affinities', revision: 0, createdAt: stamp, updatedAt: stamp, title: 'Historical practice', seconds: 1200, occurredAt: stamp, localDate: stamp.slice(0, 10), timeZone: 'UTC', note: '', source: 'manual', allocations } }]);
    await synchronizeOnce(account, adapter); expect(await pendingCommands(account)).toHaveLength(0);
    expect((await adapter.pull(0)).records.find(record => record.kind === 'activities')?.data).toMatchObject({ allocations });
    const wire = (await getDocFromServer(doc(store, 'users', 'alice', 'records', 'activities:full-affinities'))).data();
    expect(wire?.wireVersion).toBe(3); expect(typeof wire?.data.allocations).toBe('string');
  });
  it('initializes the authored catalog and idempotently acknowledges the same activity command', async () => {
    const { store, adapter } = await setup(); const data = (await loadGame(account))!;
    expect(data.skills).toHaveLength(26); expect(await pendingCommands(account)).toHaveLength(0);
    const stamp = new Date().toISOString();
    const command = await commitMutations(account, [{ kind: 'activities', entity: { id: 'practice', revision: 0, createdAt: stamp, updatedAt: stamp, title: 'Practice', seconds: 1500, occurredAt: stamp, localDate: stamp.slice(0, 10), timeZone: 'UTC', note: '', source: 'manual', allocations: makeAllocations(data.skills, 'frontend') } }]);
    const first = await adapter.push(command); const replay = await adapter.push(command);
    expect(first.status).toBe('accepted'); expect(replay).toEqual(first);
    expect((await getDocFromServer(doc(store, 'users', 'alice', 'state', 'main'))).data()?.sequence).toBe(2);
    await synchronizeOnce(account, adapter); expect(await pendingCommands(account)).toHaveLength(0); expect((await loadGame(account))!.activities).toHaveLength(1);
  });
  it('preserves competing profile edits until reviewed and converges after resolution', async () => {
    const { adapter } = await setup(); const original = (await loadGame(account))!.profile;
    await commitMutations(account, [{ kind: 'profile', entity: { ...original, displayName: 'This device' } }]);
    const other = await createFirestoreAdapter(account, { store: connection(), assertIdentity() {} });
    const remote: Command = { id: 'other-device', accountId: account, mutations: [{ kind: 'profile', entity: { ...original, revision: original.revision + 1, displayName: 'Other device', updatedAt: new Date().toISOString() }, expectedRevision: original.revision }], createdAt: new Date().toISOString(), status: 'pending', schemaVersion: 1, rulesVersion: 1 };
    expect((await other.push(remote)).status).toBe('accepted');
    expect(await synchronizeOnce(account, adapter)).toBe('conflict'); expect((await loadGame(account))!.profile.displayName).toBe('This device');
    const conflict = (await unresolvedConflicts(account))[0]; expect(conflict.remote?.data).toMatchObject({ displayName: 'Other device' });
    await resolveCloudConflicts(account, { [conflict.key]: 'local' }, { [conflict.key]: { localRevision: (await loadGame(account))!.profile.revision, remoteSequence: conflict.remote!.sequence } });
    await synchronizeOnce(account, adapter); expect(await pendingCommands(account)).toHaveLength(0);
    expect((await other.pull(0)).records.find(record => record.kind === 'profile')?.data).toMatchObject({ displayName: 'This device' });
  });
  it('keeps a 100-objective project and its 100 linked actions in one acknowledged command', async () => {
    const { adapter } = await setup(); const stamp = new Date().toISOString();
    const objectives = Array.from({ length: 100 }, (_, index) => ({ id: `objective-${index}`, title: `Step ${index + 1}`, completed: false, required: true }));
    const project = { id: 'long-project', revision: 0, createdAt: stamp, updatedAt: stamp, title: 'A substantial project', description: '', outputCriterion: 'Finished work', skillId: 'frontend', regionId: 'foundry' as const, status: 'active' as const, archived: false, effortTargetSeconds: 3600, objectives };
    const command = await commitMutations(account, [{ kind: 'projects', entity: project }, ...objectives.map(objective => ({ kind: 'quests' as const, entity: { id: `quest-${objective.id}`, revision: 0, createdAt: stamp, updatedAt: stamp, title: objective.title, skillId: 'frontend', projectId: project.id, objectiveId: objective.id, status: 'pending' as const, archived: false, priority: false, recurrence: 'none' as const, note: '' } }))]);
    expect(command.mutations).toHaveLength(101); await synchronizeOnce(account, adapter);
    expect(await pendingCommands(account)).toHaveLength(0); const records = (await adapter.pull(0)).records;
    expect(records.filter(record => record.kind === 'quests')).toHaveLength(100); expect(records.find(record => record.kind === 'projects')?.data).toMatchObject({ objectives });
  });
  it('denies cross-account records and stops an adapter when identity changes', async () => {
    const { store } = await setup(); const bob = connection('bob');
    await assertFails(getDocFromServer(doc(bob, 'users', 'alice', 'records', 'profile')));
    let identity = 'alice';
    const adapter = await createFirestoreAdapter(account, { store, assertIdentity() { if (identity !== 'alice') throw new Error('Identity changed'); } });
    identity = 'bob'; await expect(adapter.pull(0)).rejects.toThrow('Identity changed');
    const bad = { accountId: 'firebase:bob' } as Command;
    identity = 'alice'; await expect(adapter.push(bad)).rejects.toThrow('another account');
  });
  it('freezes synchronization during interrupted deletion', async () => {
    const { store, adapter } = await setup(); const state = (await getDocFromServer(doc(store, 'users', 'alice', 'state', 'main'))).data();
    await setDoc(doc(store, 'users', 'alice', 'state', 'main'), { ...state, deleting: true });
    await expect(adapter.pull(0)).rejects.toThrow('deletion is in progress');
    const profile = (await loadGame(account))!.profile;
    await commitMutations(account, [{ kind: 'profile', entity: { ...profile, displayName: 'Pending work' } }]);
    const command = (await pendingCommands(account))[0]; await expect(adapter.push(command)).rejects.toThrow('deletion is in progress');
    expect(await pendingCommands(account)).toHaveLength(1); expect((await loadGame(account))!.profile.displayName).toBe('Pending work');
  });
});
