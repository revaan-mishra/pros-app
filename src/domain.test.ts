import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { ATTRIBUTES, COSMETICS, REGIONS, SKILLS, STORIES, starterForSkill } from './catalog';
import { bossProgress, creditedActivities, dailyEffort, dayKey, focusElapsed, latestEntities, levelForXP, makeAllocations, objectiveStatusMutations, projectGame, questStatusMutations, seedGame, validOutputs } from './domain';
import type { Activity, FocusSession, GameData, Output, Project, Quest, RegionId } from './types';

const at = '2026-11-12T12:00:00.000Z';
const base = (id: string) => ({ id, revision: 0, createdAt: at, updatedAt: at });
function activity(id: string, seconds: number, skillId = 'acoustic-guitar', extra: Partial<Activity> = {}): Activity {
  return { ...base(id), title: 'A deliberate session', seconds, allocations: makeAllocations(SKILLS, skillId), occurredAt: at, localDate: '2026-11-12', timeZone: 'UTC', note: '', source: 'manual', ...extra };
}
function output(id: string, skillId = 'acoustic-guitar', regionId: RegionId = 'atelier', extra: Partial<Output> = {}): Output {
  return { ...base(id), title: 'A finished result', description: 'Kept for reference.', skillId, regionId, confirmedAt: at, ...extra };
}
function project(id = 'project-test', extra: Partial<Project> = {}): Project {
  return { ...base(id), title: 'One complete project', description: '', outputCriterion: 'Keep one finished result.', skillId: 'acoustic-guitar', regionId: 'atelier', status: 'completed', archived: false, effortTargetSeconds: 3600, objectives: [{ id: 'prepare', title: 'Prepare the work', required: true, completed: true }], completedAt: at, ...extra };
}
function fixture(): GameData { return seedGame('empty', 'Tester'); }

describe('complete catalog', () => {
  it('contains the original 26 stable skills and complete content for all six regions', () => {
    expect(SKILLS).toHaveLength(26);
    expect(new Set(SKILLS.map(s => s.id)).size).toBe(26);
    expect(REGIONS).toHaveLength(6);
    expect(ATTRIBUTES).toHaveLength(6);
    expect(COSMETICS).toHaveLength(18);
    for (const skill of SKILLS) {
      expect(skill.affinities.reduce((s, a) => s + a.percent, 0)).toBe(100);
      expect(REGIONS.some(r => r.id === skill.regionId)).toBe(true);
      const starter = starterForSkill(skill);
      expect(starter.actions).toHaveLength(3);
      expect(starter.outputCriterion.length).toBeGreaterThan(20);
    }
    for (const region of REGIONS) {
      expect(region.stages).toHaveLength(4);
      expect(STORIES[region.id]).toHaveLength(4);
      expect(STORIES[region.id].every(story => story.length > 60)).toBe(true);
      expect(COSMETICS.filter(c => c.regionId === region.id).map(c => c.stage)).toEqual([1, 2, 3]);
    }
  });
  it('returns independent editable starter actions', () => {
    const first = starterForSkill('frontend'); first.actions[0] = 'Changed';
    expect(starterForSkill('frontend').actions[0]).not.toBe('Changed');
    expect(starterForSkill({ ...SKILLS[0], id: 'custom', name: 'Woodwork' }).title).toContain('Woodwork');
  });
});

