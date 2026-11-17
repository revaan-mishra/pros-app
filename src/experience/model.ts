import { bossProgress, creditedActivities, makeAllocations, projectEffortSeconds, projectGame, questObjectiveId, validOutputs } from '../domain';
import { experienceFor } from './preferences';
import type { Activity, Allocation, FocusSession, GameData, Mutation, Output, Project, RegionId } from '../types';

export type KeepsakeKind = 'volume' | 'folio' | 'mechanism' | 'seal';
export interface Keepsake { id: string; kind: KeepsakeKind; output: Output; regionId: RegionId; source: string; href: string }
export function keepsakesFor(data: GameData): Keepsake[] {
  return validOutputs(data).map(output => ({
    id: output.id, output, regionId: output.regionId,
    kind: output.bookId ? 'volume' as const : output.regionId === 'foundry' ? 'mechanism' as const : ['citadel', 'training', 'sanctuary'].includes(output.regionId) ? 'seal' as const : 'folio' as const,
    source: output.projectId ? data.projects.find(p => p.id === output.projectId)?.title || 'Project' : output.bookId ? data.books.find(b => b.id === output.bookId)?.title || 'Book' : data.skills.find(s => s.id === output.skillId)?.name || 'Finished work',
    href: output.projectId ? `/projects/${encodeURIComponent(output.projectId)}` : output.bookId ? '/library' : `/outputs?output=${encodeURIComponent(output.id)}`,
  })).sort((a, b) => b.output.confirmedAt.localeCompare(a.output.confirmedAt) || a.id.localeCompare(b.id));
}
export function displayedKeepsakes(data: GameData): (Keepsake | null)[] {
  const byId = new Map(keepsakesFor(data).map(item => [item.id, item]));
  return experienceFor(data.profile).keepsakeSlots.map(id => id ? byId.get(id) || null : null);
}
export function chooseExpedition(data: GameData): { project?: Project; reason: string; pinned: boolean } {
  const prefs = experienceFor(data.profile);
  const pinned = data.projects.find(p => p.id === prefs.pinnedProjectId && !p.deleted && !p.archived && ['active', 'paused'].includes(p.status));
  if (pinned) return { project: pinned, reason: 'Pinned by you', pinned: true };
  const available = data.projects.filter(p => !p.deleted && !p.archived && p.status === 'active' && !prefs.dismissedProjectIds.includes(p.id));
  const priority = data.quests.find(q => !q.deleted && !q.archived && q.priority && q.status === 'pending' && available.some(p => p.id === q.projectId));
  if (priority) return { project: available.find(p => p.id === priority.projectId), reason: 'Suggested from your chosen priorities', pinned: false };
  const recent = [...data.activities].filter(a => !a.deleted && available.some(p => p.id === a.projectId)).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0];
  if (recent) return { project: available.find(p => p.id === recent.projectId), reason: 'Suggested from your recent project work', pinned: false };
  const project = available.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id))[0];
  return { project, reason: project ? 'Suggested from your recently updated projects' : 'Choose a project when you are ready', pinned: false };
}
export function expeditionFor(data: GameData, project: Project) {
  const required = project.objectives.filter(o => o.required);
  const done = required.filter(o => o.completed).length;
  const effort = projectEffortSeconds(project, data);
  const output = validOutputs(data).find(o => o.projectId === project.id);
  const nextObjective = required.find(o => !o.completed);
  const nextQuest = data.quests.find(q => !q.deleted && !q.archived && q.status === 'pending' && q.recurrence === 'none' && (nextObjective ? questObjectiveId(q, project) === nextObjective.id : q.projectId === project.id));
  return { required, done, effort, output, nextObjective, nextQuest,
    preparation: required.length ? done / required.length : 1,
    practice: project.effortTargetSeconds ? Math.min(1, effort / project.effortTargetSeconds) : 1,
    progress: bossProgress(project, data), canComplete: done === required.length && effort >= project.effortTargetSeconds,
    nextLabel: nextObjective?.title || (effort < project.effortTargetSeconds ? 'Continue your practice' : output ? 'Revisit your finished work' : 'Confirm your finished output'),
  };
}
export function completeProjectMutations(data: GameData, project: Project, at = new Date().toISOString()): Mutation[] {
  if (!expeditionFor(data, project).canComplete || project.archived || project.deleted || project.status !== 'active') throw new Error('Resume the project and finish its preparation and relevant effort before confirming the output.');
  const canonicalId = `output-project-${project.id}`;
  const old = data.outputs.find(o => o.id === canonicalId) || data.outputs.find(o => o.projectId === project.id && !o.deleted) || data.outputs.find(o => o.projectId === project.id);
  const id = old?.id || canonicalId;
  const output: Output = { ...(old || { id, revision: 0, createdAt: at, updatedAt: at }), title: project.outputCriterion.slice(0,200), description: old?.description || `${project.outputCriterion}\n\n${project.description}`.trim().slice(0,50000), skillId: project.skillId, regionId: project.regionId, projectId: project.id, confirmedAt: old?.confirmedAt || at, deleted: false };
  return [{ kind: 'projects', entity: { ...project, status: 'completed', completedAt: at } }, { kind: 'outputs', entity: output }];
}
export function projectEditMutations(data: GameData, edited: Project, at = new Date().toISOString()): Mutation[] {
  const old = data.projects.find(p => p.id === edited.id);
  const project = { ...edited };
  if (old?.status === 'completed' && (old.skillId !== project.skillId || old.outputCriterion !== project.outputCriterion || !expeditionFor(data, project).canComplete)) {
    project.status = 'active'; delete project.completedAt;
  }
  const mutations: Mutation[] = [{ kind: 'projects', entity: project }];
  const linked = data.quests.filter(q => !q.deleted && !q.occurrenceOf && q.projectId === project.id && (q.objectiveId || (old && questObjectiveId(q, old))));
  for (const objective of project.objectives) {
    const matches = linked.filter(q => (q.objectiveId || (old && questObjectiveId(q, old))) === objective.id);
    const records = matches.length ? matches : [{ id: `quest-objective-${objective.id}`, revision: 0, createdAt: at, updatedAt: at, title: objective.title, skillId: project.skillId, projectId: project.id, objectiveId: objective.id, status: 'pending' as const, archived: false, priority: false, recurrence: 'none' as const, note: '' }];
    // Reintroducing a removed objective explicitly restores its next action. An
    // intentionally archived quest for an objective that stayed present remains archived.
    const reintroduced = !!old && !old.objectives.some(item => item.id === objective.id);
    for (const record of records) mutations.push({ kind: 'quests', entity: { ...record, archived: reintroduced ? false : record.archived, title: objective.title.slice(0,200), skillId: project.skillId, objectiveId: objective.id, status: objective.completed ? 'completed' : 'pending', ...(objective.completed ? { completedAt: record.completedAt || at } : { completedAt: undefined }) } });
  }
  for (const quest of linked) if (!project.objectives.some(o => o.id === (quest.objectiveId || (old && questObjectiveId(quest, old))))) mutations.push({ kind: 'quests', entity: { ...quest, archived: true } });
  return mutations;
}
export function newFocusSession(data: GameData, skillId: string, options: { projectId?: string; questId?: string; minutes?: number; stopwatch?: boolean } = {}, stamp = Date.now(), id: string = crypto.randomUUID()): FocusSession {
  if (data.focusSessions.some(s => !s.deleted && ['running', 'paused', 'review'].includes(s.status))) throw new Error('Return to your current focus session before starting another.');
  if (!data.skills.some(s => s.id === skillId && !s.deleted && !s.archived)) throw new Error('Choose an available skill.');
  const minutes = options.minutes ?? experienceFor(data.profile).focusMinutes;
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 180) throw new Error('Choose a session between 1 and 180 minutes.');
  if (options.projectId && !data.projects.some(p => p.id === options.projectId && !p.deleted && !p.archived && p.status === 'active' && p.skillId === skillId)) throw new Error('Choose an active project for this skill.');
  const at = new Date(stamp).toISOString();
  return { id, revision: 0, createdAt: at, updatedAt: at, skillId, ...(options.projectId ? { projectId: options.projectId } : {}), ...(options.questId ? { questId: options.questId } : {}), targetSeconds: options.stopwatch ? null : Math.round(minutes * 60), status: 'running', segments: [{ start: stamp }] };
}
export interface CaptureContext { activityId?: string; focusSessionId?: string; bookId?: string; questId?: string; projectId?: string; skillId?: string }
export function captureDraftKey(context: CaptureContext = {}): string {
  return `activity-v2:${context.activityId ? `edit:${context.activityId}` : context.focusSessionId ? `focus:${context.focusSessionId}` : context.bookId ? `book:${context.bookId}` : context.questId ? `quest:${context.questId}` : context.projectId ? `project:${context.projectId}` : context.skillId ? `skill:${context.skillId}` : 'manual'}`;
}
export function historicalAllocations(data: GameData, primary: string, secondary: string, percent: number, editing?: Activity): Allocation[] {
  if (editing && editing.allocations[0]?.skillId === primary && (editing.allocations[1]?.skillId || '') === secondary && (editing.allocations[0]?.percent === percent || !secondary)) return structuredClone(editing.allocations);
  return makeAllocations(data.skills, primary, secondary, percent);
}
export function activityReceipt(data: GameData, activity: Activity): string {
  const after = { ...data, activities: [...data.activities.filter(a => a.id !== activity.id), activity] };
  const before = projectGame(data); const next = projectGame(after);
  const credit = creditedActivities(after).find(c => c.activity.id === activity.id);
  const minutes = new Intl.NumberFormat('en', { maximumFractionDigits: 1 }).format(activity.seconds / 60);
  const delta = new Intl.NumberFormat('en', { maximumFractionDigits: 1 }).format(next.xp - before.xp);
  const first = activity.allocations[0];
  const skill = data.skills.find(s => s.id === first?.skillId);
  const skillDelta = (next.skills[first?.skillId]?.xp || 0) - (before.skills[first?.skillId]?.xp || 0);
  return `${minutes} min recorded · ${skill?.name || 'Skill'} ${skillDelta >= 0 ? '+' : ''}${new Intl.NumberFormat('en', { maximumFractionDigits: 1 }).format(skillDelta)} XP · Character ${next.xp >= before.xp ? '+' : ''}${delta} XP${credit && credit.seconds < activity.seconds ? ' · Overlapping time credited once' : ''}`;
}
