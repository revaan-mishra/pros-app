import { intervalEvidenceDate } from './experience/focus-selection';
import { DraftNotice } from './experience/DraftNotice';
import { lazy, Suspense, useRef, useState, type FormEvent } from 'react';
import { Check, Clock3, Flag, Plus, Sparkles, Trash2 } from 'lucide-react';
import { base, useGame } from './app-context';
import { REGIONS } from './catalog';
import { dayKey, projectGame, questStatusMutations } from './domain';
import { db } from './storage';
import { Button, Dialog, Field, formatNumber } from './components/ui';
import type { Activity, Mutation, RegionId, Skill } from './types';
import { useDraft } from './experience/useDraft';
import { activityReceipt, captureDraftKey, historicalAllocations } from './experience/model';
import { SmartCapture } from './assistance/SmartCapture';
import { useNavigate } from 'react-router-dom';

const RegionStory = lazy(() => import('./experience/RegionStory').then(m => ({ default: m.RegionStory })));

const RecordForms = lazy(() => import('./experience/RecordForms').then(m => ({ default: m.RecordForms })));

export function ModalHost() {
  const { modal, setModal } = useGame();
  if (!modal) return null;
  const close = () => setModal(null);
  if (modal.type === 'log' || modal.type === 'correction') return <ActivityForm key={modal.type === 'correction' ? modal.activityId : captureDraftKey(modal.options)} close={close}/>;
  if (['quest','project','output','book','journal','continuation','schedule'].includes(modal.type)) return <Suspense fallback={<Dialog title="Opening your saved draft…" onClose={close}><p role="status">Preparing the form.</p></Dialog>}><RecordForms key={JSON.stringify(modal)} close={close}/></Suspense>;
  if (modal.type === 'skill') return <SkillForm close={close}/>;
  if (modal.type === 'story') return <Suspense fallback={<Dialog title="Opening this chapter…" onClose={close}><p role="status">Preparing the illustrated chapter.</p></Dialog>}><RegionStory key={modal.regionId} regionId={modal.regionId as RegionId} close={close}/></Suspense>;
  return null;
}
function ActivityForm({ close }: { close: () => void }) {
  const { data, modal, accountId, run, busy, projection } = useGame();
  const navigate = useNavigate();
  const [editing] = useState(() => modal?.type === 'correction' ? data.activities.find(a => a.id === modal.activityId) : undefined);
  const options = modal?.type === 'log' ? modal.options : undefined;
  const linkedQuest = data.quests.find(q => q.id === options?.questId);
  const initialSkill = options?.skillId || linkedQuest?.skillId || editing?.allocations[0]?.skillId || data.profile.lastSkillId || data.skills.find(s => s.equipped)?.id || data.skills[0]?.id;
  const sourceFocus=data.focusSessions.find(s=>s.id===(options?.focusSessionId||editing?.focusSessionId));
  const timedDate=intervalEvidenceDate(editing,sourceFocus,data.profile.timeZone);
  const [identity] = useState(() => base(options?.focusSessionId ? `activity-focus-${options.focusSessionId}` : undefined));
  const [initialCommandId] = useState(() => crypto.randomUUID()); const [savedAttempt,setSavedAttempt] = useState(false);
  const draftName = captureDraftKey(editing ? { activityId: editing.id } : options);
  const legacyName = editing ? `activity-${editing.id}` : options?.focusSessionId ? `activity-${options.focusSessionId}` : !options || !Object.values(options).some(Boolean) ? 'activity-new' : undefined;
  const [draft, setDraft, clear, draftReady, flushDraft, draftState] = useDraft(accountId, draftName, {
    recordId: editing?.id || identity.id, commandId: initialCommandId, baseRevision: editing?.revision || 0, createdAt: editing?.createdAt || identity.createdAt,
    title: editing?.title || linkedQuest?.title || '', skillId: initialSkill, secondaryId: editing?.allocations[1]?.skillId || '',
    primaryPercent: editing?.allocations[0]?.percent || 70, minutes: String(editing ? editing.seconds / 60 : options?.seconds ? options.seconds / 60 : 25),
    date: timedDate || editing?.localDate || dayKey(new Date(), data.profile.timeZone), note: editing?.note || '',
    projectId: editing?.projectId || options?.projectId || linkedQuest?.projectId || '', questId: editing?.questId || options?.questId || '', complete: options?.complete || false,
    continuationNote: data.focusSessions.find(s => s.id === options?.focusSessionId)?.continuationNote || '',
    smartText: '',
  }, legacyName);
  const sending = useRef(false); const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(''); const [confirmDelete, setConfirmDelete] = useState(false);
  const change = (key: string, value: unknown) => setDraft(old => ({ ...old, [key]: value, ...(key === 'skillId' && old.secondaryId === value ? { secondaryId: '' } : {}) }));
  const skill = data.skills.find(s => s.id === draft.skillId); const seconds = Math.round(Number(draft.minutes) * 60);
  const savedRecord = data.activities.find(a=>a.id===(editing?.id || draft.recordId));
  const activityConflict = !!savedRecord && savedRecord.revision !== draft.baseRevision;
  const proposed: Activity = { ...(editing || data.activities.find(a => a.id === draft.recordId) || identity), id: editing?.id || draft.recordId, deleted: false, title: draft.title.trim() || `${skill?.name || 'Practice'} session`, seconds, allocations: historicalAllocations(data, draft.skillId, draft.secondaryId, draft.primaryPercent, editing || data.activities.find(a=>a.id===draft.recordId)), occurredAt: editing?.occurredAt || data.activities.find(a => a.id === draft.recordId)?.occurredAt || draft.createdAt, localDate: timedDate || draft.date, timeZone: editing?.timeZone || savedRecord?.timeZone || data.profile.timeZone, note: draft.note, source: editing?.source || savedRecord?.source || (options?.focusSessionId ? 'focus' : options?.bookId ? 'reading' : 'manual'), ...(draft.questId ? { questId: draft.questId } : {}), ...(draft.projectId ? { projectId: draft.projectId } : {}), ...(options?.bookId || editing?.bookId ? { bookId: options?.bookId || editing?.bookId } : {}), ...(options?.focusSessionId || editing?.focusSessionId ? { focusSessionId: options?.focusSessionId || editing?.focusSessionId } : {}), ...(editing?.startedAt ? { startedAt: editing.startedAt, endedAt: editing.endedAt } : {}) };
  proposed.revision = draft.baseRevision;
  if (!draft.questId) delete proposed.questId;
  if (!draft.projectId) delete proposed.projectId;
  const preview = Number.isFinite(seconds) && seconds > 0 && proposed.allocations.length ? projectGame({ ...data, activities: [...data.activities.filter(a => a.id !== proposed.id), proposed] }) : projection;
  const removed = projection.eligibleCosmetics.filter(id => !preview.eligibleCosmetics.includes(id));
  async function submit(event: FormEvent) {
    event.preventDefault(); if (sending.current) return; setError('');
    if (!Number.isFinite(seconds) || seconds < 1 || seconds > 86400 || !proposed.allocations.length) { setError('Choose a skill and a duration between one second and 24 hours.'); return; }
    if (!proposed.localDate || proposed.localDate > dayKey(new Date(), proposed.timeZone)) { setError('Choose today or an earlier date.'); return; }
    if (activityConflict) { setError('Review the saved record before applying this older draft.'); return; }
    sending.current = true; setSubmitting(true);
    try {
    if (await db.commands.get([accountId,draft.commandId])) { setSavedAttempt(true); throw new Error('This submission was already saved. Compare the saved record before applying further draft edits.'); }
    const mutations: Mutation[] = [{ kind: 'activities', entity: proposed }];
    if (draft.complete && draft.questId) { const q = data.quests.find(q => q.id === draft.questId); if (q) mutations.push(...questStatusMutations(data, q, 'completed')); }
    if (options?.focusSessionId) { const focus = data.focusSessions.find(f => f.id === options.focusSessionId); if (focus) mutations.push({ kind: 'focusSessions', entity: { ...focus, status: 'completed', continuationNote: draft.continuationNote.trim(), confirmedSeconds: seconds, segments: focus.segments.map(s => ({ ...s, end: s.end ?? Date.now() })) } }); }
    if (data.profile.lastSkillId !== draft.skillId) mutations.push({ kind: 'profile', entity: { ...data.profile, lastSkillId: draft.skillId } });
    await flushDraft();
    await run(mutations, activityReceipt(data, proposed), draft.commandId, { name: draftName, value: draft });
    // Acknowledged work stays successful even if removing its draft fails.
    void clear().catch(() => {}); close();
    } catch (e) { draftState.reportConflict(e); setError(e instanceof Error ? e.message : 'Your activity could not be saved.'); } finally { sending.current = false; setSubmitting(false); }
  }
  async function remove() { if (!editing) return; try { await run([{ kind: 'activities', entity: { ...editing, deleted: true } }], 'Activity removed · progress recalculated'); void clear().catch(() => {}); close(); } catch (e) { setError(String(e)); } }
  async function preserveClose() { if (sending.current) return; if (!draftReady) { close(); return; } try { await flushDraft(); close(); } catch (e) { setError(e instanceof Error ? e.message : 'Export the draft before closing.'); } }
  async function openLibrary() { if (sending.current || !draftReady) return; try { await flushDraft(); close(); navigate('/library'); } catch (e) { setError(e instanceof Error ? e.message : 'Keep this draft open until it can be saved.'); } }
  return <Dialog title={editing ? 'Refine your record' : options?.focusSessionId ? 'A little time, well spent.' : 'What did you work on?'} eyebrow={editing ? 'ACTIVITY DETAILS' : 'LOG YOUR EFFORT'} onClose={() => void preserveClose()}><form onSubmit={submit} className="form-stack" aria-busy={!draftReady}><fieldset disabled={!draftReady || busy || submitting} className="form-fields">
    {!editing && !options?.focusSessionId && !options?.bookId && <SmartCapture text={draft.smartText} onText={value => change('smartText', value)} skills={data.skills} projects={data.projects} timeZone={data.profile.timeZone} linkedProjectId={draft.projectId} linkedSkillId={draft.questId ? data.quests.find(quest => quest.id === draft.questId)?.skillId : undefined} openLibrary={() => void openLibrary()} onApply={proposal => {
      if (!proposal.ready || proposal.seconds === undefined || !proposal.localDate || !proposal.allocations.length) return;
      setDraft(old => ({ ...old, skillId: proposal.allocations[0].skillId, secondaryId: proposal.allocations[1]?.skillId || '', primaryPercent: proposal.allocations[1] ? proposal.allocations[0].percent : 70, minutes: String(proposal.seconds! / 60), date: proposal.localDate!, ...(proposal.projectId ? { projectId: proposal.projectId } : {}) }));
    }}/>} 
    <Field label="Skill"><select value={draft.skillId} onChange={e => change('skillId', e.target.value)}>{data.skills.filter(s => (!s.deleted && !s.archived) || s.id === draft.skillId).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
    <div className="duration-input"><Clock3 size={22}/><input aria-label="Minutes" type="number" min="0.016666666666666666" step="any" max="1440" value={draft.minutes} onChange={e => change('minutes', e.target.value)} required/><span>minutes</span></div>
    <div className="quick-times">{[5, 15, 30, 60].map(n => <button type="button" key={n} className={+draft.minutes === n ? 'selected' : ''} onClick={() => change('minutes', String(n))}>{n} min</button>)}</div>
    <details className="form-details" open={editing ? true : undefined}><summary>Title, date and project</summary><div className="form-stack"><Field label="What did you do?" hint="Optional. A short description helps tell your story."><input maxLength={200} placeholder={`${skill?.name || 'Practice'} session`} value={draft.title} onChange={e => change('title', e.target.value)}/></Field>
    <div className="grid-two"><Field label="Date" hint={timedDate?'Timed evidence keeps its recorded start date so History and daily statistics agree.':undefined}><input type="date" disabled={!!timedDate} value={timedDate||draft.date} max={dayKey(new Date(), proposed.timeZone)} onChange={e => change('date', e.target.value)} required/></Field><Field label="Linked project"><select value={draft.projectId} onChange={e => change('projectId', e.target.value)}><option value="">Independent practice</option>{data.projects.filter(p => !p.deleted).map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select></Field></div></div></details>
    <details className="form-details"><summary>Split effort or add a note</summary><div className="form-stack"><Field label="Second skill"><select value={draft.secondaryId} onChange={e => change('secondaryId', e.target.value)}><option value="">One skill only</option>{data.skills.filter(s => s.id !== draft.skillId && !s.deleted && !s.archived).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>{draft.secondaryId && <Field label={`${skill?.name}: ${draft.primaryPercent}% · Second skill: ${100 - draft.primaryPercent}%`}><input aria-label="Primary skill percentage" type="range" min="1" max="99" step="1" value={draft.primaryPercent} onChange={e => change('primaryPercent', +e.target.value)}/></Field>}<Field label="Note"><textarea maxLength={50000} rows={3} placeholder="Something you learned or want to remember…" value={draft.note} onChange={e => change('note', e.target.value)}/></Field></div></details>
    {draft.questId && <label className="checkbox-line"><input type="checkbox" checked={draft.complete} onChange={e => change('complete', e.target.checked)}/>Complete the linked quest</label>}
    {draft.questId && data.activities.some(a => !a.deleted && a.questId === draft.questId && a.id !== editing?.id) && <p className="small muted">This quest already has recorded effort. Add only time you have not logged before.</p>}
    {options?.focusSessionId && <Field label="Where will you pick up next?" hint="Optional. Kept with this session; no new task is created."><input maxLength={2000} value={draft.continuationNote} onChange={e => change('continuationNote', e.target.value)} placeholder="Next time, start at…"/></Field>}
    <div className="reward-preview"><Sparkles size={19}/><div><strong>{Number.isFinite(seconds) ? formatNumber(preview.xp - projection.xp) : '0'} character XP {editing ? 'change' : 'added'}</strong><small>{skill ? `${REGIONS.find(r => r.id === skill.regionId)?.shortName}: ${formatNumber(preview.regions[skill.regionId].minutes)} minutes · ${preview.regions[skill.regionId].outcomes} outputs` : 'Choose a skill to preview progress.'}</small></div></div>
    {removed.length > 0 && <p className="form-warning">This correction will re-lock {removed.length} reward{removed.length > 1 ? 's' : ''} and update the related world stages.</p>}
    {(savedAttempt || activityConflict) && <div className="draft-conflict"><p>The saved activity changed. Your draft is preserved.</p><p><strong>{savedRecord?.title}</strong> · {savedRecord ? formatNumber(savedRecord.seconds / 60) : 0} minutes</p><p className="saved-record-text">{savedRecord?.note}</p><p>Compare the saved record with the fields above before applying this draft.</p><Button type="button" variant="secondary" onClick={()=>{setDraft(v=>({...v,commandId:crypto.randomUUID(),baseRevision:savedRecord?.revision || 0}));setSavedAttempt(false);setError('');}}>Apply this draft after review</Button></div>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="dialog-actions">{editing && <Button type="button" variant="danger" onClick={() => setConfirmDelete(!confirmDelete)}><Trash2 size={16}/>Remove</Button>}<Button type="submit" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save correction' : 'Record activity'}<Check size={17}/></Button></div>
    {confirmDelete && <div className="danger-box"><p>Remove this activity? XP and any dependent unlocks will recalculate. You can undo this change.</p><Button type="button" variant="danger" onClick={remove} disabled={busy}>Confirm removal</Button></div>}
  </fieldset><DraftNotice name={draftName} status={draftState.status} error={draftState.error || error} ready={draftReady} raw={draftState.raw} retry={draftState.retry} discard={async () => { await draftState.discard(); close(); }} working={busy || submitting} conflict={draftState.competing ? { ...draftState.competing, keepMine:async()=>{await draftState.keepMine();setError('');}, useSaved:async()=>{await draftState.useSaved();setError('');} } : undefined}/></form></Dialog>;
}
function SkillForm({ close }: { close: () => void }) {
  const { save, busy, modal } = useGame(); const [name, setName] = useState(''); const [description, setDescription] = useState(''); const [regionId, setRegionId] = useState<RegionId>(modal?.type === 'skill' ? modal.regionId || 'atelier' : 'atelier'); const [error, setError] = useState('');
  async function submit(e: FormEvent) { e.preventDefault(); const attribute = { observatory: 'intelligence', foundry: 'discipline', atelier: 'creativity', training: 'strength', citadel: 'charisma', sanctuary: 'wisdom' } as const; const s: Skill = { ...base(), name: name.trim(), description, category: 'Your skills', regionId, affinities: [{ attribute: attribute[regionId], percent: 70 }, { attribute: attribute[regionId] === 'discipline' ? 'wisdom' : 'discipline', percent: 30 }], icon: 'sparkles', equipped: true, archived: false, custom: true }; try { await save('skills', s, 'A new path is open'); close(); } catch (e) { setError(String(e)); } }
  return <Dialog title="There’s always more to discover." eyebrow="CUSTOM SKILL" onClose={close}><form onSubmit={submit} className="form-stack"><Field label="Skill name"><input value={name} onChange={e => setName(e.target.value)} required maxLength={120}/></Field><Field label="Description"><textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} maxLength={10000}/></Field><Field label="Home region"><select value={regionId} onChange={e => setRegionId(e.target.value as RegionId)}>{REGIONS.map(r => <option key={r.id} value={r.id}>{r.name} · {r.domain}</option>)}</select></Field>{error && <p className="form-error" role="alert">{error}</p>}<Button type="submit" disabled={busy}>Create skill<Plus size={17}/></Button></form></Dialog>;
}