describe('effort and conservation', () => {
  it('starts an empty profile with no invented progression', () => {
    const game = fixture(); const p = projectGame(game);
    expect(game.profile.displayName).toBe('Tester');
    expect(p.xp).toBe(0); expect(p.character.level).toBe(1);
    expect(p.eligibleCosmetics).toEqual([]);
    expect(game.skills.filter(s => s.equipped).map(s => s.id)).toEqual(['frontend', 'acoustic-guitar', 'calisthenics']);
  });
  it('one hour and six ten-minute sessions award the same XP', () => {
    const whole = fixture(); const split = fixture();
    whole.activities = [activity('whole', 3600)];
    split.activities = Array.from({ length: 6 }, (_, i) => activity(`split-${i}`, 600));
    expect(projectGame(whole)).toEqual(projectGame(split));
  });
  it('splits skills and attributes without creating extra XP', () => {
    const game = fixture();
    game.activities = [activity('split', 3600, 'acoustic-guitar', { allocations: makeAllocations(game.skills, 'acoustic-guitar', 'frontend', 70) })];
    const p = projectGame(game);
    expect(p.xp).toBe(60);
    expect(p.skills['acoustic-guitar'].xp).toBe(42);
    expect(p.skills.frontend.xp).toBe(18);
    expect(Object.values(p.attributes).reduce((s, a) => s + a.xp, 0)).toBeCloseTo(60, 12);
    expect(p.regions.atelier.minutes + p.regions.foundry.minutes).toBe(60);
  });
  it('conserves arbitrary second counts and whole-percentage allocations', () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 86400 }), fc.integer({ min: 0, max: 100 }), (seconds, percent) => {
      const game = fixture();
      game.activities = [activity('random', seconds, 'frontend', { allocations: makeAllocations(game.skills, 'frontend', 'spanish', percent) })];
      const p = projectGame(game);
      expect(p.xp).toBeCloseTo(seconds / 60, 9);
      expect(Object.values(p.skills).reduce((sum, skill) => sum + skill.xp, 0)).toBeCloseTo(p.xp, 9);
      expect(Object.values(p.attributes).reduce((sum, attribute) => sum + attribute.xp, 0)).toBeCloseTo(p.xp, 9);
    }), { numRuns: 200 });
  });
  it('completing a quest and its parent does not add effort XP', () => {
    const game = seedGame('demo');
    const before = projectGame(game).xp;
    game.quests = game.quests.map(q => ({ ...q, status: 'completed' }));
    game.projects = game.projects.map(p => ({ ...p, status: 'completed', objectives: p.objectives.map(o => ({ ...o, completed: true })) }));
    expect(projectGame(game).xp).toBe(before);
  });
  it('invalid, zero, and deleted activities cannot produce XP', () => {
    const game = fixture();
    game.activities = [activity('negative', -300), activity('zero', 0), activity('nan', NaN), activity('infinity', Infinity), activity('deleted', 600, 'acoustic-guitar', { deleted: true }), activity('date', 600, 'acoustic-guitar', { occurredAt: 'not-a-date' })];
    expect(projectGame(game).xp).toBe(0);
  });
  it('archiving and renaming a skill preserves historical allocations', () => {
    const game = fixture(); game.activities = [activity('before', 3600)];
    const before = projectGame(game);
    game.skills = game.skills.map(s => s.id === 'acoustic-guitar' ? { ...s, archived: true, name: 'Music practice', affinities: [{ attribute: 'wisdom', percent: 100 }] } : s);
    expect(projectGame(game)).toEqual(before);
    expect(makeAllocations(game.skills, 'acoustic-guitar')).toEqual([]);
  });
});

