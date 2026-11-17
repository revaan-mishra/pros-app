import { dayKey, projectGame, questObjectiveId, projectEffortSeconds, validOutputs } from '../domain';
import { displayedKeepsakes } from './model';
import type { Book, FocusSession, GameData, GameEntity, Mutation, Output, Quest } from '../types';

export function changedGame(data: GameData, mutations: Mutation[]): GameData {
  const next = { ...data };
  for (const mutation of mutations) {
    if (mutation.kind === 'profile') next.profile = mutation.entity as GameData['profile'];
    else (next[mutation.kind] as GameEntity[]) = [...next[mutation.kind].filter(e => e.id !== mutation.entity.id), mutation.entity];
  }
  return next;
}
export function changeImpact(data: GameData, mutations: Mutation[]) {
  const next = changedGame(data, mutations); const before = projectGame(data); const after = projectGame(next);
  const outputIds = new Set(validOutputs(next).map(o => o.id)); const nextSlots = displayedKeepsakes(next);
  return { before, after, next,
    lostCosmetics: before.eligibleCosmetics.filter(id => !after.eligibleCosmetics.includes(id)),
    lostOutputs: validOutputs(data).filter(o => !outputIds.has(o.id)),
    changedSlots: displayedKeepsakes(data).flatMap((k, i) => k && !nextSlots[i] ? [i + 1] : []),
  };
}
function dateValid(value: string) { const date = new Date(`${value}T12:00:00Z`); return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value; }
export function rescheduledQuest(quest: Quest, date?: string, at = new Date().toISOString(), eventId: string = crypto.randomUUID()): Quest {
  if (date && !dateValid(date)) throw new Error('Choose a valid calendar date.');
  if (quest.dueDate === date) return { ...quest };
  if ((quest.scheduleHistory?.length || 0) >= 1000) throw new Error('This quest has reached its scheduling-history limit. Archive it and create a new quest.');
  const next = { ...quest, originalDueDate: quest.scheduleHistory?.length ? quest.originalDueDate : quest.originalDueDate || quest.dueDate,
    scheduleHistory: [...(quest.scheduleHistory || []), { id: eventId, at, ...(quest.dueDate ? { from: quest.dueDate } : {}), ...(date ? { to: date } : {}) }],
  };
  if (date) next.dueDate = date; else delete next.dueDate;
  return next;
}
export function questEditMutations(data: GameData, proposed: Quest): Mutation[] {
  const old = data.quests.find(q => q.id === proposed.id);
  let quest = { ...proposed };
  if (old?.occurrenceOf && (quest.occurrenceOf !== old.occurrenceOf || quest.recurrence !== 'none')) throw new Error('Edit the routine template to change repetition. This occurrence keeps its identity.');
  if (quest.parentId) {
    let parent = data.quests.find(q => q.id === quest.parentId && !q.deleted);
    if (!parent) throw new Error('Choose an existing parent quest.');
    const seen = new Set([quest.id]);
    while (parent) { if (seen.has(parent.id)) throw new Error('A quest cannot become its own ancestor.'); seen.add(parent.id); parent = data.quests.find(q => q.id === parent?.parentId); }
  }
  const project = old?.projectId ? data.projects.find(p => p.id === old.projectId && !p.deleted) : undefined;
  const objectiveId = project && old ? questObjectiveId(old, project) : undefined;
  if (objectiveId && (quest.projectId !== project!.id || quest.skillId !== project!.skillId)) throw new Error('This preparation quest follows its project’s skill and identity. Edit the project to change them.');
  if (old) { const scheduled = rescheduledQuest(old, quest.dueDate); quest = { ...quest, scheduleHistory: scheduled.scheduleHistory, originalDueDate: scheduled.originalDueDate }; }
  const mutations: Mutation[] = [{ kind: 'quests', entity: quest }];
  if (project && objectiveId) mutations.push({ kind: 'projects', entity: { ...project, objectives: project.objectives.map(o => o.id === objectiveId ? { ...o, title: quest.title } : o) } });
  return mutations;
}
export function outputChangeMutations(data: GameData, output: Output): Mutation[] {
  const old = data.outputs.find(o => o.id === output.id);
  if (old && (old.projectId !== output.projectId || old.bookId !== output.bookId)) throw new Error('An output keeps its original project or book link.');
  if (output.projectId || output.bookId) {
    const source = output.projectId ? data.projects.find(p => p.id === output.projectId) : data.books.find(b => b.id === output.bookId);
    const skill = source && data.skills.find(s => s.id === source.skillId);
    if (!source || output.skillId !== source.skillId || output.regionId !== (output.projectId ? data.projects.find(p => p.id === output.projectId)?.regionId : skill?.regionId)) {
      // Historical linked outputs may use an earlier region snapshot; metadata-only edits preserve it.
      if (!old || old.skillId !== output.skillId || old.regionId !== output.regionId) throw new Error('A linked output follows its source skill and region.');
    }
    if (!old) throw new Error('Confirm this output from its project or book so completion stays consistent.');
  }
  const mutations: Mutation[] = [{ kind: 'outputs', entity: output }];
  if (output.deleted && !old?.deleted) {
    const project = data.projects.find(p => p.id === output.projectId && !p.deleted);
    if (project?.status === 'completed') { const reopened = { ...project, status: 'active' as const }; delete reopened.completedAt; mutations.push({ kind: 'projects', entity: reopened }); }
    const book = data.books.find(b => b.id === output.bookId && !b.deleted);
    if (book?.status === 'completed') mutations.push({ kind: 'books', entity: { ...book, status: 'reading' } });
  }
  return mutations;
}
export function completeBookMutations(data: GameData, book: Book, at = new Date().toISOString()): Mutation[] {
  const skill = data.skills.find(s => s.id === book.skillId);
  if (!skill || book.deleted) throw new Error('This book or its skill is unavailable.');
  const old = data.outputs.find(o => o.id === `output-book-${book.id}`) || data.outputs.find(o => o.bookId === book.id);
  const output: Output = { ...(old || { id: `output-book-${book.id}`, revision: 0, createdAt: at, updatedAt: at }), title: old?.title || `Finished ${book.title}`.slice(0,200), description: old?.description || book.notes, skillId: skill.id, regionId: old?.skillId === skill.id ? old.regionId : skill.regionId, bookId: book.id, confirmedAt: old?.confirmedAt || at, deleted: false };
  return [{ kind: 'books', entity: { ...book, status: 'completed', pages: book.totalPages || book.pages } }, { kind: 'outputs', entity: output }];
}
export function continuationMutations(data: GameData, session: FocusSession, note: string, createQuest: boolean, title: string, at = new Date().toISOString()): Mutation[] {
  if (session.deleted || session.status !== 'completed') throw new Error('Confirm the focus session before editing its continuation.');
  if (note.length > 2000) throw new Error('Keep the continuation note within 2,000 characters.');
  const updated = { ...session, continuationNote: note.trim() };
  const mutations: Mutation[] = [{ kind: 'focusSessions', entity: updated }];
  if (!createQuest) return mutations;
  const id = session.continuationQuestId || `next-${session.id}`;
  if (id.length > 160) throw new Error('Create this next action from Quests instead.');
  updated.continuationQuestId = id;
  const existing = data.quests.find(q => q.id === id);
  if (existing) {
    if (existing.deleted) mutations.push({ kind: 'quests', entity: { ...existing, deleted: false } });
    return mutations;
  }
  if (!title.trim() || title.trim().length > 200) throw new Error('Give the next action a title within 200 characters.');
  const project = data.projects.find(p => p.id === session.projectId && !p.deleted && !p.archived && p.status === 'active' && p.skillId === session.skillId);
  mutations.push({ kind: 'quests', entity: { id, revision: 0, createdAt: at, updatedAt: at, title: title.trim(), skillId: session.skillId, ...(project ? { projectId: project.id } : {}), dueDate: dayKey(at, data.profile.timeZone), status: 'pending', archived: false, priority: false, recurrence: 'none', note: note.trim() } });
  return mutations;
}
export function routineOccurrenceMutations(data: GameData, at = new Date().toISOString()): Mutation[] {
  const today = dayKey(at, data.profile.timeZone); const weekday = new Date(`${today}T12:00:00Z`).getUTCDay(); const existing = new Set(data.quests.map(q => q.id));
  return data.quests.filter(q => !q.deleted && !q.archived && q.recurrence !== 'none').flatMap(template => {
    const start = template.dueDate || dayKey(template.createdAt, data.profile.timeZone);
    if (start > today || (template.recurrence === 'weekdays' && [0,6].includes(weekday)) || (template.recurrence === 'weekly' && new Date(`${start}T12:00:00Z`).getUTCDay() !== weekday)) return [];
    const id = `${template.id}@${today}`; if (existing.has(id)) return [];
    const quest: Quest = { ...template, id, revision: 0, createdAt: at, updatedAt: at, recurrence: 'none', occurrenceOf: template.id, dueDate: today, originalDueDate: today, scheduleHistory: [], status: 'pending' };
    delete quest.completedAt; delete quest.skippedAt; delete quest.objectiveId;
    return [{ kind: 'quests' as const, entity: quest }];
  });
}
