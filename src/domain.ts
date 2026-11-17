import { ATTRIBUTES, COSMETICS, REGIONS, SKILLS } from './catalog';
import type { Activity, Affinity, Allocation, AttributeId, BaseEntity, FocusSession, GameData, LevelProgress, Mutation, Output, Project, Projection, Quest, RegionId, Skill } from './types';

const REGION_IDS = new Set(REGIONS.map(region => region.id));
const ATTRIBUTE_IDS = new Set(ATTRIBUTES.map(attribute => attribute.id));
const REGION_ATTRIBUTE: Record<RegionId, AttributeId> = {
  observatory: 'intelligence', foundry: 'discipline', atelier: 'creativity',
  training: 'strength', citadel: 'charisma', sanctuary: 'wisdom',
};
export const REGION_THRESHOLDS = [60, 240, 720] as const;
const positive = (value: number): number => Number.isFinite(value) && value > 0 ? value : 0;
const isDate = (value: string | undefined): boolean => !!value && Number.isFinite(Date.parse(value));

/** Resolve sync/replay duplicates without depending on input order. Tombstones participate. */
export function latestEntities<T extends BaseEntity>(entities: readonly T[]): T[] {
  const latest = new Map<string, T>();
  for (const entity of entities) {
    if (!entity || typeof entity.id !== 'string' || !entity.id) continue;
    const previous = latest.get(entity.id);
    if (!previous || compareEntity(entity, previous) > 0) latest.set(entity.id, entity);
  }
  return [...latest.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function compareEntity(a: BaseEntity, b: BaseEntity): number {
  const revision = (Number.isFinite(a.revision) ? a.revision : 0) - (Number.isFinite(b.revision) ? b.revision : 0);
  if (revision) return revision;
  const updated = String(a.updatedAt).localeCompare(String(b.updatedAt));
  if (updated) return updated;
  // Identical revisions are malformed, but still resolve reproducibly; deletion wins a tie.
  if (!!a.deleted !== !!b.deleted) return a.deleted ? 1 : -1;
  return JSON.stringify(a).localeCompare(JSON.stringify(b));
}

export function levelForXP(xp: number, kind: 'character' | 'skill' = 'character'): LevelProgress {
  // Persisted activity bounds keep normal totals far below this ceiling. It also
  // keeps the pure engine safe when a malformed caller supplies 1e308 XP: the
  // inverse quadratic must never overflow to Infinity and enter an endless loop.
  const safeXP = Math.min(positive(xp), Number.MAX_SAFE_INTEGER);
  const first = kind === 'skill' ? 50 : 100;
  const step = kind === 'skill' ? 10 : 25;
  const threshold = (completed: number) => first * completed + step * completed * (completed - 1) / 2;
  // Invert the quadratic, then correct boundary rounding without walking through all levels.
  const b = first - step / 2;
  let completed = Math.max(0, Math.floor((-b + Math.sqrt(b * b + 2 * step * safeXP)) / step));
  while (completed > 0 && threshold(completed) > safeXP) completed--;
  while (threshold(completed + 1) <= safeXP) completed++;
  const current = safeXP - threshold(completed);
  const required = first + step * completed;
  return { level: completed + 1, xp: safeXP, current, required, progress: Math.min(1, current / required) };
}

function normalizeAffinities(affinities: readonly Affinity[], regionId: RegionId): Affinity[] {
  const totals = new Map<AttributeId, number>();
  for (const affinity of affinities || []) {
    if (ATTRIBUTE_IDS.has(affinity.attribute) && positive(affinity.percent)) {
      totals.set(affinity.attribute, (totals.get(affinity.attribute) || 0) + affinity.percent);
    }
  }
  const sum = [...totals.values()].reduce((a, b) => a + b, 0);
  if (!sum || !Number.isFinite(sum)) return [{ attribute: REGION_ATTRIBUTE[regionId], percent: 100 }];
  return [...totals].map(([attribute, percent]) => ({ attribute, percent: percent / sum * 100 }));
}

export function makeAllocations(skills: readonly Skill[], primaryId: string, secondaryId?: string, primaryPercent = 70): Allocation[] {
  const eligible = latestEntities(skills).filter(skill => !skill.deleted && !skill.archived);
  const primary = eligible.find(skill => skill.id === primaryId);
  if (!primary) return [];
  const secondary = secondaryId !== primaryId ? eligible.find(skill => skill.id === secondaryId) : undefined;
  const percent = Number.isFinite(primaryPercent) ? Math.min(100, Math.max(0, primaryPercent)) : 70;
  const snapshot = (skill: Skill, share: number): Allocation => ({
    skillId: skill.id, percent: share, regionId: skill.regionId,
    affinities: normalizeAffinities(skill.affinities, skill.regionId).map(affinity => ({ ...affinity })),
  });
  if (!secondary) return [snapshot(primary, 100)];
  return [snapshot(primary, percent), snapshot(secondary, 100 - percent)].filter(allocation => allocation.percent > 0);
}

function validAllocations(activity: Activity): Allocation[] {
  const allocations = (activity.allocations || []).filter(allocation =>
    !!allocation.skillId && REGION_IDS.has(allocation.regionId) && positive(allocation.percent));
  const total = allocations.reduce((sum, allocation) => sum + allocation.percent, 0);
  if (!total || !Number.isFinite(total)) return [];
  return allocations.map(allocation => ({ ...allocation, percent: allocation.percent / total * 100,
    affinities: normalizeAffinities(allocation.affinities, allocation.regionId) }));
}

interface CreditedActivity { activity: Activity; seconds: number; allocations: Allocation[]; intervals: { start: number; end: number }[] }
interface TimedInterval { start: number; end: number; id: string }

/** Only activity evidence creates XP. Quest/project checkboxes never create another reward. */
export function creditedActivities(data: GameData): CreditedActivity[] {
  let candidates = latestEntities(data.activities).filter(activity => !activity.deleted &&
    positive(activity.seconds) && isDate(activity.occurredAt) && validAllocations(activity).length > 0);
  // A focus session produces one confirmation even if its write was replayed with another ID.
  const focusOwners = new Map<string, Activity>();
  for (const activity of candidates) if (activity.focusSessionId) {
    const owner = focusOwners.get(activity.focusSessionId);
    if (!owner || compareEntity(activity, owner) > 0 ||
      (compareEntity(activity, owner) === 0 && activity.id > owner.id)) focusOwners.set(activity.focusSessionId, activity);
  }
  candidates = candidates.filter(activity => !activity.focusSessionId || focusOwners.get(activity.focusSessionId)?.id === activity.id);
  const sessions = new Map(latestEntities(data.focusSessions).map(session => [session.id, session]));
  const credits = new Map<string, number>();
  const creditedIntervals = new Map<string, { start: number; end: number }[]>();
  const intervals: TimedInterval[] = [];
  for (const activity of candidates) {
    let remaining = activity.seconds * 1000;
    if (!Number.isFinite(remaining)) continue;
    const focus = activity.focusSessionId ? sessions.get(activity.focusSessionId) : undefined;
    if (focus && (focus.deleted || focus.status === 'discarded')) continue;
    const segments = focus?.segments?.filter(segment => Number.isFinite(segment.start) && Number.isFinite(segment.end) && segment.end! > segment.start)
      .map(segment => ({ start: segment.start, end: segment.end! }))
      .sort((a, b) => a.start - b.start);
    let sourceIntervals = segments?.length ? segments : [];
    if (!sourceIntervals.length && isDate(activity.startedAt) && isDate(activity.endedAt)) {
      const start = Date.parse(activity.startedAt!); const end = Date.parse(activity.endedAt!);
      if (end <= start) continue;
      sourceIntervals = [{ start, end }];
    }
    if (!sourceIntervals.length) {
      credits.set(activity.id, activity.seconds);
      continue;
    }
    // Merge a session's overlapping segments before applying the confirmed effort
    // budget. Otherwise duplicated pauses can consume that budget twice.
    const mergedIntervals: { start: number; end: number }[] = [];
    for (const segment of sourceIntervals) {
      const last = mergedIntervals.at(-1);
      if (last && segment.start <= last.end) last.end = Math.max(last.end, segment.end);
      else mergedIntervals.push({ ...segment });
    }
    for (const segment of mergedIntervals) {
      if (remaining <= 0) break;
      const end = Math.min(segment.end, segment.start + remaining);
      intervals.push({ start: segment.start, end, id: activity.id });
      remaining -= end - segment.start;
    }
  }
  // Sorting by start makes union accounting O(n log n). Earliest evidence owns overlap;
  // stable IDs break equal-start ties. A paused session contributes its actual segments.
  intervals.sort((a, b) => a.start - b.start || a.id.localeCompare(b.id) || a.end - b.end);
  let coveredUntil = -Infinity;
  for (const interval of intervals) {
    const start = Math.max(interval.start, coveredUntil);
    const uncovered = Math.max(0, interval.end - start);
    credits.set(interval.id, (credits.get(interval.id) || 0) + uncovered / 1000);
    if (uncovered > 0) {
      const credited = creditedIntervals.get(interval.id) || [];
      credited.push({ start, end: interval.end });
      creditedIntervals.set(interval.id, credited);
    }
    coveredUntil = Math.max(coveredUntil, interval.end);
  }
  return candidates.map(activity => ({ activity, seconds: credits.get(activity.id) || 0, allocations: validAllocations(activity), intervals: creditedIntervals.get(activity.id) || [] }))
    .filter(credit => credit.seconds > 0);
}

function completedProject(project: Project): boolean {
  return !project.deleted && project.status === 'completed' &&
    (project.objectives || []).filter(objective => objective.required).every(objective => objective.completed);
}

/** Stable links survive a quest rename. A unique exact title supports older
 * records; the two original sample aliases keep existing demo profiles useful. */
export function questObjectiveId(quest: Quest, project: Project): string | undefined {
  if (quest.projectId !== project.id || project.deleted || quest.occurrenceOf) return undefined;
  if (quest.objectiveId) return project.objectives.some(o => o.id === quest.objectiveId) ? quest.objectiveId : undefined;
  const matching = project.objectives.filter(o => o.title === quest.title);
  if (matching.length === 1) return matching[0].id;
  const sampleAliases: Record<string, { projectId: string; title: string }> = {
    'quest-keyboard': { projectId: 'project-web', title: 'Test keyboard navigation' },
    'quest-dialogue': { projectId: 'project-spanish', title: 'Record one complete conversation' },
  };
  const alias = sampleAliases[quest.id];
  return alias?.projectId === project.id ? project.objectives.find(o => o.title === alias.title)?.id : undefined;
}

/** Completing a next action and its preparation evidence is one atomic change.
 * This helper never manufactures an activity or an XP reward. */
export function questStatusMutations(data: GameData, quest: Quest, status: Quest['status'], at = new Date().toISOString()): Mutation[] {
  if (status === 'completed' && data.quests.some(q => q.parentId === quest.id && q.recurrence === 'none' && !q.deleted && !q.archived && q.status === 'pending')) throw new Error('Finish or skip the open subtasks before completing this quest.');
  const project = data.projects.find(p => p.id === quest.projectId && !p.deleted);
  const objectiveId = project ? questObjectiveId(quest, project) : undefined;
  const updatedQuest: Quest = { ...quest, status, ...(objectiveId ? { objectiveId } : {}) };
  if (status === 'skipped') updatedQuest.skippedAt = at; else delete updatedQuest.skippedAt;
  if (status === 'completed') updatedQuest.completedAt = at;
  else delete updatedQuest.completedAt;
  const mutations: Mutation[] = [{ kind: 'quests', entity: updatedQuest }];
  if (project && objectiveId) mutations.push({ kind: 'projects', entity: {
    ...project, objectives: project.objectives.map(o => o.id === objectiveId ? { ...o, completed: status === 'completed' } : o),
    status: project.status === 'completed' && status !== 'completed' ? 'active' : project.status,
  } });
  return mutations;
}

/** Project preparation controls update only quests linked to that exact step. */
export function objectiveStatusMutations(data: GameData, project: Project, objectiveId: string, completed: boolean, at = new Date().toISOString()): Mutation[] {
  if (!project.objectives.some(o => o.id === objectiveId)) return [];
  const mutations: Mutation[] = [{ kind: 'projects', entity: { ...project,
    status: project.status === 'completed' && !completed ? 'active' : project.status,
    objectives: project.objectives.map(o => o.id === objectiveId ? { ...o, completed } : o),
  } }];
  for (const quest of data.quests.filter(q => !q.deleted && questObjectiveId(q, project) === objectiveId)) {
    if (completed && data.quests.some(q => q.parentId === quest.id && q.recurrence === 'none' && !q.deleted && !q.archived && q.status === 'pending')) throw new Error('Finish or skip the open subtasks before completing this preparation step.');
    const updated: Quest = { ...quest, objectiveId, status: completed ? 'completed' : 'pending' };
    if (completed) updated.completedAt = at; else delete updated.completedAt;
    mutations.push({ kind: 'quests', entity: updated });
  }
  return mutations;
}

export function validOutputs(data: GameData): Output[] {
  const projects = new Map(latestEntities(data.projects).map(project => [project.id, project]));
  const books = new Map(latestEntities(data.books).map(book => [book.id, book]));
  const projectEffort = new Map<string, number>();
  for (const credit of creditedActivities(data)) {
    const project = credit.activity.projectId ? projects.get(credit.activity.projectId) : undefined;
    if (!project || project.deleted) continue;
    const share = credit.allocations.filter(allocation => allocation.skillId === project.skillId)
      .reduce((sum, allocation) => sum + allocation.percent, 0) / 100;
    projectEffort.set(project.id, (projectEffort.get(project.id) || 0) + credit.seconds * share);
  }
  const seenProject = new Set<string>(); const seenBook = new Set<string>();
  return latestEntities(data.outputs).filter(output => {
    if (output.deleted || !output.title?.trim() || !output.skillId || !REGION_IDS.has(output.regionId) || !isDate(output.confirmedAt)) return false;
    if (output.projectId) {
      const project = projects.get(output.projectId);
      if (!project || !completedProject(project) || project.regionId !== output.regionId || project.skillId !== output.skillId || seenProject.has(project.id) ||
        !Number.isFinite(project.effortTargetSeconds) || project.effortTargetSeconds < 0 ||
        (projectEffort.get(project.id) || 0) + 1e-9 < project.effortTargetSeconds) return false;
    }
    if (output.bookId) {
      const book = books.get(output.bookId);
      if (!book || book.deleted || book.status !== 'completed' || book.skillId !== output.skillId || !Number.isFinite(book.pages) || book.pages < 0 ||
        !Number.isFinite(book.totalPages) || book.totalPages < 0 || (book.totalPages > 0 && book.pages < book.totalPages) || seenBook.has(book.id)) return false;
    }
    if (output.projectId) seenProject.add(output.projectId);
    if (output.bookId) seenBook.add(output.bookId);
    return true;
  });
}

export function projectGame(data: GameData): Projection {
  const projection: Projection = {
    xp: 0, character: levelForXP(0),
    attributes: Object.fromEntries(ATTRIBUTES.map(attribute => [attribute.id, { xp: 0, level: 1 }])) as Projection['attributes'],
    skills: {}, regions: Object.fromEntries(REGIONS.map(region => [region.id, {
      seconds: 0, minutes: 0, outcomes: 0, completedProjects: 0, stage: 0,
      nextMinutes: 60, nextOutcomes: 1, needsProject: false,
    }])) as Projection['regions'],
    eligibleCosmetics: [], titles: [], totalOutputs: 0, totalProjects: 0,
  };
  const skillSeconds = new Map<string, number>();
  for (const skill of latestEntities(data.skills)) skillSeconds.set(skill.id, 0);
  for (const credit of creditedActivities(data)) {
    projection.xp += credit.seconds / 60;
    let remaining = credit.seconds;
    credit.allocations.forEach((allocation, index) => {
      const seconds = index === credit.allocations.length - 1 ? remaining : credit.seconds * allocation.percent / 100;
      remaining -= seconds;
      skillSeconds.set(allocation.skillId, (skillSeconds.get(allocation.skillId) || 0) + seconds);
      projection.regions[allocation.regionId].seconds += seconds;
      let attributeRemainder = seconds / 60;
      allocation.affinities.forEach((affinity, affinityIndex) => {
        const xp = affinityIndex === allocation.affinities.length - 1 ? attributeRemainder : seconds / 60 * affinity.percent / 100;
        attributeRemainder -= xp;
        projection.attributes[affinity.attribute].xp += xp;
      });
    });
  }
  const outputs = validOutputs(data);
  projection.totalOutputs = outputs.length;
  const completedWithOutput = new Set(outputs.map(output => output.projectId).filter((id): id is string => !!id));
  for (const project of latestEntities(data.projects)) if (completedProject(project) && completedWithOutput.has(project.id)) {
    projection.totalProjects++;
    if (REGION_IDS.has(project.regionId)) projection.regions[project.regionId].completedProjects++;
  }
  const skillOutcomes = new Map<string, number>();
  for (const output of outputs) {
    projection.regions[output.regionId].outcomes++;
    skillOutcomes.set(output.skillId, (skillOutcomes.get(output.skillId) || 0) + 1);
    if (!skillSeconds.has(output.skillId)) skillSeconds.set(output.skillId, 0);
  }
  for (const [skillId, seconds] of skillSeconds) {
    const minutes = seconds / 60; const outcomes = skillOutcomes.get(skillId) || 0;
    const skillProject = outputs.some(output => output.skillId === skillId && !!output.projectId && completedWithOutput.has(output.projectId));
    let milestone = 0;
    for (let index = 0; index < REGION_THRESHOLDS.length; index++) {
      if (minutes + 1e-9 >= REGION_THRESHOLDS[index] && outcomes >= index + 1 && (index < 2 || skillProject)) milestone = index + 1;
      else break;
    }
    projection.skills[skillId] = { ...levelForXP(minutes, 'skill'), minutes, outcomes, milestone };
  }
  for (const attribute of Object.values(projection.attributes)) attribute.level = 1 + Math.floor(Math.sqrt(attribute.xp / 100));
  for (const region of REGIONS) {
    const progress = projection.regions[region.id]; progress.minutes = progress.seconds / 60;
    for (let index = 0; index < REGION_THRESHOLDS.length; index++) {
      if (progress.minutes + 1e-9 >= REGION_THRESHOLDS[index] && progress.outcomes >= index + 1 && (index < 2 || progress.completedProjects > 0)) progress.stage = index + 1;
      else break;
    }
    progress.nextMinutes = progress.stage < 3 ? REGION_THRESHOLDS[progress.stage] : null;
    progress.nextOutcomes = progress.stage < 3 ? progress.stage + 1 : null;
    progress.needsProject = progress.stage === 2 && progress.completedProjects === 0;
    if (progress.stage === 3) projection.titles.push(`${region.shortName} Keeper`);
  }
  projection.character = levelForXP(projection.xp);
  projection.eligibleCosmetics = COSMETICS.filter(item => projection.regions[item.regionId].stage >= item.stage).map(item => item.id);
  return projection;
}

/** The same relevant-effort contract is shared by project UI and progression. */
export function projectEffortSeconds(project: Project, data: GameData): number {
  if (project.deleted) return 0;
  return creditedActivities(data).filter(credit => credit.activity.projectId === project.id)
    .reduce((sum, credit) => sum + credit.seconds * credit.allocations
      .filter(allocation => allocation.skillId === project.skillId)
      .reduce((percent, allocation) => percent + allocation.percent, 0) / 100, 0);
}

export function bossProgress(project: Project, data: GameData): number {
  if (project.deleted) return 0;
  const seconds = projectEffortSeconds(project, data);
  const target = positive(project.effortTargetSeconds);
  const effort = target ? Math.min(1, seconds / target) : 1;
  const required = (project.objectives || []).filter(objective => objective.required);
  const objectives = required.length ? required.filter(objective => objective.completed).length / required.length : 1;
  const output = validOutputs(data).some(evidence => evidence.projectId === project.id) ? 1 : 0;
  return Math.min(1, Math.max(0, .5 * effort + .2 * objectives + .3 * output));
}

export function focusElapsed(session: FocusSession, now = Date.now()): number {
  if (session.deleted || session.status === 'discarded') return 0;
  if (session.status === 'completed' && session.confirmedSeconds !== undefined) return positive(session.confirmedSeconds);
  const intervals = (session.segments || []).map(segment => ({ start: segment.start,
    end: segment.end === undefined && session.status === 'running' ? now : segment.end }))
    .filter((segment): segment is { start: number; end: number } => Number.isFinite(segment.start) && Number.isFinite(segment.end) && segment.end! > segment.start)
    .sort((a, b) => a.start - b.start);
  let end = -Infinity; let milliseconds = 0;
  for (const segment of intervals) {
    milliseconds += Math.max(0, segment.end - Math.max(segment.start, end));
    end = Math.max(end, segment.end);
  }
  return Math.max(0, milliseconds / 1000);
}

export function dayKey(date: string | number | Date, timeZone: string): string {
  const instant = new Date(date);
  if (!Number.isFinite(instant.getTime())) return '';
  let formatter: Intl.DateTimeFormat;
  try { formatter = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }); }
  catch { formatter = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }); }
  const parts = formatter.formatToParts(instant);
  const value = (type: string) => parts.find(part => part.type === type)?.value || '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