describe('replay and overlapping time', () => {
  it('the latest activity revision wins regardless of input order', () => {
    const first = activity('same', 600); const latest = { ...first, revision: 2, seconds: 1200 };
    const a = fixture(); a.activities = [first, latest, first];
    const b = fixture(); b.activities = [...a.activities].reverse();
    expect(projectGame(a).xp).toBe(20); expect(projectGame(a)).toEqual(projectGame(b));
  });
  it('a tombstone wins a malformed equal-revision tie', () => {
    const log = activity('same', 600);
    expect(latestEntities([log, { ...log, deleted: true }])[0].deleted).toBe(true);
  });
  it('a focus session can only create one credited confirmation', () => {
    const game = fixture();
    game.activities = [activity('a', 600, 'frontend', { focusSessionId: 'session-1' }), activity('b', 600, 'frontend', { focusSessionId: 'session-1' })];
    expect(projectGame(game).xp).toBe(10);
  });
  it('unions overlapping timed sessions without doubling time', () => {
    const game = fixture();
    game.activities = [activity('one', 3600, 'frontend', { startedAt: '2026-11-12T10:00:00Z', endedAt: '2026-11-12T11:00:00Z' }), activity('two', 3600, 'frontend', { startedAt: '2026-11-12T10:30:00Z', endedAt: '2026-11-12T11:30:00Z' })];
    expect(projectGame(game).xp).toBe(90);
    expect(creditedActivities(game).reduce((sum, log) => sum + log.seconds, 0)).toBe(5400);
  });
  it('merges overlapping focus segments before clipping confirmed effort', () => {
    const game = fixture();
    game.focusSessions = [{ ...base('overlapped-focus'), skillId: 'frontend', targetSeconds: null, status: 'completed', confirmedSeconds: 900,
      segments: [{ start: 0, end: 600000 }, { start: 300000, end: 1200000 }] }];
    game.activities = [activity('confirmed', 900, 'frontend', { focusSessionId: 'overlapped-focus' })];
    expect(projectGame(game).xp).toBe(15);
  });
  it('reconstructs 10,000 records and corrections deterministically', () => {
    const game = fixture();
    game.activities = Array.from({ length: 10000 }, (_, i) => activity(`history-${String(i).padStart(5, '0')}`, 60));
    expect(projectGame(game).xp).toBe(10000);
    const tombstones = game.activities.filter((_, i) => i % 10 === 0).map(a => ({ ...a, revision: 1, deleted: true }));
    game.activities.push(...tombstones);
    const p = projectGame(game);
    expect(p.xp).toBe(9000);
    game.activities.reverse(); expect(projectGame(game)).toEqual(p);
  });
});

