import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { projectGame } from './domain';
import { commitMutations, db, loadGame, undoCommand } from './storage';
import { playInterfaceCue, playMilestoneCue } from './soundtrack';
import { audioFor, feedbackFor, feedbackPreview } from './audio-preferences';
import { claimLandmarks, newlyReachedLandmarks, type Landmark } from './discoveries';
import { REGIONS } from './catalog';
import type { Command, ConsumedDraft, EntityKind, GameData, GameEntity, Mutation, Projection } from './types';
export const base = (id: string = crypto.randomUUID()) => ({ id, revision: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
export type LogOptions = { skillId?: string; questId?: string; projectId?: string; bookId?: string; focusSessionId?: string; seconds?: number; activityId?: string; complete?: boolean; interpret?: boolean };
export type ModalState = { type: 'log'; options?: LogOptions } | { type: 'quest'; id?: string; projectId?: string; suggestedTitle?: string; suggestedNote?: string } | { type: 'project'; id?: string; skillId?: string } | { type: 'output'; id?: string; skillId?: string; projectId?: string } | { type: 'skill'; regionId?: import('./types').RegionId } | { type: 'book'; id?: string } | { type: 'correction'; activityId: string } | { type: 'story'; regionId: string } | { type: 'journal'; id?: string } | { type: 'continuation'; id: string } | { type: 'schedule'; id: string } | null;
type Toast = { message: string; commandId?: string; error?: boolean; landmark?: Landmark; discoveries?: number } | null;
interface Context {
  accountId: string; data: GameData; projection: Projection; busy: boolean; modal: ModalState;
  setModal: (modal: ModalState) => void; run: (mutations: Mutation[], message?: string, commandId?: string, consumedDraft?: ConsumedDraft) => Promise<Command>;
  save: (kind: EntityKind, entity: GameEntity, message?: string) => Promise<Command>;
  toast: (message: string, error?: boolean) => void; leave: () => void;
}
const AppContext = createContext<Context | null>(null);
export const useGame = () => { const v = useContext(AppContext); if (!v) throw new Error('Game context unavailable'); return v; };
export function GameProvider({ accountId, leave, children }: { accountId: string; leave: () => void; children: ReactNode }) {
  const result = useLiveQuery(async () => { try { return { data: await loadGame(accountId), error: '' }; } catch (e) { return { data: null, error: e instanceof Error ? e.message : 'Unable to open your saved data.' }; } }, [accountId]);
  const [busy, setBusy] = useState(false); const saving = useRef(false);
  const [modal, setModal] = useState<ModalState>(null); const [notice, setNotice] = useState<Toast>(null);
  const navigate = useNavigate();
  const scope=useRef(0);useEffect(()=>{scope.current++;return()=>{scope.current++;};},[accountId]);
  useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(null), notice.error ? 14000 : 7000); return () => clearTimeout(t); }, [notice]);
  const data = result?.data; const liveData=useRef(data);liveData.current=data;
  const projection = useMemo(() => data ? projectGame(data) : null, [data]);
  useEffect(() => {
    if (!data) return;
    const root = document.documentElement; const deviceTheme = matchMedia('(prefers-color-scheme: light)');
    const update = () => { root.dataset.theme = data.profile.theme === 'system' ? deviceTheme.matches ? 'light' : 'dark' : data.profile.theme; root.dataset.motion = data.profile.motion; };
    update(); deviceTheme.addEventListener('change', update); return () => deviceTheme.removeEventListener('change', update);
  }, [data?.profile.theme, data?.profile.motion]);
  if (!result) return <div className="boot-state"><div className="compass-loader"/><p>Opening your world…</p></div>;
  if (!data || !projection) return <div className="boot-state"><h1>Your world is safe to recover</h1><p>{result.error || 'This profile could not be loaded.'}</p><button className="btn btn-primary" onClick={() => location.reload()}>Try again</button><button className="btn btn-secondary" onClick={leave}>Choose another profile</button><p className="muted small">Your stored records have not been reset or removed.</p></div>;
  const beforeProjection = projection;
  async function run(mutations: Mutation[], message = 'Saved on this device', commandId?: string, consumedDraft?: ConsumedDraft) {
    if (saving.current) throw new Error('A change is already being saved. Please try again.');
    const runScope=scope.current;
    saving.current = true; setBusy(true);
    try {
      const replay=commandId?!!await db.commands.get([accountId,commandId]):false;
      const command = await commitMutations(accountId, mutations, commandId, consumedDraft);
      setNotice({ message, commandId: command.id });
      if(!replay)void loadGame(accountId).then(async canonical=>{
        if(!canonical||scope.current!==runScope)return;
        const fresh=mutations.some(m=>['activities','outputs','projects','books'].includes(m.kind))?await claimLandmarks(accountId,newlyReachedLandmarks(beforeProjection,projectGame(canonical))):[];
        if(scope.current!==runScope)return;
        if(fresh.length){const landmark=fresh[fresh.length-1];setNotice(current=>current?.commandId===command.id?{...current,landmark,discoveries:fresh.length}:current);}
        const current=liveData.current;if(!current)return;
        const policy=feedbackPreview(accountId)||audioFor(current.profile),savedPolicy=audioFor(current.profile);
        const cue=feedbackFor(data!,canonical,mutations,fresh.length);
        if(current.profile.experience?.focusMode==='practice'&&mutations.some(m=>m.kind==='focusSessions'))return;
        if(cue==='milestone'){if(policy.milestonesEnabled&&savedPolicy.milestonesEnabled)void playMilestoneCue();}
        else if(cue&&policy.interfaceEnabled&&savedPolicy.interfaceEnabled)void playInterfaceCue(cue);
      }).catch(()=>{});
      return command;
    }
    catch (e) { setNotice({ message: e instanceof Error ? e.message : 'Could not save. Your draft is still here.', error: true }); throw e; }
    finally { saving.current = false; setBusy(false); }
  }
  const renderScope=scope.current;
  const presentModal=(next:ModalState)=>{if(scope.current!==renderScope)return;if(next&&audioFor(data.profile).interfaceEnabled&&(feedbackPreview(accountId)?.interfaceEnabled??true)&&!(next.type==='log'&&next.options?.focusSessionId))void playInterfaceCue('sheet');setModal(next);};
  const value: Context = { accountId, data, projection, busy, modal, setModal:presentModal, run, save: (kind, entity, message) => run([{ kind, entity }], message), toast: (message, error = false) => setNotice({ message, error }), leave };
  return <AppContext.Provider value={value}>{children}{notice && <div className={`toast ${notice.error ? 'toast-error' : ''} ${notice.landmark ? 'toast-discovery' : ''}`} role={notice.error ? 'alert' : 'status'}><span>{notice.message}{notice.landmark && <small className="discovery-receipt"><img src="/art/kenney/chest.png" alt="" width="23" height="23"/><span>{(notice.discoveries || 0) > 1 ? `${notice.discoveries} landmarks reached` : 'A new landmark'} · {REGIONS.find(r => r.id === notice.landmark!.regionId)?.shortName}</span><button onClick={() => { navigate(`/world?region=${notice.landmark!.regionId}`); setNotice(null); }}>View</button></small>}</span>{notice.commandId && <button onClick={async () => { try { await undoCommand(accountId, notice.commandId!); setNotice({ message: 'Change undone · progress recalculated' }); } catch (e) { setNotice({ message: e instanceof Error ? e.message : 'Unable to undo this change', error: true }); } }}>Undo</button>}<button aria-label="Dismiss notification" onClick={() => setNotice(null)}>×</button></div>}</AppContext.Provider>;
}
