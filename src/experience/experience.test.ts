import 'fake-indexeddb/auto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { projectGame, questStatusMutations, seedGame } from '../domain';
import { commitMutations, db, exportBackup, importBackup, initializeGame, listSnapshots, loadDraft, loadGame, saveDraft, undoCommand, validateBackup } from '../storage';
import { activityReceipt, captureDraftKey, chooseExpedition, completeProjectMutations, displayedKeepsakes, expeditionFor, historicalAllocations, keepsakesFor, newFocusSession, projectEditMutations } from './model';
import { experienceFor } from './preferences';
import { seedExperienceDemo } from './sample';
import type { Activity, GameData, Mutation, Project } from '../types';

const at = '2026-11-16T04:00:00.000Z';
const entity = (id: string) => ({ id, revision: 0, createdAt: at, updatedAt: at });
function fixture() {
  const data = seedGame('empty', 'Test');
  const project: Project = { ...entity('atelier-project'), title: 'A short recording', description: 'Keep one complete take.', outputCriterion: 'A recording I can replay', skillId: 'acoustic-guitar', regionId: 'atelier', status: 'active', archived: false, effortTargetSeconds: 3600, objectives: [{ id: 'prepare', title: 'Choose a piece', required: true, completed: true }] };
  data.projects.push(project);
  return data;
}
function activity(data: GameData, id = 'work', seconds = 3600): Activity {
  return { ...entity(id), title: 'Practice', seconds, occurredAt: at, localDate: '2026-11-16', timeZone: 'Asia/Kolkata', source: 'manual', note: '', projectId: 'atelier-project', allocations: historicalAllocations(data, 'acoustic-guitar', '', 100) };
}
function apply(data: GameData, mutations: Mutation[]) {
  for (const m of mutations) {
    if (m.kind === 'profile') data.profile = m.entity as GameData['profile'];
    else { const items = data[m.kind] as typeof m.entity[]; const index = items.findIndex(item => item.id === m.entity.id); if (index < 0) items.push(m.entity); else items[index] = m.entity; }
  }
}
beforeEach(async () => {
  if (!db.isOpen()) await db.open();
  await Promise.all([db.records.clear(), db.commands.clear(), db.undos.clear(), db.snapshots.clear(), db.drafts.clear(), db.cloudRecords.clear(), db.syncMetadata.clear(), db.syncConflicts.clear()]);
});
afterAll(() => db.close());

describe('the work-to-world experience', () => {
  it('requires real preparation and relevant effort before completing an expedition', () => {
    const data = fixture(); const project = data.projects[0];
    data.activities.push({ ...activity(data), projectId: undefined });
    expect(expeditionFor(data, project).canComplete).toBe(false);
    expect(() => completeProjectMutations(data, project)).toThrow('relevant effort');
    data.activities.push(activity(data, 'linked'));
    expect(expeditionFor(data, project).canComplete).toBe(true);
    const xp = projectGame(data).xp;
    apply(data, completeProjectMutations(data, project, at));
    expect(projectGame(data).xp).toBe(xp);
    expect(keepsakesFor(data)).toHaveLength(1);
    expect(projectGame(data).regions.atelier.stage).toBe(1);
    expect(expeditionFor(data, data.projects[0]).progress).toBe(1);
  });
  it('restores all three Atelier stages from cumulative evidence and relocks them after correction', () => {
    const data = fixture(); data.activities.push(activity(data));
    apply(data, completeProjectMutations(data, data.projects[0], at));
    const first = keepsakesFor(data)[0];
    data.profile.experience = { ...experienceFor(data.profile), keepsakeSlots: [first.id, null, null, null, null, null] };
    expect(projectGame(data).regions.atelier.stage).toBe(1);
    data.activities.push(activity(data, 'more', 180 * 60));
    data.outputs.push({ ...entity('second'), title: 'A finished exercise', description: '', skillId: 'acoustic-guitar', regionId: 'atelier', confirmedAt: at });
    expect(projectGame(data).regions.atelier.stage).toBe(2);
    data.activities.push(activity(data, 'long', 480 * 60));
    data.outputs.push({ ...entity('third'), title: 'Another complete study', description: '', skillId: 'acoustic-guitar', regionId: 'atelier', confirmedAt: at });
    expect(projectGame(data).regions.atelier.stage).toBe(3);
    data.projects[0].status = 'active';
    expect(keepsakesFor(data).some(k => k.id === first.id)).toBe(false);
    expect(displayedKeepsakes(data)[0]).toBeNull();
    expect(projectGame(data).regions.atelier.stage).toBe(2);
    apply(data, completeProjectMutations(data, data.projects[0], at));
    expect(keepsakesFor(data).find(k => k.id === first.id)?.id).toBe(first.id);
    expect(displayedKeepsakes(data)[0]?.id).toBe(first.id);
    expect(keepsakesFor(data)).toHaveLength(3);
  });
  it('preserves an existing project output identity when reopened and completed again', () => {
    const data = fixture(); data.activities.push(activity(data));
    data.outputs.push({ ...entity('legacy-output'), title: 'Old take', description: '', skillId: 'acoustic-guitar', regionId: 'atelier', projectId: data.projects[0].id, confirmedAt: at });
    const mutations = completeProjectMutations(data, data.projects[0], at);
    expect(mutations.find(m => m.kind === 'outputs')?.entity.id).toBe('legacy-output');
    apply(data, mutations); expect(keepsakesFor(data)).toHaveLength(1);
  });
  it('honors a pin independently of project order and allows dismissing suggestions', () => {
    const data = seedExperienceDemo(); const pinned = data.profile.experience!.pinnedProjectId;
    data.projects.reverse(); expect(chooseExpedition(data).project?.id).toBe(pinned);
    data.projects.find(p => p.id === pinned)!.status = 'paused';
    expect(chooseExpedition(data).pinned).toBe(true);
    data.projects.find(p => p.id === pinned)!.deleted = true;
    expect(chooseExpedition(data).project?.id).not.toBe(pinned);
    data.profile.experience!.dismissedProjectIds = data.projects.map(p => p.id);
    expect(chooseExpedition(data).project).toBeUndefined();
  });
  it('provides four distinct keepsake silhouettes from actual output sources', () => {
    const data = seedGame('demo');
    const shapes = new Set(keepsakesFor(data).map(k => k.kind));
    expect([...shapes].sort()).toEqual(['folio', 'mechanism', 'seal', 'volume']);
    const real = seedGame('empty'); expect(keepsakesFor(real)).toEqual([]); expect(real.activities).toEqual([]);
  });
});