describe('world milestones and strict corrections', () => {
  it('requires both relevant effort and distinct outcomes', () => {
    const game = fixture(); game.activities = [activity('practice', 240 * 60)];
    expect(projectGame(game).regions.atelier.stage).toBe(0);
    game.outputs = [output('one')]; expect(projectGame(game).regions.atelier.stage).toBe(1);
    game.outputs.push(output('two')); expect(projectGame(game).regions.atelier.stage).toBe(2);
    expect(projectGame(game).eligibleCosmetics).toEqual(['atelier-emblem', 'atelier-accessory']);
  });
  it('final restoration needs a completed project with a valid output', () => {
    const game = fixture(); game.activities = [activity('practice', 720 * 60, 'acoustic-guitar', { projectId: 'project-test' })];
    game.outputs = [output('one'), output('two'), output('three')];
    expect(projectGame(game).regions.atelier.stage).toBe(2);
    game.projects = [project()]; game.outputs[2].projectId = 'project-test';
    expect(projectGame(game).regions.atelier.stage).toBe(3);
    expect(projectGame(game).eligibleCosmetics).toContain('atelier-outfit');
  });
  it('correction, deletion, and undo recalculate the same entitlements', () => {
    const game = fixture(); game.activities = [activity('practice', 240 * 60)];
    game.outputs = [output('one'), output('two')]; const before = projectGame(game);
    game.activities[0].seconds = 59 * 60;
    expect(projectGame(game).regions.atelier.stage).toBe(0);
    expect(projectGame(game).eligibleCosmetics).toEqual([]);
    game.activities[0].seconds = 240 * 60; expect(projectGame(game)).toEqual(before);
    game.outputs[1].deleted = true; expect(projectGame(game).regions.atelier.stage).toBe(1);
    game.outputs[1].deleted = false; expect(projectGame(game)).toEqual(before);
  });
  it('reopening a project invalidates its output and final world stage', () => {
    const game = fixture(); game.activities = [activity('practice', 720 * 60, 'acoustic-guitar', { projectId: 'project-test' })]; game.projects = [project()];
    game.outputs = [output('one'), output('two'), output('three', 'acoustic-guitar', 'atelier', { projectId: 'project-test' })];
    expect(projectGame(game).regions.atelier.stage).toBe(3);
    game.projects[0].status = 'active';
    expect(validOutputs(game)).toHaveLength(2);
    expect(projectGame(game).regions.atelier.stage).toBe(2);
    expect(projectGame(game).eligibleCosmetics).not.toContain('atelier-outfit');
  });
  it('does not multiply one project output by duplicate output records', () => {
    const game = fixture(); game.projects = [project()];
    game.activities = [activity('practice', 3600, 'acoustic-guitar', { projectId: 'project-test' })];
    game.outputs = [output('one', 'acoustic-guitar', 'atelier', { projectId: 'project-test' }), output('two', 'acoustic-guitar', 'atelier', { projectId: 'project-test' })];
    expect(validOutputs(game)).toHaveLength(1);
  });
  it('re-locks a finished project output when a late correction removes its required effort', () => {
    const game = fixture(); game.projects = [project('project-test', { effortTargetSeconds: 720 * 60 })];
    const effort = activity('project-effort', 720 * 60, 'acoustic-guitar', { projectId: 'project-test' });
    game.activities = [effort];
    game.outputs = [output('one'), output('two'), output('three', 'acoustic-guitar', 'atelier', { projectId: 'project-test' })];
    const before = projectGame(game);
    expect(before.regions.atelier.stage).toBe(3);
    expect(before.totalProjects).toBe(1);
    // Region effort remains above its threshold; only project evidence changed.
    game.activities.push(activity('independent', 720 * 60));
    effort.seconds = 60;
    expect(validOutputs(game)).toHaveLength(2);
    expect(projectGame(game).regions.atelier.stage).toBe(2);
    expect(projectGame(game).totalProjects).toBe(0);
    expect(projectGame(game).eligibleCosmetics).not.toContain('atelier-outfit');
    effort.seconds = 720 * 60;
    expect(projectGame(game).regions.atelier.stage).toBe(3);
    effort.deleted = true;
    expect(projectGame(game).regions.atelier.stage).toBe(2);
  });
  it('requires the relevant project skill allocation and preserves completed archive history', () => {
    const game = fixture(); game.projects = [project()];
    game.outputs = [output('result', 'acoustic-guitar', 'atelier', { projectId: 'project-test' })];
    game.activities = [activity('split', 3600, 'acoustic-guitar', { projectId: 'project-test', allocations: makeAllocations(game.skills, 'acoustic-guitar', 'frontend', 50) })];
    expect(validOutputs(game)).toHaveLength(0);
    game.activities[0].seconds = 7200;
    expect(validOutputs(game)).toHaveLength(1);
    const before = projectGame(game);
    game.projects[0].archived = true;
    game.skills.find(s => s.id === 'acoustic-guitar')!.archived = true;
    expect(projectGame(game)).toEqual(before);
  });
  it('a finished book counts once and reopens cleanly', () => {
    const game = fixture();
    game.books = [{ ...base('book'), title: 'A book', author: '', status: 'completed', pages: 100, totalPages: 100, skillId: 'french', notes: '', archived: false }];
    game.outputs = [output('book-output', 'french', 'observatory', { bookId: 'book' })];
    expect(validOutputs(game)).toHaveLength(1); expect(projectGame(game).xp).toBe(0);
    game.books[0].status = 'reading'; expect(validOutputs(game)).toHaveLength(0);
  });
  it('rejects outputs assigned to the wrong project or book skill', () => {
    const game = fixture(); game.projects = [project()];
    game.books = [{ ...base('book'), title: 'A book', author: '', status: 'completed', pages: 100, totalPages: 100, skillId: 'french', notes: '', archived: false }];
    game.outputs = [output('wrong-project', 'creative-writing', 'atelier', { projectId: 'project-test' }), output('wrong-book', 'german', 'observatory', { bookId: 'book' })];
    expect(validOutputs(game)).toHaveLength(0);
  });
  it('an absence and presentation receipts cannot change eligibility', () => {
    const game = seedGame('demo'); const p = projectGame(game);
    game.profile.lastOpenedAt = '2027-11-12T12:00:00Z'; game.profile.celebrationIds = [];
    expect(projectGame(game)).toEqual(p);
  });
});

