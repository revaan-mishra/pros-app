import 'fake-indexeddb/auto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { projectGame, seedGame } from '../domain';
import { commitMutations, db, initializeGame, loadGame, undoCommand } from '../storage';
import { continuationMutations, questEditMutations, rescheduledQuest } from './record-commands';
import type { FocusSession, Quest } from '../types';

const at = '2026-11-16T04:00:00.000Z';
const base = (id: string) => ({ id, revision: 0, createdAt: at, updatedAt: at });
const session = (): FocusSession => ({ ...base('session'), skillId: 'acoustic-guitar', status: 'completed', targetSeconds: 60, confirmedSeconds: 60, segments: [], continuationNote: 'Continue the difficult passage' });
beforeEach(async () => {
  if (!db.isOpen()) await db.open();
  await Promise.all([db.records.clear(), db.commands.clear(), db.undos.clear(), db.snapshots.clear(), db.drafts.clear(), db.cloudRecords.clear(), db.syncMetadata.clear(), db.syncConflicts.clear()]);
});
afterAll(() => db.close());

describe('continuation recovery after undo', () => {
  it('reuses the tombstone revision and identity when converting again after Undo', async () => {
    const data = seedGame('empty'); data.focusSessions.push(session()); await initializeGame('local:alice', data);
    const first = await commitMutations('local:alice', continuationMutations(data, data.focusSessions[0], 'Continue here', true, 'Practice the difficult passage', at));
    await undoCommand('local:alice', first.id);
    const undone = (await loadGame('local:alice'))!; const removed = undone.quests.find(q => q.id === 'next-session')!;
    expect(removed.deleted).toBe(true); expect(undone.focusSessions[0].continuationQuestId).toBeUndefined();
    const mutations = continuationMutations(undone, undone.focusSessions[0], 'A revised continuation note', true, '', at);
    const restoring = mutations.find(m => m.kind === 'quests')!.entity as Quest;
    expect(restoring.id).toBe(removed.id); expect(restoring.revision).toBe(removed.revision);
    await commitMutations('local:alice', mutations);
    const restored = (await loadGame('local:alice'))!;
    expect(restored.quests.filter(q => !q.deleted)).toHaveLength(1);
    expect(restored.quests[0].title).toBe('Practice the difficult passage');
    expect(restored.focusSessions[0].continuationQuestId).toBe(removed.id);
    expect(projectGame(restored).xp).toBe(0);
  });
  it('restores an explicitly linked removed action without rewriting its history', () => {
    const data = seedGame('empty'); const focus = { ...session(), continuationQuestId: 'kept-action' };
    const quest: Quest = { ...base('kept-action'), revision: 3, title: 'Original next action', skillId: focus.skillId, status: 'completed', completedAt: at, archived: true, priority: false, recurrence: 'none', note: 'Original note', deleted: true };
    data.focusSessions.push(focus); data.quests.push(quest);
    const result = continuationMutations(data, focus, 'New focus note', true, 'Do not replace the original title', at);
    expect(result.find(m => m.kind === 'quests')!.entity).toEqual({ ...quest, deleted: false });
  });
  it('preserves an originally unscheduled date after repeated rescheduling', () => {
    const quest: Quest = { ...base('someday'), title: 'Someday action', skillId: 'acoustic-guitar', status: 'pending', archived: false, priority: false, recurrence: 'none', note: '' };
    const first = rescheduledQuest(quest, '2026-11-17', at, 'move-1');
    const second = rescheduledQuest(first, '2026-11-18', at, 'move-2');
    expect(second.originalDueDate).toBeUndefined();
    expect(second.scheduleHistory).toEqual([{ id: 'move-1', at, to: '2026-11-17' }, { id: 'move-2', at, from: '2026-11-17', to: '2026-11-18' }]);
  });
  it('keeps an existing unscheduled quest unscheduled during a note edit', () => {
    const data = seedGame('empty'); const quest: Quest = { ...base('someday'), title: 'Someday action', skillId: 'acoustic-guitar', status: 'pending', archived: false, priority: false, recurrence: 'none', note: '' };
    data.quests.push(quest);
    const mutations = questEditMutations(data, { ...quest, note: 'A revised note' });
    const saved = mutations[0].entity as Quest;
    expect(saved.dueDate).toBeUndefined(); expect(saved.scheduleHistory).toBeUndefined();
  });
});