describe('capture and focus safety', () => {
  it('isolates manual, skill, quest, project, reading, focus and correction drafts', async () => {
    const contexts = [{}, { skillId: 'guitar' }, { questId: 'q' }, { projectId: 'p' }, { bookId: 'b' }, { focusSessionId: 'f' }, { activityId: 'a' }];
    const keys = contexts.map(captureDraftKey); expect(new Set(keys).size).toBe(7);
    await Promise.all(keys.map((key, i) => saveDraft('local:alice', key, { recordId: String(i), minutes: String(i) })));
    expect(await loadDraft('local:bob', keys[0])).toBeNull();
    for (let i = 0; i < keys.length; i++) expect(await loadDraft('local:alice', keys[i])).toEqual({ recordId: String(i), minutes: String(i) });
  });
  it('retains historical affinities and regions when a correction keeps its allocation', () => {
    const data = fixture(); const original = activity(data);
    const skill = data.skills.find(s => s.id === 'acoustic-guitar')!;
    skill.affinities = [{ attribute: 'wisdom', percent: 100 }]; skill.regionId = 'sanctuary';
    expect(historicalAllocations(data, skill.id, '', 70, original)).toEqual(original.allocations);
    expect(historicalAllocations(data, skill.id, '', 70)).not.toEqual(original.allocations);
  });
  it('blocks completing a parent through the shared logging/completion command', () => {
    const data = fixture();
    const parent = { ...entity('parent'), title: 'Parent', skillId: 'acoustic-guitar', status: 'pending' as const, archived: false, priority: false, recurrence: 'none' as const, note: '' };
    data.quests.push(parent, { ...parent, id: 'child', parentId: parent.id });
    expect(() => questStatusMutations(data, parent, 'completed')).toThrow('subtasks');
    data.quests[1].status = 'skipped'; expect(questStatusMutations(data, parent, 'completed')).toHaveLength(1);
  });
  it('acknowledges one activity after a lost acknowledgement and repeated capture command', async () => {
    const data = fixture(); await initializeGame('local:alice', data);
    const mutations: Mutation[] = [{ kind: 'activities', entity: activity(data) }];
    await saveDraft('local:alice', captureDraftKey(), { recordId: 'work', commandId: 'capture-id' });
    await commitMutations('local:alice', mutations, 'capture-id');
    db.close(); await db.open();
    await commitMutations('local:alice', mutations, 'capture-id');
    const restored = (await loadGame('local:alice'))!;
    expect(restored.activities).toHaveLength(1); expect(projectGame(restored).xp).toBe(60);
    expect(activityReceipt(data, activity(data))).toContain('Character +60 XP');
  });
  it('guards one active session atomically across stale device/tab state', async () => {
    const data = fixture(); await initializeGame('local:alice', data);
    const first = newFocusSession(data, 'acoustic-guitar', {}, Date.parse(at), 'focus-one');
    const second = newFocusSession(data, 'acoustic-guitar', {}, Date.parse(at), 'focus-two');
    await commitMutations('local:alice', [{ kind: 'focusSessions', entity: first }]);
    await expect(commitMutations('local:alice', [{ kind: 'focusSessions', entity: second }])).rejects.toThrow('already open');
    expect((await loadGame('local:alice'))!.focusSessions).toHaveLength(1);
    expect(projectGame((await loadGame('local:alice'))!).xp).toBe(0);
  });
});