describe('bosses, focus, and calendars', () => {
  it('credits only the relevant share of effort tagged to a project', () => {
    const game = fixture(); const p = project('boss', { status: 'active' }); game.projects = [p];
    game.activities = [activity('unrelated-tag', 3600, 'frontend', { projectId: 'boss' })];
    expect(bossProgress(p, game)).toBeCloseTo(.2);
    game.activities = [activity('split-tag', 3600, 'acoustic-guitar', { projectId: 'boss', allocations: makeAllocations(game.skills, 'acoustic-guitar', 'frontend', 70) })];
    expect(bossProgress(p, game)).toBeCloseTo(.55);
  });
  it('weights preparation at20%, relevant effort at50%, and output at30%', () => {
    const game = fixture(); const p = project('boss', { status: 'active' }); game.projects = [p];
    expect(bossProgress(p, game)).toBeCloseTo(.2);
    game.activities = [activity('unrelated', 3600, 'frontend')]; expect(bossProgress(p, game)).toBeCloseTo(.2);
    game.activities.push(activity('related', 3600, 'acoustic-guitar', { projectId: 'boss' })); expect(bossProgress(p, game)).toBeCloseTo(.7);
    p.status = 'completed'; game.outputs = [output('finished', 'acoustic-guitar', 'atelier', { projectId: 'boss' })];
    expect(bossProgress(p, game)).toBe(1);
  });
  it('restores focus duration from timestamped segments', () => {
    const session: FocusSession = { ...base('focus'), skillId: 'frontend', targetSeconds: 1500, status: 'running', segments: [{ start: 1000, end: 11000 }, { start: 21000 }] };
    expect(focusElapsed(session, 41000)).toBe(30);
    expect(focusElapsed({ ...session, status: 'paused', segments: [{ start: 1000, end: 11000 }, { start: 21000, end: 41000 }] }, 51000)).toBe(30);
    expect(focusElapsed({ ...session, status: 'completed', confirmedSeconds: 25 })).toBe(25);
    expect(focusElapsed({ ...session, status: 'discarded' })).toBe(0);
  });
  it('does not double-count overlapping focus segments', () => {
    const session: FocusSession = { ...base('focus'), skillId: 'frontend', targetSeconds: null, status: 'paused', segments: [{ start: 1000, end: 11000 }, { start: 6000, end: 16000 }] };
    expect(focusElapsed(session)).toBe(15);
  });
  it('uses the profile calendar across midnight and daylight-saving changes', () => {
    expect(dayKey('2026-11-12T20:00:00Z', 'Asia/Kolkata')).toBe('2026-11-13');
    expect(dayKey('2026-11-12T01:00:00Z', 'America/Los_Angeles')).toBe('2026-11-11');
    expect(dayKey('2026-03-08T09:59:00Z', 'America/Los_Angeles')).toBe('2026-03-08');
    expect(dayKey('2026-03-08T10:01:00Z', 'America/Los_Angeles')).toBe('2026-03-08');
  });
  it('resolves exact level boundaries', () => {
    expect(levelForXP(99).level).toBe(1); expect(levelForXP(100).level).toBe(2);
    expect(levelForXP(550).level).toBe(5); expect(levelForXP(1800).level).toBe(10);
    expect(levelForXP(50, 'skill').level).toBe(2);
    expect(levelForXP(-1).level).toBe(1); expect(levelForXP(NaN).xp).toBe(0);
  });
  it('handles malformed extreme finite XP without overflow or an unbounded loop', () => {
    for (const kind of ['character', 'skill'] as const) {
      const progress = levelForXP(1e308, kind);
      expect(progress.xp).toBe(Number.MAX_SAFE_INTEGER);
      expect(Number.isFinite(progress.level)).toBe(true);
      expect(Number.isFinite(progress.required)).toBe(true);
      expect(progress.progress).toBeGreaterThanOrEqual(0);
      expect(progress.progress).toBeLessThanOrEqual(1);
    }
  });
  it('splits confirmed focus time at local midnight without changing XP', () => {
    const game = fixture();
    const start = Date.parse('2026-11-12T18:15:00Z');
    const end = Date.parse('2026-11-12T18:45:00Z');
    game.focusSessions = [{ ...base('midnight'), skillId: 'frontend', targetSeconds: 1800, status: 'completed', confirmedSeconds: 1800, segments: [{ start, end }] }];
    game.activities = [activity('midnight', 1800, 'frontend', { focusSessionId: 'midnight', source: 'focus', timeZone: 'Asia/Kolkata', localDate: '2026-11-13' })];
    expect(dailyEffort(game)).toEqual({ '2026-11-12': 900, '2026-11-13': 900 });
    expect(Object.values(dailyEffort(game)).reduce((sum, seconds) => sum + seconds, 0)).toBe(projectGame(game).xp * 60);
  });
  it('keeps daily totals conserved across pauses, overlap, and daylight-saving changes', () => {
    const game = fixture();
    game.activities = [
      activity('dst', 7200, 'frontend', { startedAt: '2026-03-08T09:00:00Z', endedAt: '2026-03-08T11:00:00Z', timeZone: 'America/Los_Angeles', localDate: '2026-03-08' }),
      activity('overlap', 3600, 'frontend', { startedAt: '2026-03-08T10:30:00Z', endedAt: '2026-03-08T11:30:00Z', timeZone: 'America/Los_Angeles', localDate: '2026-03-08' }),
      activity('estimate', 600, 'frontend', { localDate: '2026-03-07' }),
    ];
    expect(dailyEffort(game)).toEqual({ '2026-03-08': 9000, '2026-03-07': 600 });
    expect(Object.values(dailyEffort(game)).reduce((sum, seconds) => sum + seconds, 0)).toBe(projectGame(game).xp * 60);
  });
  it('does not let a profile time-zone change rewrite prior daily effort dates', () => {
    const game = fixture();
    game.activities = [activity('recorded-zone', 3600, 'frontend', { startedAt: '2026-11-12T23:30:00Z', endedAt: '2026-11-13T00:30:00Z', timeZone: 'UTC' })];
    const before = dailyEffort(game);
    game.profile.timeZone = 'America/Los_Angeles';
    expect(dailyEffort(game)).toEqual(before);
    expect(before).toEqual({ '2026-11-12': 1800, '2026-11-13': 1800 });
  });
});


