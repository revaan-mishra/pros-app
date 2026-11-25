import { usePhoneLayout } from '../components/phone-layout';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, ChevronDown, Music2, Pause, Play, Square } from 'lucide-react';
import { ContextualHint } from '../components/ContextualHint';
import { useGame } from '../app-context';
import { focusElapsed } from '../domain';
import { Button, Dialog, Field } from '../components/ui';
import { stopSoundtrack } from '../soundtrack';
import { stopAmbience } from '../ambience';
import { newFocusSession, keepsakesFor } from './model';
import { experienceFor } from './preferences';
import { RegionScene } from './RegionScene';
import { availableFocusSkill, focusStartMinutes } from './focus-selection';
import { REGION_EXPERIENCES } from './regions';
import type { ExperiencePreferences } from '../types';
import './experience.css';

export function FocusPage() {
  const { accountId, data, projection, save, run, setModal, busy } = useGame(); const [params,setParams] = useSearchParams();
  const phone = usePhoneLayout();
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const prefs = experienceFor(data.profile);
  const [skillId, setSkillId] = useState(() => availableFocusSkill(data,params.get('skill'))?.id||'');
  const [duration, setDuration] = useState(String([5,15,30,60].includes(Number(params.get('minutes')))?Number(params.get('minutes')):prefs.focusMinutes)); const [stopwatch, setStopwatch] = useState(false); const [now, setNow] = useState(Date.now()); const [error, setError] = useState('');
  const session = data.focusSessions.find(s => !s.deleted && ['running', 'paused', 'review'].includes(s.status));
  const skill = availableFocusSkill(data,skillId,session);
  const project = data.projects.find(p => p.id === (session?.projectId || params.get('project')) && !p.deleted && p.skillId === skill?.id);
  const quest = data.quests.find(q => q.id === (session?.questId || params.get('quest')) && !q.deleted && q.skillId === skill?.id);
  const projectUnavailable=!session&&params.has('project')&&(!project||project.archived||project.status!=='active');
  const regionId = skill?.regionId || 'sanctuary'; const place = REGION_EXPERIENCES[regionId]; const mode = prefs.focusMode;
  const regionalKeepsakes = useMemo(()=>keepsakesFor(data).filter(k=>k.regionId===regionId),[data,regionId]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 500); const refresh = () => setNow(Date.now()); document.addEventListener('visibilitychange', refresh); return () => { clearInterval(timer); document.removeEventListener('visibilitychange', refresh); }; }, []);
  useEffect(() => { if (mode === 'practice') { void stopSoundtrack().catch(() => {}); void stopAmbience(); } }, [mode]);
  const elapsed = session ? focusElapsed(session, now) : 0;
  const remaining = session?.targetSeconds ? Math.max(0, session.targetSeconds - elapsed) : elapsed;
  const display = session ? remaining : stopwatch ? 0 : Math.max(0, Number(duration) || 0) * 60;
  const clock = `${display >= 3600 ? `${Math.floor(display / 3600)}:` : ''}${String(Math.floor(display % 3600 / 60)).padStart(2, '0')}:${String(Math.floor(display % 60)).padStart(2, '0')}`;
  const finished = !!(session?.targetSeconds && elapsed >= session.targetSeconds);
  async function perform(work: () => Promise<unknown>) { setError(''); try { await work(); } catch (e) { setError(e instanceof Error ? e.message : 'Your session could not be saved.'); } }
  async function start() {
    if(!skill)throw new Error('Choose an available skill first.');
    if(projectUnavailable)throw new Error('Review the linked project or explicitly choose independent practice.');
    const minutes=focusStartMinutes(duration,stopwatch,prefs.focusMinutes);
    const next = newFocusSession(data, skill.id, { minutes, stopwatch, projectId: project?.id, questId: quest?.id });
    await run([{ kind: 'focusSessions', entity: next }, { kind: 'profile', entity: { ...data.profile, experience: { ...prefs, focusMinutes: Math.round(minutes) } } }], 'Focus started · time is credited after review');
  }
  async function pause() {
    if (!session) return;
    const running = session.status === 'running';
    await save('focusSessions', { ...session, status: running ? 'paused' : 'running', segments: running ? session.segments.map(s => ({ ...s, end: s.end ?? Date.now() })) : [...session.segments, { start: Date.now() }] }, running ? 'Session paused' : 'Session resumed');
  }
  async function finish() {
    if (!session) return;
    const actual = focusElapsed(session, Date.now());
    const count = Math.floor(Math.min(86400, session.targetSeconds ? Math.min(actual, session.targetSeconds) : actual));
    if (count < 1) throw new Error('Record at least one second of practice, or discard this session.');
    if (session.status !== 'review') await save('focusSessions', { ...session, status: 'review', segments: session.segments.map(s => ({ ...s, end: s.end ?? Date.now() })) }, 'Review your session before recording it');
    setModal({ type: 'log', options: { focusSessionId: session.id, skillId: session.skillId, questId: session.questId, projectId: session.projectId, seconds: count } });
  }
  async function setMode(focusMode: ExperiencePreferences['focusMode']) { await save('profile', { ...data.profile, experience: { ...prefs, focusMode } }, `${focusMode === 'practice' ? 'Silent practice' : focusMode === 'minimal' ? 'Minimal' : 'Immersive'} focus selected`); }
  const presentation = <div className="focus-place-controls"><div role="group" aria-label="Focus presentation">{(['immersive', 'minimal', 'practice'] as const).map(value => <button key={value} disabled={busy} aria-pressed={mode === value} onClick={() => void perform(() => setMode(value))}>{value === 'practice' ? 'Silent practice' : value === 'minimal' ? 'Minimal' : 'Immersive'}</button>)}</div><button className="focus-music-button" onClick={() => window.dispatchEvent(new Event('pros:open-music'))}><Music2 size={17}/>Soundtrack</button></div>;
  return <div className={`experience-page focus-experience focus-mode-${mode}`}>
    <header className="focus-place-heading"><div><span className="eyebrow">A PLACE FOR THE WORK</span><h1 tabIndex={-1}>{place.focusName}</h1></div><Link className="text-link" to={project ? `/projects/${project.id}` : '/'}>{project ? 'Your expedition' : 'Home'}</Link></header>
    <section className="focus-place" aria-label="Focus session">
      {mode !== 'minimal' && <div className="focus-place-art" aria-hidden="true"><RegionScene regionId={regionId} stage={projection.regions[regionId].stage} keepsakes={regionalKeepsakes} eager/></div>}<div className="focus-place-shade"/>
      <div className="focus-place-console"><p className="eyebrow">{skill?.name || 'Choose a skill'}</p><div className="focus-place-clock" role="timer" aria-label={`${Math.floor(display / 60)} minutes ${Math.floor(display % 60)} seconds`}>{clock}</div><p className="focus-state-text">{session?.status === 'paused' ? 'Paused · your place is kept' : session?.status === 'review' || finished ? 'Ready to review' : session ? 'In progress · recorded after confirmation' : stopwatch ? 'Open-ended practice' : `${duration} minutes, one thing at a time`}</p>{project && <p className="focus-project-name">{quest?.title || project.title}</p>}
        <div className="button-row">{session ? <>{session.status !== 'review' && !finished && <Button variant="secondary" disabled={busy} onClick={() => void perform(pause)}>{session.status === 'running' ? <Pause size={17}/> : <Play size={17}/>}{session.status === 'running' ? 'Pause' : 'Resume'}</Button>}<Button disabled={busy} onClick={() => void perform(finish)}><Check size={17}/>{finished || session.status === 'review' ? 'Review session' : 'Finish session'}</Button></> : <Button data-tour="focus-entry" disabled={busy || !skill || projectUnavailable} onClick={() => void perform(start)}><Play size={17}/>Start focus</Button>}</div>
      </div>
      {!phone && presentation}
    </section>
    {projectUnavailable&&<div className="experience-notice"><p>The linked project is paused, archived or unavailable. Review it before continuing, or choose independent practice.</p><div className="button-row">{project&&<Link className="btn btn-secondary" to={`/projects/${encodeURIComponent(project.id)}`}>Review project</Link>}<Button variant="ghost" onClick={()=>setParams(previous=>{const next=new URLSearchParams(previous);next.delete('project');next.delete('quest');return next;})}>Choose independent practice</Button></div></div>}
    {!skill&&!session&&<Link className="evidence-link" to="/skills">Choose a skill to begin</Link>}
    {error && <p role="alert" className="form-error">{error}</p>}
    <ContextualHint accountId={accountId} id="focus-v1">Finish opens a review. Only confirmed time becomes an activity; the timer keeps its place when you leave.</ContextualHint>
    <details className="focus-setup" open={!session && !phone || undefined}><summary><span>Session setup</span><ChevronDown size={16}/></summary><div className="form-stack"><div className="grid-two"><Field label="Skill"><select disabled={!!session} value={session?.skillId || skill?.id || ''} onChange={e => setSkillId(e.target.value)}>{data.skills.filter(s => !s.deleted && (!s.archived || s.id === session?.skillId)).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field><Field label="Minutes"><input aria-label="Session length in minutes" type="number" min="1" max="180" step="1" disabled={!!session || stopwatch} value={duration} onChange={e => setDuration(e.target.value)}/></Field></div><div className="button-row"><div className="segmented"><button disabled={!!session} className={!stopwatch ? 'selected' : ''} onClick={() => setStopwatch(false)}>Countdown</button><button disabled={!!session} className={stopwatch ? 'selected' : ''} onClick={() => setStopwatch(true)}>Stopwatch</button></div>{[15, 25, 50].map(n => <button key={n} className="time-chip" disabled={!!session} onClick={() => { setDuration(String(n)); setStopwatch(false); }}>{n} min</button>)}</div><p className="small muted">{project ? `Linked to ${project.title}. ` : 'Independent practice. '}Time survives navigation and suspension; confirm it once before it becomes XP. Closed-app alarms are not supported.</p></div></details>
    {phone && <details className="focus-setup focus-appearance"><summary><span>Scene &amp; sound</span><ChevronDown size={16}/></summary>{presentation}</details>}
    <Link className="text-link" to="/history?view=focus">Focus history and continuation notes</Link>
    {session && <Button variant="ghost" disabled={busy} onClick={() => setConfirmDiscard(true)}><Square size={15}/>Discard session</Button>}
    {session && confirmDiscard && <Dialog title="Discard this focus session?" onClose={() => { if (!busy) setConfirmDiscard(false); }}
      footer={<div className="dialog-actions"><Button variant="ghost" disabled={busy} onClick={() => setConfirmDiscard(false)}>Keep session</Button>
        <Button variant="danger" disabled={busy} onClick={() => void perform(async () => {
          await save('focusSessions', { ...session, status: 'discarded', segments: session.segments.map(s => ({ ...s, end: s.end ?? Date.now() })) }, 'Session discarded · no XP recorded');
          setConfirmDiscard(false);
        })}>Discard session</Button></div>}>
      <p>This session’s time will be cleared. Your recorded activities stay in your history.</p>
      {error && <p role="alert" className="form-error">{error}</p>}
    </Dialog>}
  </div>;
}
