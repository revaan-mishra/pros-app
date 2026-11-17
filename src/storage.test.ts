import 'fake-indexeddb/auto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  clearDraft, commitMutations, db, deleteAccountData, exportBackup, importBackup,
  initializeGame, listCommands, listSnapshots, loadDraft, loadGame, previewImport,
  restoreSnapshot, saveDraft, saveSnapshot, StorageConflictError, undoCommand, validateBackup,
} from './storage';
import type { Activity, GameData } from './types';

const stamp = '2026-11-12T08:00:00.000Z';
const base = (id: string) => ({ id, revision: 0, createdAt: stamp, updatedAt: stamp });
function fixture(): GameData {
  return {
    profile: {
      ...base('profile'), displayName: 'Test adventurer', avatarColor: '#5e9a86', avatarStyle: 'wanderer',
      equipment: { emblem: '', accessory: '', outfit: '' }, timeZone: 'Asia/Kolkata',
      onboardingStep: 3, onboardingComplete: true, lastSkillId: 'guitar', motion: 'system', sound: false,
      theme: 'dark', lastOpenedAt: stamp, celebrationIds: [],
    },
    skills: [{ ...base('guitar'), name: 'Guitar', description: 'Practice music', category: 'Creative',
      regionId: 'atelier', affinities: [{ attribute: 'creativity', percent: 70 }, { attribute: 'discipline', percent: 30 }],
      icon: 'Music', equipped: true, archived: false }],
    activities: [], quests: [], projects: [], outputs: [], books: [], journals: [], focusSessions: [],
  };
}
function activity(id = 'practice', seconds = 1500): Activity {
  return { ...base(id), title: 'Practice', seconds,
    allocations: [{ skillId: 'guitar', percent: 100, regionId: 'atelier', affinities: [{ attribute: 'creativity', percent: 70 }, { attribute: 'discipline', percent: 30 }] }],
    occurredAt: stamp, localDate: '2026-11-12', timeZone: 'Asia/Kolkata', note: '', source: 'manual' };
}

beforeEach(async () => {
  if (!db.isOpen()) await db.open();
  await Promise.all(db.tables.map(table=>table.clear()));
});
afterAll(() => db.close());

describe('local persistence and account isolation', () => {
  it('preserves 100 acknowledged writes through database close/reopen cycles', async () => {
    await initializeGame('local:alice', fixture());
    for (let index = 0; index < 100; index++) {
      await commitMutations('local:alice', [{ kind: 'activities', entity: activity(`practice-${index}`, 60 + index) }]);
      db.close(); await db.open();
      const restored = await loadGame('local:alice');
      expect(restored?.activities.filter(item => !item.deleted)).toHaveLength(index + 1);
      expect(restored?.activities.find(item => item.id === `practice-${index}`)?.seconds).toBe(60 + index);
    }
  });

  it('handles 1,000 replayed deliveries with exactly one record and command', async () => {
    await initializeGame('local:alice', fixture());
    for (let index = 0; index < 1000; index++) {
      const command = await commitMutations('local:alice', [{ kind: 'activities', entity: activity() }], 'stable-command');
      expect(command.id).toBe('stable-command');
    }
    expect((await loadGame('local:alice'))?.activities).toHaveLength(1);
    expect(await listCommands('local:alice')).toHaveLength(1);
  });

  it('isolates identical record IDs and draft names between accounts', async () => {
    await initializeGame('local:alice', fixture());
    await initializeGame('local:bob', { ...fixture(), profile: { ...fixture().profile, displayName: 'Bob' } });
    await commitMutations('local:alice', [{ kind: 'activities', entity: activity() }], 'same-id');
    await commitMutations('local:bob', [{ kind: 'activities', entity: activity('practice', 300) }], 'same-id');
    await saveDraft('local:alice', 'journal', { text: 'Private Alice note' });
    await saveDraft('local:bob', 'journal', { text: 'Private Bob note' });
    expect((await loadGame('local:alice'))?.activities[0].seconds).toBe(1500);
    expect((await loadGame('local:bob'))?.activities[0].seconds).toBe(300);
    expect(await loadDraft('local:alice', 'journal')).toEqual({ text: 'Private Alice note' });
    await clearDraft('local:alice', 'journal');
    expect(await loadDraft('local:alice', 'journal')).toBeNull();
    expect(await loadDraft('local:bob', 'journal')).toEqual({ text: 'Private Bob note' });
    await deleteAccountData('local:alice');
    expect(await loadGame('local:alice')).toBeNull();
    expect((await loadGame('local:bob'))?.profile.displayName).toBe('Bob');
  });

  it('never replaces an initialized profile with seed content', async () => {
    await initializeGame('local:alice', fixture());
    await commitMutations('local:alice', [{ kind: 'activities', entity: activity() }]);
    await initializeGame('local:alice', { ...fixture(), profile: { ...fixture().profile, displayName: 'Replacement' } });
    expect((await loadGame('local:alice'))?.profile.displayName).toBe('Test adventurer');
    expect((await loadGame('local:alice'))?.activities).toHaveLength(1);
  });

  it('rejects malformed namespaces', async () => {
    await expect(loadGame('../alice')).rejects.toThrow('Invalid account');
    await expect(saveDraft('alice', 'journal', 'x')).rejects.toThrow('Invalid account');
  });
});