describe('stable quest and preparation evidence', () => {
  it('a renamed linked quest completes its objective without adding effort', () => {
    const game = seedGame('demo');
    const quest = { ...game.quests.find(q => q.id === 'quest-keyboard')!, title: 'A new name for the same next action' };
    const before = projectGame(game).xp;
    const changes = questStatusMutations(game, quest, 'completed', at);
    for (const change of changes) {
      if (change.kind === 'projects') game.projects = game.projects.map(p => p.id === change.entity.id ? change.entity as Project : p);
      if (change.kind === 'quests') game.quests = game.quests.map(q => q.id === change.entity.id ? change.entity as Quest : q);
    }
    expect(game.projects.find(p => p.id === quest.projectId)!.objectives.find(o => o.id === quest.objectiveId)!.completed).toBe(true);
    expect(changes.map(m => m.kind).sort()).toEqual(['projects', 'quests']);
    expect(projectGame(game).xp).toBe(before);
  });
  it('reopening preparation reopens its linked quest and completed project', () => {
    const game = seedGame('demo');
    const p = game.projects.find(p => p.id === 'project-web')!;
    p.status = 'completed'; p.objectives.forEach(o => { o.completed = true; });
    const q = game.quests.find(q => q.id === 'quest-keyboard')!;
    q.title = 'Renamed action'; q.status = 'completed'; q.completedAt = at;
    const changes = objectiveStatusMutations(game, p, q.objectiveId!, false, at);
    const updated = changes.find(m => m.kind === 'projects')!.entity as Project;
    const updatedQuest = changes.find(m => m.kind === 'quests' && m.entity.id === q.id)!.entity as Quest;
    expect(updated.status).toBe('active');
    expect(updated.objectives.find(o => o.id === q.objectiveId)!.completed).toBe(false);
    expect(updatedQuest.status).toBe('pending');
    expect(updatedQuest.completedAt).toBeUndefined();
    expect(changes.some(m => m.kind === 'activities')).toBe(false);
  });
});
