import { useLiveQuery } from 'dexie-react-hooks';
import { useGame } from '../app-context';
import { listDrafts } from '../storage';
import { Button, SectionTitle } from '../components/ui';
import { downloadJSON } from './DraftNotice';
import { draftDestination } from './record-drafts';
import type { DraftJSON } from '../types';

export function draftText(value: DraftJSON): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return String(value ?? '');
  return Object.entries(value).flatMap(([key, item]) => {
    if (['id','revision','updatedAt','recordId','commandId','baseRevision','createdAt','skillId','projectId','bookId','parentId','questId'].includes(key)) return [];
    if (key === 'objectives' && Array.isArray(item)) return item.map(o => o && typeof o === 'object' && !Array.isArray(o) ? `Preparation: ${o.title} (${o.completed ? 'complete' : 'open'}${o.required ? ', required' : ''})` : '');
    if ((key === 'affinities' || key === 'allocations') && Array.isArray(item)) return [key + ': ' + item.map(v => v && typeof v === 'object' && !Array.isArray(v) ? `${v.attribute || v.skillId}: ${v.percent}%` : '').join(', ')];
    if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') return [`${key}: ${String(item)}`];
    return [];
  }).join('\n\n');
}
export function SavedDrafts() {
  const { accountId, data, setModal } = useGame();
  const result = useLiveQuery(async () => { try { return { drafts: await listDrafts(accountId), error: '' }; } catch (e) { return { drafts: [], error: e instanceof Error ? e.message : 'Drafts could not be read.' }; } }, [accountId]);
  const drafts = result?.drafts.filter(d => draftDestination(d, data));
  return <section className="card"><SectionTitle title="Unfinished drafts" subtitle="Resume work saved on this device. Full backups include these drafts."/>{result?.error && <p role="alert" className="form-error">{result.error}</p>}{!result ? <p role="status">Reading drafts…</p> : drafts?.length ? drafts.map(d => {
    const value = d.value && typeof d.value === 'object' && !Array.isArray(d.value) ? d.value : {};
    const title = typeof value.title === 'string' && value.title ? value.title : typeof value.note === 'string' && value.note ? value.note.slice(0,90) : `${d.name.startsWith('activity')?'Activity':d.name.split(':')[0]} draft`;
    return <div className="saved-draft-row" key={d.name}><div><strong>{title}</strong><small>{new Intl.DateTimeFormat('en',{dateStyle:'medium',timeStyle:'short',timeZone:data.profile.timeZone}).format(new Date(d.updatedAt))}</small></div><div className="button-row"><Button variant="secondary" onClick={()=>setModal(draftDestination(d,data))}>Resume</Button><Button variant="ghost" onClick={()=>downloadJSON({format:'pros-draft',version:1,draft:d},'PROS-work-draft.json')}>Export draft</Button></div></div>;
  }) : <p className="muted">No unfinished forms on this device.</p>}</section>;
}
