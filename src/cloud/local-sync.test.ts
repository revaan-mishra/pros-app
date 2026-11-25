import 'fake-indexeddb/auto';
import { guardedCloudAdapter } from './sync-gate';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { db, commitMutations, loadGame, recordKey } from '../storage';
import { seedGame, projectGame, makeAllocations } from '../domain';
import { applyCloudPage, applyCloudResult, pendingCommands, resolveCloudConflicts, startCloudProfile, synchronizeOnce, unresolvedConflicts } from './local-sync';
import { cloudKey, type CloudAdapter, type CloudRecord, type CloudResult } from './types';
import type { Activity, Command, Journal } from '../types';

const account = 'firebase:alice';
const stamp = '2026-11-16T09:00:00.000Z';
const base = (id: string) => ({ id, revision: 0, createdAt: stamp, updatedAt: stamp });
class MemoryCloud implements CloudAdapter {
  records = new Map<string, CloudRecord>(); receipts = new Map<string, CloudResult>(); sequence = 0;
  async pull(cursor: number) { return { records: structuredClone([...this.records.values()].filter(r => r.sequence > cursor)), cursor: this.sequence }; }
  async push(command: Command): Promise<CloudResult> {
    if (command.accountId !== account) throw new Error('Wrong user');
    if (this.receipts.has(command.id)) return structuredClone(this.receipts.get(command.id)!);
    const conflicts = command.mutations.filter(m => (this.records.get(cloudKey(m.kind, m.entity.id))?.revision || 0) !== (m.expectedRevision || 0)).map(m => ({ kind: m.kind, entityId: m.entity.id, remote: this.records.get(cloudKey(m.kind, m.entity.id)) || null }));
    if (conflicts.length) return { status: 'conflicted', conflicts };
    const sequence = ++this.sequence;
    const records = command.mutations.map(m => ({ kind: m.kind, entityId: m.entity.id, data: structuredClone(m.entity), revision: m.entity.revision, sequence, commandId: command.id }));
    for (const r of records) this.records.set(cloudKey(r.kind, r.entityId), r);
    const result: CloudResult = { status: 'accepted', receipt: { id: command.id, fingerprint: 'test', sequence, keys: records.map(r => cloudKey(r.kind, r.entityId)), status: 'accepted' }, records };
    this.receipts.set(command.id, result); return structuredClone(result);
  }
}
beforeEach(async () => { if (!db.isOpen()) await db.open(); await Promise.all(db.tables.map(table => table.clear())); });
afterAll(() => db.close());
async function setup() { const cloud = new MemoryCloud(); await startCloudProfile(account, seedGame('empty')); await synchronizeOnce(account, cloud); return cloud; }
function activity(index: number): Activity { return { ...base(`activity-${index}`), title: 'Practice', seconds: 600, occurredAt: stamp, localDate: '2026-11-16', timeZone: 'UTC', source: 'manual', note: '', allocations: makeAllocations(seedGame('empty').skills, 'frontend') }; }

