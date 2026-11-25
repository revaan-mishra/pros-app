import { z } from '../validation';
import type { ModalState } from '../app-context';
import type { BackupDraft, GameData } from '../types';

const id = z.string().min(1).max(160).regex(/^[A-Za-z0-9_.:@-]+$/);
const date = z.string().refine(value => !value || /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0,10) === value, 'Choose a valid calendar date.');
const meta = { recordId: id, commandId: id, baseRevision: z.number().int().min(-1), createdAt: z.string().datetime({ offset: true }) };
export const questDraftSchema = z.object({ ...meta, title: z.string().max(200), skillId: id, date, recurrence: z.enum(['none','daily','weekdays','weekly']), projectId: z.string().max(160), parentId: z.string().max(160), note: z.string().max(50000), priority: z.boolean() }).strict();
export const projectDraftSchema = z.object({ ...meta, title: z.string().max(200), description: z.string().max(50000), criterion: z.string().max(10000), skillId: id, effort: z.string().max(20), date, status: z.enum(['draft','active','paused','completed']), objectives: z.array(z.object({ id, title: z.string().max(500), required: z.boolean(), completed: z.boolean() }).strict()).max(100).refine(v => new Set(v.map(o=>o.id)).size === v.length, 'Preparation identities must be unique.') }).strict();
export const bookDraftSchema = z.object({ ...meta, title: z.string().max(200), author: z.string().max(200), pages: z.string().max(12), total: z.string().max(12), status: z.enum(['wishlist','reading','paused','completed']), notes: z.string().max(50000), skillId: id }).strict();
export const outputDraftSchema = z.object({ ...meta, title: z.string().max(200), description: z.string().max(50000), skillId: id }).strict();
export const journalDraftSchema = z.object({ ...meta, title: z.string().max(200), body: z.string().max(100000), date, projectId: z.string().max(160), bookId: z.string().max(160) }).strict();
export const continuationDraftSchema = z.object({ ...meta, note: z.string().max(2000), createQuest: z.boolean(), questTitle: z.string().max(200) }).strict();
export const scheduleDraftSchema = z.object({ ...meta, date }).strict();

export function draftDestination(draft: BackupDraft, data: GameData): ModalState {
  const parts = draft.name.split(':'); const [kind, action] = parts;
  if (['project','quest','book','output','journal'].includes(kind)) {
    const id = action === 'new' ? undefined : parts.slice(1).join(':'); const context = parts.slice(2).join(':');
    if (kind === 'project') return { type: 'project', id, ...(action === 'new' && context && context !== 'general' ? { skillId: context } : {}) };
    if (kind === 'quest') return { type: 'quest', id, ...(action === 'new' && context && context !== 'general' ? { projectId: context } : {}) };
    if (kind === 'output') return { type: 'output', id, ...(action === 'new' && parts[2] === 'project' ? { projectId: parts.slice(3).join(':') } : action === 'new' && parts[2] === 'skill' ? { skillId: parts.slice(3).join(':') } : {}) };
    if (kind === 'book') return { type: 'book', id };
    return { type: 'journal', id };
  }
  if (kind === 'continuation' && action) return { type: 'continuation', id: parts.slice(1).join(':') };
  if (kind === 'schedule' && action) return { type: 'schedule', id: parts.slice(1).join(':') };
  if (kind === 'activity-v2') {
    const id = parts.slice(2).join(':');
    if (action === 'edit') return { type: 'correction', activityId: id };
    const options = action === 'focus' ? { focusSessionId: id, skillId: data.focusSessions.find(s => s.id === id)?.skillId } : action === 'quest' ? { questId: id } : action === 'book' ? { bookId: id } : action === 'project' ? { projectId: id } : action === 'skill' ? { skillId: id } : undefined;
    return { type: 'log', options };
  }
  if (draft.name === 'activity-new') return { type: 'log' };
  if (draft.name.startsWith('activity-')) {
    const id = draft.name.slice(9);
    if (data.activities.some(a => a.id === id)) return { type: 'correction', activityId: id };
    if (data.focusSessions.some(s => s.id === id)) return { type: 'log', options: { focusSessionId: id } };
  }
  return null;
}