describe('transaction integrity and undo', () => {
  it('rolls back an entire batch when its final entity fails validation', async () => {
    await initializeGame('local:alice', fixture());
    await expect(commitMutations('local:alice', [
      { kind: 'activities', entity: activity('valid') },
      { kind: 'activities', entity: activity('invalid', -60) },
    ])).rejects.toThrow();
    expect((await loadGame('local:alice'))?.activities).toHaveLength(0);
    expect(await listCommands('local:alice')).toHaveLength(0);
  });

  it('rejects unknown skill references atomically', async () => {
    await initializeGame('local:alice', fixture());
    const unknown = activity(); unknown.allocations[0].skillId = 'missing-skill';
    await expect(commitMutations('local:alice', [{ kind: 'activities', entity: unknown }])).rejects.toThrow('unknown skill');
    expect((await loadGame('local:alice'))?.activities).toHaveLength(0);
  });

  it('detects stale revisions without overwriting newer work', async () => {
    await initializeGame('local:alice', fixture());
    await commitMutations('local:alice', [{ kind: 'activities', entity: activity() }]);
    const first = (await loadGame('local:alice'))!.activities[0];
    await commitMutations('local:alice', [{ kind: 'activities', entity: { ...first, title: 'Newer title' } }]);
    await expect(commitMutations('local:alice', [{ kind: 'activities', entity: { ...first, title: 'Stale title' } }])).rejects.toBeInstanceOf(StorageConflictError);
    expect((await loadGame('local:alice'))?.activities[0].title).toBe('Newer title');
  });

  it('undoes creation with a tombstone and undoes an edit with the original stable ID', async () => {
    await initializeGame('local:alice', fixture());
    const created = await commitMutations('local:alice', [{ kind: 'activities', entity: activity() }]);
    const first = (await loadGame('local:alice'))!.activities[0];
    const edited = await commitMutations('local:alice', [{ kind: 'activities', entity: { ...first, seconds: 3000 } }]);
    await undoCommand('local:alice', edited.id);
    const after = (await loadGame('local:alice'))!.activities[0];
    expect(after.seconds).toBe(1500); expect(after.id).toBe('practice');
    await expect(undoCommand('local:alice', created.id)).rejects.toBeInstanceOf(StorageConflictError);
    const another = await commitMutations('local:alice', [{ kind: 'activities', entity: activity('another') }]);
    await undoCommand('local:alice', another.id);
    expect((await loadGame('local:alice'))!.activities.find(item => item.id === 'another')?.deleted).toBe(true);
    await undoCommand('local:alice', another.id);
    expect((await loadGame('local:alice'))!.activities.filter(item => item.id === 'another')).toHaveLength(1);
  });
});