describe('private synchronization and conflict recovery', () => {
  it('acknowledges an in-flight commit but stops draining after pause or account closure',async()=>{
    const cloud=await setup();
    await commitMutations(account,[{kind:'activities',entity:activity(1)}],'first-operation');
    await commitMutations(account,[{kind:'activities',entity:activity(2)}],'second-operation');
    let stopped=false,pushes=0;
    const wrapped=guardedCloudAdapter({pull:cursor=>cloud.pull(cursor),async push(command){pushes++;const result=await cloud.push(command);stopped=true;return result;}},()=>stopped?'paused':null);
    await expect(synchronizeOnce(account,wrapped)).rejects.toThrow('stopped before');
    expect(pushes).toBe(1);expect(await pendingCommands(account)).toHaveLength(1);
    expect((await loadGame(account))!.activities).toHaveLength(2);
    await synchronizeOnce(account,cloud);expect(await pendingCommands(account)).toHaveLength(0);
    await expect(guardedCloudAdapter(cloud,()=> 'closed').pull(0)).rejects.toThrow('stopped before');
  });
  it('conserves 100 offline activities and survives 1,000 repeated deliveries', async () => {
    const cloud = await setup();
    for (let index = 0; index < 100; index++) await commitMutations(account, [{ kind: 'activities', entity: activity(index) }], `offline-${index}`);
    const command = (await pendingCommands(account))[0];
    for (let index = 0; index < 1000; index++) await cloud.push(command);
    await synchronizeOnce(account, cloud);
    expect((await pendingCommands(account)).length).toBe(0);
    expect((await loadGame(account))!.activities.length).toBe(100);
    expect(projectGame((await loadGame(account))!).xp).toBe(1000);
    expect([...cloud.records.values()].filter(r => r.kind === 'activities').length).toBe(100);
  });
  it('preserves both versions until an explicit decision, then retains both journal entries', async () => {
    const cloud = await setup();
    const journal: Journal = { ...base('page'), title: 'A page', body: 'Original', date: '2026-11-16' };
    await commitMutations(account, [{ kind: 'journals', entity: journal }]); await synchronizeOnce(account, cloud);
    const current = (await loadGame(account))!.journals[0];
    const key = cloudKey('journals', current.id); const remote = cloud.records.get(key)!;
    cloud.records.set(key, { ...remote, data: { ...remote.data, revision: remote.revision + 1, body: 'Other device' } as Journal, revision: remote.revision + 1, sequence: ++cloud.sequence });
    await commitMutations(account, [{ kind: 'journals', entity: { ...current, body: 'This device' } }]);
    expect(await synchronizeOnce(account, cloud)).toBe('conflict');
    const conflicts = await unresolvedConflicts(account);
    expect(conflicts.length).toBe(1);
    expect((await loadGame(account))!.journals[0].body).toBe('This device');
    await expect(resolveCloudConflicts(account, {})).rejects.toThrow('Choose a version');
    await resolveCloudConflicts(account, { [conflicts[0].key]: 'both' });
    expect((await loadGame(account))!.journals.map(j => j.body).sort()).toEqual(['Other device', 'This device']);
    await synchronizeOnce(account, cloud);
    expect(await unresolvedConflicts(account)).toHaveLength(0);
    expect([...cloud.records.values()].filter(r => r.kind === 'journals')).toHaveLength(2);
  });
  it('does not overwrite pending work with a download or cross account namespaces', async () => {
    const cloud = await setup(); const p = (await loadGame(account))!.profile;
    await commitMutations(account, [{ kind: 'profile', entity: { ...p, displayName: 'Local edit' } }]);
    const remote = cloud.records.get('profile')!;
    await applyCloudPage(account, { records: [{ ...remote, data: { ...p, revision: p.revision + 1, displayName: 'Remote edit' }, revision: p.revision + 1, sequence: ++cloud.sequence }], cursor: cloud.sequence });
    expect((await loadGame(account))!.profile.displayName).toBe('Local edit');
    expect(await loadGame('firebase:bob')).toBeNull();
    const queued = (await pendingCommands(account))[0];
    await expect(applyCloudResult('firebase:bob', queued, { status: 'conflicted', conflicts: [] })).rejects.toThrow('another account');
    await expect(synchronizeOnce('local:alice', cloud)).rejects.toThrow('Firebase account');
  });
  it('keeps dependent edits ordered when command timestamps are identical', async () => {
    const cloud = await setup(); const p = (await loadGame(account))!.profile;
    await commitMutations(account, [{ kind: 'profile', entity: { ...p, displayName: 'First' } }], 'z-first');
    const changed = (await loadGame(account))!.profile;
    await commitMutations(account, [{ kind: 'profile', entity: { ...changed, displayName: 'Second' } }], 'a-second');
    await db.commands.update([account, 'z-first'], { createdAt: stamp }); await db.commands.update([account, 'a-second'], { createdAt: stamp });
    await synchronizeOnce(account, cloud);
    expect(cloud.records.get('profile')!.data).toMatchObject({ displayName: 'Second' });
    expect(await pendingCommands(account)).toHaveLength(0);
  });
  it('rechecks the exact conflict versions reviewed before applying a choice', async () => {
    const cloud = await setup(); const profile = (await loadGame(account))!.profile;
    const original = cloud.records.get('profile')!;
    cloud.records.set('profile', { ...original, data: { ...profile, displayName: 'Remote', revision: profile.revision + 1 }, revision: profile.revision + 1, sequence: ++cloud.sequence });
    await commitMutations(account, [{ kind: 'profile', entity: { ...profile, displayName: 'Local' } }]);
    expect(await synchronizeOnce(account, cloud)).toBe('conflict');
    const conflict = (await unresolvedConflicts(account))[0];
    const reviewed = { [conflict.key]: { localRevision: (await loadGame(account))!.profile.revision, remoteSequence: conflict.remote!.sequence } };
    const current = (await loadGame(account))!.profile;
    await commitMutations(account, [{ kind: 'profile', entity: { ...current, displayName: 'Newer local' } }]);
    await expect(resolveCloudConflicts(account, { [conflict.key]: 'cloud' }, reviewed)).rejects.toThrow('versions changed');
    expect((await loadGame(account))!.profile.displayName).toBe('Newer local');
    expect(await unresolvedConflicts(account)).toHaveLength(1);
    const latest = await db.cloudRecords.get(recordKey(account, 'profile', profile.id));
    await resolveCloudConflicts(account, { [conflict.key]: 'cloud' }, { [conflict.key]: { localRevision: (await loadGame(account))!.profile.revision, remoteSequence: latest!.sequence } });
    expect((await loadGame(account))!.profile.displayName).toBe('Remote');
  });
  it('rejects malformed acknowledgements and pages without acknowledging pending work', async () => {
    const cloud = await setup();
    await commitMutations(account, [{ kind: 'activities', entity: activity(1) }]);
    const command = (await pendingCommands(account))[0]; const accepted = await cloud.push(command);
    if (accepted.status !== 'accepted') throw new Error('Expected accepted');
    await expect(applyCloudResult(account, command, { ...accepted, receipt: { ...accepted.receipt, id: 'different-command' } })).rejects.toThrow('could not be verified');
    expect(await pendingCommands(account)).toHaveLength(1);
    await expect(applyCloudPage(account, { records: accepted.records, cursor: -1 })).rejects.toThrow('could not be verified');
    expect((await loadGame(account))!.activities).toHaveLength(1);
    await applyCloudResult(account, command, accepted);
    expect(await pendingCommands(account)).toHaveLength(0);
  });
  it('keeps independent pending edits at their original revision until their own conflict is reviewed', async () => {
    const cloud = await setup();
    const journals: Journal[] = ['a', 'b'].map(id => ({ ...base(id), title: id, body: `Original ${id}`, date: '2026-11-16' }));
    await commitMutations(account, journals.map(entity => ({ kind: 'journals', entity }))); await synchronizeOnce(account, cloud);
    for (const journal of (await loadGame(account))!.journals) await commitMutations(account, [{ kind: 'journals', entity: { ...journal, body: `Local ${journal.id}` } }], `local-${journal.id}`);
    for (const id of ['a', 'b']) { const key = cloudKey('journals', id), remote = cloud.records.get(key)!; cloud.records.set(key, { ...remote, data: { ...remote.data, body: `Remote ${id}`, revision: remote.revision + 1 } as Journal, revision: remote.revision + 1, sequence: ++cloud.sequence }); }
    expect(await synchronizeOnce(account, cloud)).toBe('conflict');
    const first = (await unresolvedConflicts(account))[0]; expect(first.entityId).toBe('a');
    await resolveCloudConflicts(account, { [first.key]: 'local' });
    expect((await db.commands.get([account, 'local-b']))?.mutations[0].expectedRevision).toBe(1);
    expect(await synchronizeOnce(account, cloud)).toBe('conflict');
    const second = (await unresolvedConflicts(account))[0]; expect(second.entityId).toBe('b');
    expect((cloud.records.get(cloudKey('journals', 'b'))!.data as Journal).body).toBe('Remote b');
    await resolveCloudConflicts(account, { [second.key]: 'cloud' }); await synchronizeOnce(account, cloud);
    expect((await loadGame(account))!.journals.map(journal => journal.body).sort()).toEqual(['Local a', 'Remote b']);
  });
  it('surfaces a newly competing record inside the same atomic change before rebasing it', async () => {
    const cloud = await setup();
    const journals: Journal[] = ['a', 'b'].map(id => ({ ...base(id), title: id, body: `Original ${id}`, date: '2026-11-16' }));
    await commitMutations(account, journals.map(entity => ({ kind: 'journals', entity }))); await synchronizeOnce(account, cloud);
    await commitMutations(account, (await loadGame(account))!.journals.map(journal => ({ kind: 'journals', entity: { ...journal, body: `Local ${journal.id}` } })));
    const changeRemote = (id: string) => { const key = cloudKey('journals', id), remote = cloud.records.get(key)!; cloud.records.set(key, { ...remote, data: { ...remote.data, body: `Remote ${id}`, revision: remote.revision + 1 } as Journal, revision: remote.revision + 1, sequence: ++cloud.sequence }); };
    changeRemote('a'); expect(await synchronizeOnce(account, cloud)).toBe('conflict'); const first = (await unresolvedConflicts(account))[0];
    changeRemote('b'); const metadata = await db.syncMetadata.get(account); await applyCloudPage(account, await cloud.pull(metadata!.cursor));
    await expect(resolveCloudConflicts(account, { [first.key]: 'local' })).rejects.toThrow('Another record');
    expect((await unresolvedConflicts(account)).map(conflict => conflict.entityId).sort()).toEqual(['a', 'b']);
    expect((await loadGame(account))!.journals.map(journal => journal.body).sort()).toEqual(['Local a', 'Local b']);
    const conflicts = await unresolvedConflicts(account); await resolveCloudConflicts(account, Object.fromEntries(conflicts.map(conflict => [conflict.key, conflict.entityId === 'a' ? 'local' : 'cloud']))); await synchronizeOnce(account, cloud);
    expect((await loadGame(account))!.journals.map(journal => journal.body).sort()).toEqual(['Local a', 'Remote b']);
  });
  it('does not create a new world over a damaged partial local namespace', async () => {
    const skill = seedGame('empty').skills[0];
    await db.records.put({ key: recordKey(account, 'skills', skill.id), accountId: account, kind: 'skills', entityId: skill.id, revision: skill.revision, data: skill });
    await expect(startCloudProfile(account, seedGame('empty'))).rejects.toThrow('already has saved records');
    expect(await db.records.where('accountId').equals(account).count()).toBe(1);
  });
  it('converges two isolated device stores after 100 mixed offline writes', async () => {
    const cloud = await setup();
    type Device = Record<string, unknown[]>;
    const capture = async (): Promise<Device> => Object.fromEntries(await Promise.all(db.tables.map(async table => [table.name, structuredClone(await table.toArray())])));
    const restore = async (device: Device) => { await Promise.all(db.tables.map(table => table.clear())); for (const table of db.tables) if (device[table.name]?.length) await table.bulkPut(structuredClone(device[table.name])); };
    let deviceA = await capture();
    await restore({}); await synchronizeOnce(account, cloud); let deviceB = await capture();
    for (const [name, saved] of [['A', deviceA], ['B', deviceB]] as const) {
      await restore(saved);
      for (let index = 0; index < 50; index++) {
        if (index < 25) await commitMutations(account, [{ kind: 'activities', entity: { ...activity(index), id: `${name}-activity-${index}` } }]);
        else if (index < 40) await commitMutations(account, [{ kind: 'journals', entity: { ...base(`${name}-journal-${index}`), title: `${name} note`, body: `Entry ${index}`, date: '2026-11-16' } }]);
        else await commitMutations(account, [{ kind: 'quests', entity: { ...base(`${name}-quest-${index}`), title: `${name} action ${index}`, skillId: 'frontend', status: 'pending', recurrence: 'none', archived: false, priority: false, note: '' } }]);
      }
      if (name === 'A') deviceA = await capture(); else deviceB = await capture();
    }
    await restore(deviceA); await synchronizeOnce(account, cloud); deviceA = await capture();
    await restore(deviceB); await synchronizeOnce(account, cloud); const gameB = (await loadGame(account))!;
    await restore(deviceA); await synchronizeOnce(account, cloud); const gameA = (await loadGame(account))!;
    expect(projectGame(gameA)).toEqual(projectGame(gameB));
    expect(gameA.activities).toHaveLength(50); expect(gameA.journals).toHaveLength(30); expect(gameA.quests).toHaveLength(20);
    expect(gameA.activities.map(record => record.id).sort()).toEqual(gameB.activities.map(record => record.id).sort());
    expect(await pendingCommands(account)).toHaveLength(0);
  });
});
