import 'fake-indexeddb/auto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { seedGame } from '../domain';
import { commitMutations, db, exportBackup, importBackup, initializeGame, listSnapshots, loadDraft, loadGame, previewImport, saveDraft } from '../storage';

const stamp = '2026-11-16T04:00:00.000Z';
function fixture(revision: number, title = 'Current project') {
  const data = seedGame('empty', 'Test');
  data.projects.push({ id: 'project', revision, createdAt: stamp, updatedAt: stamp, title, description: '', outputCriterion: 'A finished result', skillId: 'acoustic-guitar', regionId: 'atelier', status: 'active', archived: false, effortTargetSeconds: 60, objectives: [] });
  return data;
}
beforeEach(async () => {
  if (!db.isOpen()) await db.open();
  await Promise.all([db.records.clear(), db.commands.clear(), db.undos.clear(), db.snapshots.clear(), db.drafts.clear(), db.cloudRecords.clear(), db.syncMetadata.clear(), db.syncConflicts.clear()]);
});

describe('backup review freshness', () => {
  it('rejects a record edited after review before snapshotting or importing', async () => {
    await initializeGame('local:target', fixture(1));
    const backup = await exportBackup('local:target');
    backup.data.projects[0].title = 'Backup version';
    const preview = await previewImport('local:target', backup);
    const current = (await loadGame('local:target'))!.projects[0];
    await commitMutations('local:target', [{ kind: 'projects', entity: { ...current, title: 'New local edit' } }]);
    const before = (await listSnapshots('local:target')).length;
    await expect(importBackup('local:target', backup, { 'projects:project': 'use-backup' }, preview)).rejects.toThrow('changed after this preview');
    expect((await loadGame('local:target'))!.projects[0].title).toBe('New local edit');
    expect(await listSnapshots('local:target')).toHaveLength(before);
  });

  it('detects draft content changes even when timestamps match', async () => {
    await initializeGame('local:target', fixture(1));
    await saveDraft('local:target', 'project:project', { title: 'Reviewed local draft' });
    const backup = await exportBackup('local:target');
    backup.drafts![0].value = { title: 'Backup draft' };
    const preview = await previewImport('local:target', backup);
    const key = 'local:target\u0000project:project';
    await db.drafts.update(key, { value: { title: 'New unreviewed draft' } });
    const before = (await listSnapshots('local:target')).length;
    await expect(importBackup('local:target', backup, { 'draft:project:project': 'use-backup' }, preview)).rejects.toThrow('changed after this preview');
    expect(await loadDraft('local:target', 'project:project')).toEqual({ title: 'New unreviewed draft' });
    expect(await listSnapshots('local:target')).toHaveLength(before);
  });

  it('imports an unchanged reviewed version and retains the optional three-argument API', async () => {
    await initializeGame('local:target', fixture(1));
    const backup = await exportBackup('local:target');
    backup.data.projects[0].title = 'Reviewed backup version';
    const preview = await previewImport('local:target', backup);
    expect(preview.reviewToken).toMatch(/^[0-9a-f]{16}$/);
    await importBackup('local:target', backup, { 'projects:project': 'use-backup' }, preview);
    expect((await loadGame('local:target'))!.projects[0].title).toBe('Reviewed backup version');
    await importBackup('local:other', backup, {});
    expect((await loadGame('local:other'))!.projects[0].title).toBe('Reviewed backup version');
  });
});
afterAll(() => db.close());

describe('imported draft revision safety', () => {
  it('marks a stale source revision 1 for review even when the restored record also becomes revision 1', async () => {
    const source = fixture(7);
    await initializeGame('local:source', source);
    const backup = await exportBackup('local:source');
    backup.drafts = [{ name: 'project:project', value: { recordId: 'project', baseRevision: 1, commandId: 'stale-draft', title: 'Old draft' }, updatedAt: stamp }];
    await importBackup('local:restored', backup);
    const restored = (await loadGame('local:restored'))!;
    const draft = (await loadDraft<{ baseRevision: number }>('local:restored', 'project:project'))!;
    expect(restored.projects[0].revision).toBe(1);
    expect(draft.baseRevision).toBe(-1);
    await commitMutations('local:restored', [{ kind: 'projects', entity: { ...restored.projects[0], title: 'Another saved edit' } }]);
    expect(draft.baseRevision).not.toBe((await loadGame('local:restored'))!.projects[0].revision);
  });

  it('requires review when the target keeps a different record whose revision equals the source draft revision', async () => {
    await initializeGame('local:source', fixture(7, 'Source version'));
    await initializeGame('local:target', fixture(7, 'Target version'));
    const backup = await exportBackup('local:source');
    backup.drafts = [{ name: 'project:project', value: { recordId: 'project', baseRevision: 7, commandId: 'source-draft', title: 'Source draft' }, updatedAt: stamp }];
    await importBackup('local:target', backup, { profile: 'keep-local', 'projects:project': 'keep-local' });
    expect((await loadGame('local:target'))!.projects[0].title).toBe('Target version');
    expect((await loadDraft<{ baseRevision: number }>('local:target', 'project:project'))!.baseRevision).toBe(-1);
  });

  it('rebases a proven current draft and keeps a review sentinel through another export/import', async () => {
    await initializeGame('local:source', fixture(7));
    const backup = await exportBackup('local:source');
    backup.drafts = [{ name: 'project:project', value: { recordId: 'project', baseRevision: 7, commandId: 'current-draft', title: 'Current draft' }, updatedAt: stamp }];
    await importBackup('local:target', backup);
    expect((await loadDraft<{ baseRevision: number }>('local:target', 'project:project'))!.baseRevision).toBe((await loadGame('local:target'))!.projects[0].revision);
    backup.drafts[0].value = { recordId: 'project', baseRevision: -1, commandId: 'stale-draft', title: 'Unreviewed draft' };
    await importBackup('local:review', backup);
    await importBackup('local:review-again', await exportBackup('local:review'));
    expect((await loadDraft<{ baseRevision: number }>('local:review-again', 'project:project'))!.baseRevision).toBe(-1);
  });
});