describe('backup and recovery', () => {
  it('round trips records and pending work into a new namespace', async () => {
    await initializeGame('local:alice', fixture());
    await commitMutations('local:alice', [{ kind: 'activities', entity: activity() }]);
    const exported = await exportBackup('local:alice');
    expect(exported.pendingCommands).toHaveLength(1);
    expect(JSON.stringify(exported)).not.toContain('accessToken');
    const preview = await previewImport('local:restored', exported);
    expect(preview.newRecords).toBe(3); expect(preview.conflicts).toEqual([]);
    await importBackup('local:restored', exported);
    const restored = await loadGame('local:restored');
    expect(restored?.activities[0].seconds).toBe(1500);
    expect(restored?.profile.displayName).toBe('Test adventurer');
    expect((await listCommands('local:restored')).every(item => item.accountId === 'local:restored')).toBe(true);
    await importBackup('local:restored', exported);
    expect((await loadGame('local:restored'))?.activities).toHaveLength(1);
  });

  it('requires explicit choices for conflicting records and snapshots before changing them', async () => {
    await initializeGame('local:alice', fixture());
    await commitMutations('local:alice', [{ kind: 'activities', entity: activity() }]);
    const exported = await exportBackup('local:alice');
    exported.data.activities[0].seconds = 3000;
    const preview = await previewImport('local:alice', exported);
    expect(preview.conflicts.map(item => item.key)).toEqual(['activities:practice']);
    await expect(importBackup('local:alice', exported)).rejects.toBeInstanceOf(StorageConflictError);
    expect((await loadGame('local:alice'))?.activities[0].seconds).toBe(1500);
    await importBackup('local:alice', exported, { 'activities:practice': 'use-backup' });
    expect((await loadGame('local:alice'))?.activities[0].seconds).toBe(3000);
    expect((await listSnapshots('local:alice')).length).toBeGreaterThan(1);
  });

  it('retains only seven snapshots and restores deleted or later records consistently', async () => {
    await initializeGame('local:alice', fixture());
    await commitMutations('local:alice', [{ kind: 'activities', entity: activity() }]);
    const target = await saveSnapshot('local:alice');
    await commitMutations('local:alice', [{ kind: 'activities', entity: activity('later') }]);
    await restoreSnapshot('local:alice', target.id);
    const restored = (await loadGame('local:alice'))!;
    expect(restored.activities.find(item => item.id === 'practice')?.deleted).not.toBe(true);
    expect(restored.activities.find(item => item.id === 'later')?.deleted).toBe(true);
    for (let index = 0; index < 12; index++) await saveSnapshot('local:alice');
    expect(await listSnapshots('local:alice')).toHaveLength(7);
    await initializeGame('local:bob', fixture());
    await expect(restoreSnapshot('local:bob', target.id)).rejects.toThrow('does not belong');
  });

  it('rejects unknown fields, credentials, duplicate IDs, and corrupted references', async () => {
    await initializeGame('local:alice', fixture());
    const exported = await exportBackup('local:alice');
    expect(() => validateBackup({ ...exported, accessToken: 'must-not-be-imported' })).toThrow();
    expect(() => validateBackup({ ...exported, version: 999 })).toThrow();
    const duplicate = structuredClone(exported); duplicate.data.skills.push(duplicate.data.skills[0]);
    expect(() => validateBackup(duplicate)).toThrow('Duplicate skills');
    const bad = structuredClone(exported); bad.data.activities.push(activity()); bad.data.activities[0].allocations[0].skillId = 'unknown';
    expect(() => validateBackup(bad)).toThrow('unknown skill');
  });

  it('restores an archive larger than one normal command', async () => {
    const initial = fixture();
    initial.activities = Array.from({ length: 2100 }, (_, index) => activity(`large-${index}`, 60));
    await initializeGame('local:alice', initial);
    const exported = await exportBackup('local:alice');
    await importBackup('local:restored', exported);
    expect((await loadGame('local:restored'))?.activities).toHaveLength(2100);
  });
});


describe('account removal with cached synchronization',()=>{
  it('removes only the requested account’s canonical cache, cursor and competing edits',async()=>{
    for(const accountId of ['firebase:alice','firebase:bob']){
      await initializeGame(accountId,fixture());
      await db.syncMetadata.put({accountId,cursor:5,accessGranted:true});
      await db.cloudRecords.put({key:`${accountId}\u0000skills\u0000guitar`,accountId,kind:'skills',entityId:'guitar',data:{...fixture().skills[0],revision:1},revision:1,sequence:5,commandId:'test'});
      await db.syncConflicts.put({key:`${accountId}-conflict`,accountId,commandId:'test',kind:'skills',entityId:'guitar',local:fixture().skills[0],remote:null,createdAt:stamp});
    }
    await deleteAccountData('firebase:alice');
    expect(await loadGame('firebase:alice')).toBeNull();
    for(const table of [db.cloudRecords,db.syncMetadata,db.syncConflicts]){
      expect(await table.where('accountId').equals('firebase:alice').count()).toBe(0);
      expect(await table.where('accountId').equals('firebase:bob').count()).toBe(1);
    }
    expect(await loadGame('firebase:bob')).not.toBeNull();
  });
});