describe('presentation persistence and correction-safe Undo', () => {
  it('keeps a recovery snapshot from before a combined first-preference and activity write', async () => {
    const data = fixture(); await initializeGame('local:alice', data);
    await commitMutations('local:alice', [{ kind: 'activities', entity: activity(data) }, { kind: 'profile', entity: { ...data.profile, experience: experienceFor(data.profile) } }]);
    const snapshots = await db.snapshots.where('accountId').equals('local:alice').toArray();
    expect(snapshots).toHaveLength(2);
    expect(snapshots.every(s => s.data.activities.length === 0 && !s.data.profile.experience)).toBe(true);
    expect((await loadGame('local:alice'))!.activities).toHaveLength(1);
  });
  it('preserves objective identity on reordering/renaming, creates new linked quests and archives removed ones', () => {
    const data = fixture(); const project = data.projects[0];
    apply(data, projectEditMutations(data, project, at));
    const originalQuest = data.quests[0];
    const edited = { ...project, objectives: [{ id: 'new-step', title: 'Prepare a take', required: true, completed: false }, { ...project.objectives[0], title: 'Choose the final piece' }] };
    apply(data, projectEditMutations(data, edited, at));
    expect(data.quests.find(q => q.id === originalQuest.id)?.objectiveId).toBe('prepare');
    expect(data.quests.find(q => q.id === originalQuest.id)?.title).toBe('Choose the final piece');
    expect(data.quests.find(q => q.objectiveId === 'new-step')?.status).toBe('pending');
    apply(data, projectEditMutations(data, { ...edited, objectives: [edited.objectives[0]] }, at));
    expect(data.quests.find(q => q.id === originalQuest.id)?.archived).toBe(true);
    expect(projectGame(data).xp).toBe(0);
  });
  it('accepts old backups and round trips account-scoped preferences without changing progression', async () => {
    const data = fixture(); await initializeGame('local:alice', data);
    const oldBackup = await exportBackup('local:alice'); expect(validateBackup(oldBackup).data.profile.experience).toBeUndefined();
    const before = projectGame(data);
    const prefs = { ...experienceFor(data.profile), pinnedProjectId: data.projects[0].id, focusMode: 'minimal' as const };
    await commitMutations('local:alice', [{ kind: 'profile', entity: { ...data.profile, experience: prefs } }]);
    expect(await listSnapshots('local:alice')).toHaveLength(2);
    const backup = await exportBackup('local:alice'); await importBackup('local:restored', backup);
    const restored = (await loadGame('local:restored'))!;
    expect(restored.profile.experience).toEqual(prefs); expect(projectGame(restored)).toEqual(before);
    expect(await loadGame('local:bob')).toBeNull();
    const broken = structuredClone(backup); broken.data.profile.experience!.keepsakeSlots = ['same', 'same', null, null, null, null];
    expect(() => validateBackup(broken)).toThrow('one display slot');
  });
  it('unequips invalid rewards in the correction command and restores both with Undo', async () => {
    const data = fixture(); data.activities.push(activity(data)); apply(data, completeProjectMutations(data, data.projects[0], at));
    const eligible = projectGame(data).eligibleCosmetics[0]; expect(eligible).toBeTruthy();
    data.profile.equipment.emblem = eligible;
    await initializeGame('local:alice', data);
    const changed = await commitMutations('local:alice', [
      { kind: 'activities', entity: { ...data.activities[0], seconds: 60 } },
      { kind: 'profile', entity: { ...data.profile, lastSkillId: 'acoustic-guitar' } },
    ]);
    const corrected = (await loadGame('local:alice'))!;
    expect(corrected.profile.equipment.emblem).toBe(''); expect(projectGame(corrected).regions.atelier.stage).toBe(0);
    expect(changed.mutations.filter(m => m.kind === 'profile')).toHaveLength(1);
    await undoCommand('local:alice', changed.id);
    const restored = (await loadGame('local:alice'))!;
    expect(restored.activities[0].seconds).toBe(3600); expect(restored.profile.equipment.emblem).toBe(eligible);
    expect(projectGame(restored).regions.atelier.stage).toBe(1);
  });
});