/** Daily seconds preserve total credited effort, including pauses, overlaps,
 * midnight crossings and DST. Untimed estimates retain their chosen date;
 * actual intervals retain the time zone recorded when the activity was logged. */
export function dailyEffort(data: GameData): Record<string, number> {
  const totals: Record<string, number> = {};
  const add = (date: string, seconds: number) => { if (date && seconds > 0) totals[date] = (totals[date] || 0) + seconds; };
  for (const credit of creditedActivities(data)) {
    if (!credit.intervals.length) { add(credit.activity.localDate, credit.seconds); continue; }
    for (const interval of credit.intervals) {
      let cursor = interval.start;
      while (cursor < interval.end) {
        const date = dayKey(cursor, credit.activity.timeZone);
        if (dayKey(interval.end - 1, credit.activity.timeZone) === date) {
          add(date, (interval.end - cursor) / 1000); break;
        }
        // Find the first millisecond on the next calendar day. This deliberately
        // does not assume that a local day lasts 24 hours.
        let low = cursor + 1; let high = interval.end;
        while (low < high) {
          const middle = Math.floor((low + high) / 2);
          if (dayKey(middle, credit.activity.timeZone) === date) low = middle + 1;
          else high = middle;
        }
        add(date, (low - cursor) / 1000); cursor = low;
      }
    }
  }
  return totals;
}

export function seedGame(mode: 'demo' | 'empty', name?: string): GameData {
  const now = new Date().toISOString();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const base = (id: string, at = now): BaseEntity => ({ id, revision: 0, createdAt: at, updatedAt: at });
  const skills = SKILLS.map(skill => ({ ...skill, affinities: skill.affinities.map(affinity => ({ ...affinity })),
    ...base(skill.id), equipped: ['frontend', 'acoustic-guitar', 'calisthenics'].includes(skill.id), archived: false }));
  const data: GameData = {
    profile: { ...base('profile'), displayName: name?.trim() || (mode === 'demo' ? 'Alex' : 'Wanderer'),
      avatarColor: '#a3c792', avatarStyle: 'wanderer', equipment: { emblem: 'starter-emblem', accessory: 'starter-accessory', outfit: 'starter-outfit' },
      timeZone, onboardingStep: mode === 'demo' ? 3 : 0, onboardingComplete: mode === 'demo', lastSkillId: 'frontend',
      motion: 'system', sound: false, theme: 'dark', lastOpenedAt: now, celebrationIds: [] },
    skills, activities: [], projects: [], quests: [], outputs: [], books: [], journals: [], focusSessions: [],
  };
  if (mode === 'empty') return data;
  skills.forEach(skill => { skill.equipped = ['frontend', 'acoustic-guitar', 'calisthenics', 'spanish', 'public-speaking', 'meditation'].includes(skill.id); });
  const ago = (days: number, hour = 10) => { const date = new Date(); date.setDate(date.getDate() - days); date.setHours(hour, 0, 0, 0); return date.toISOString(); };
  const projectBase = (id: string, title: string, skillId: string, regionId: RegionId, completed: boolean, actions: string[], target: number): Project => ({
    ...base(id, ago(12)), title, skillId, regionId, description: 'A small, deliberate project with a result you can point to.',
    outputCriterion: 'Keep a finished result and write one sentence about what changed.', status: completed ? 'completed' : 'active', archived: false,
    effortTargetSeconds: target * 60, objectives: actions.map((title, index) => ({ id: `${id}-step-${index}`, title, required: true, completed: completed || index < 2 })),
    ...(completed ? { completedAt: ago(3) } : {}),
  });
  data.projects = [
    projectBase('project-web', 'Build a quiet reading corner', 'frontend', 'foundry', false, ['Sketch one clear screen', 'Build the reading layout', 'Test keyboard navigation', 'Save the finished page'], 180),
    projectBase('project-spanish', 'A conversation for a new city', 'spanish', 'observatory', true, ['Choose a useful situation', 'Practice the exchange aloud', 'Record one complete conversation'], 90),
    projectBase('project-guitar', 'A twelve-bar moment', 'acoustic-guitar', 'atelier', true, ['Find a comfortable tempo', 'Practice the chord changes', 'Keep one clean recording'], 60),
  ];
  const log = (id: string, title: string, skillId: string, minutes: number, days: number, projectId?: string): Activity => ({
    ...base(id, ago(days)), title, seconds: minutes * 60, allocations: makeAllocations(skills, skillId),
    occurredAt: ago(days), localDate: dayKey(ago(days), timeZone), timeZone, source: 'manual', note: '', ...(projectId ? { projectId } : {}),
  });
  data.activities = [
    log('activity-web-1', 'Give the page a clear structure', 'frontend', 90, 11, 'project-web'),
    log('activity-web-2', 'Build a keyboard-friendly form', 'frontend', 90, 8, 'project-web'),
    log('activity-web-3', 'Make the small screen feel good', 'frontend', 80, 2, 'project-web'),
    log('activity-spanish-1', 'Practice a useful exchange', 'spanish', 60, 10, 'project-spanish'),
    log('activity-spanish-2', 'Speak without the script', 'spanish', 60, 5, 'project-spanish'),
    log('activity-french-1', 'Read a chapter slowly', 'french', 70, 9),
    log('activity-french-2', 'Finish the story and its notes', 'french', 70, 3),
    log('activity-guitar-1', 'A relaxed twelve-bar loop', 'acoustic-guitar', 60, 7, 'project-guitar'),
    log('activity-guitar-2', 'Keep the changes smooth', 'acoustic-guitar', 60, 4, 'project-guitar'),
    log('activity-training-1', 'A patient strength session', 'calisthenics', 45, 6),
    log('activity-training-2', 'Move well, finish fresh', 'calisthenics', 30, 1),
    log('activity-speaking', 'Make one introduction clear', 'public-speaking', 90, 4),
    log('activity-meditation', 'Leave a little space', 'meditation', 30, 1),
  ];
  data.books = [{ ...base('book-prince', ago(12)), title: 'The Little Prince', author: 'Antoine de Saint-Exupéry', status: 'completed',
    pages: 96, totalPages: 96, skillId: 'french', notes: 'Read for the sound of the language as much as the plot.', archived: false },
  { ...base('book-meditations', ago(6)), title: 'Meditations', author: 'Marcus Aurelius', status: 'reading',
    pages: 18, totalPages: 180, skillId: 'stoicism', notes: 'One passage, then one practical response.', archived: false }];
  const output = (id: string, title: string, skillId: string, regionId: RegionId, source: { projectId?: string; bookId?: string } = {}): Output => ({
    ...base(id, ago(3)), title, description: 'A finished result kept in the demo journal.', skillId, regionId, confirmedAt: ago(3), ...source,
  });
  data.outputs = [
    output('output-dialogue', 'A complete conversation, spoken aloud', 'spanish', 'observatory', { projectId: 'project-spanish' }),
    output('output-book', 'A story read in French', 'french', 'observatory', { bookId: 'book-prince' }),
    output('output-nav', 'A navigation prototype that works by keyboard', 'frontend', 'foundry'),
    output('output-form', 'A form with clear labels and feedback', 'frontend', 'foundry'),
    output('output-recording', 'One clean twelve-bar recording', 'acoustic-guitar', 'atelier', { projectId: 'project-guitar' }),
    output('output-introduction', 'A clear two-minute introduction', 'public-speaking', 'citadel'),
  ];
  data.quests = [
    { ...base('quest-keyboard'), title: 'Try the page using only the keyboard', skillId: 'frontend', projectId: 'project-web', objectiveId: 'project-web-step-2', status: 'pending', archived: false, priority: true, recurrence: 'none', note: 'Follow the focus ring from the first link to the last button.' },
    { ...base('quest-guitar'), title: 'Play the changes slowly for twenty minutes', skillId: 'acoustic-guitar', status: 'pending', archived: false, priority: false, recurrence: 'daily', note: 'Comfort before speed.' },
    { ...base('quest-mobility'), title: 'Take ten minutes to move comfortably', skillId: 'mobility', status: 'pending', archived: false, priority: false, recurrence: 'weekdays', note: '' },
    { ...base('quest-dialogue', ago(3)), title: 'Keep the finished conversation', skillId: 'spanish', projectId: 'project-spanish', objectiveId: 'project-spanish-step-2', status: 'completed', completedAt: ago(3), archived: false, priority: false, recurrence: 'none', note: 'The pauses were part of the practice.' },
  ];
  data.journals = [
    { ...base('journal-first-lights', ago(5)), title: 'The first lights', date: dayKey(ago(5), timeZone),
      body: 'Speaking without the script felt smaller and more useful than trying to learn everything at once. The Observatory has a little light now.', projectId: 'project-spanish' },
    { ...base('journal-guitar', ago(3)), title: 'Keep the take', date: dayKey(ago(3), timeZone),
      body: 'A clean recording at a comfortable tempo. Something finished is easier to build on than a perfect plan.', projectId: 'project-guitar' },
  ];
  const projected = projectGame(data);
  data.profile.equipment = { emblem: 'observatory-emblem', accessory: 'foundry-accessory', outfit: 'starter-outfit' };
  data.profile.celebrationIds = COSMETICS.filter(item => projected.eligibleCosmetics.includes(item.id)).map(item => `${item.regionId}-stage-${item.stage}`);
  return data;
}
