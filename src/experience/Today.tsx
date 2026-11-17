import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, ChevronDown, Clock3, Compass, Feather, MapPin, Pin, Play, Plus, Settings2 } from 'lucide-react';
import { useGame } from '../app-context';
import { REGIONS } from '../catalog';
import { creditedActivities, dailyEffort, dayKey } from '../domain';
import { Button, Dialog, Progress, SectionTitle, formatMinutes, formatNumber } from '../components/ui';
import { OliveCard } from '../components/Companion';
import { QuestRow } from '../components/QuestRow';
import { chooseExpedition, displayedKeepsakes, expeditionFor, keepsakesFor, newFocusSession } from './model';
import { experienceFor } from './preferences';
import { HomeScene, KeepsakeGlyph } from './Scenes';
import { KeepsakeCollection } from './Keepsakes';
import './experience.css';

export function TodayPage() {
  const { accountId, data, projection, save, setModal, busy } = useGame();
  const navigate = useNavigate(); const [params, setParams] = useSearchParams();
  const [choosing, setChoosing] = useState(false); const [error, setError] = useState('');
  const prefs = experienceFor(data.profile); const choice = chooseExpedition(data); const project = choice.project;
  const route = project ? expeditionFor(data, project) : undefined;
  const projectSkill = data.skills.find(s => s.id === project?.skillId && !s.deleted && !s.archived);
  const skill = projectSkill || data.skills.find(s => s.id === data.profile.lastSkillId && !s.deleted && !s.archived) || data.skills.find(s => !s.deleted && !s.archived);
  const region = REGIONS.find(r => r.id === (project?.regionId || skill?.regionId)) || REGIONS[0];
  const p = projection.regions[region.id];
  const {display,keepsakes,credits} = useMemo(()=>({display:displayedKeepsakes(data),keepsakes:keepsakesFor(data),credits:creditedActivities(data).sort((a,b)=>b.activity.occurredAt.localeCompare(a.activity.occurredAt))}),[data]);
  const today = dayKey(new Date(), data.profile.timeZone); const seconds = dailyEffort(data)[today] || 0;
  const priorities = data.quests.filter(q => !q.deleted && !q.archived && q.recurrence === 'none' && q.status === 'pending' && (q.priority || q.dueDate === today)).sort((a, b) => Number(b.priority) - Number(a.priority) || a.id.localeCompare(b.id)).slice(0, 3);
  const session = data.focusSessions.find(s => !s.deleted && ['running', 'paused', 'review'].includes(s.status));
  const continuationSession = data.focusSessions.filter(s => !s.deleted && s.status === 'completed' && s.continuationNote && (project ? s.projectId === project.id : s.skillId === skill?.id)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const continuationQuest = data.quests.find(q=>q.id===continuationSession?.continuationQuestId && !q.deleted && !q.archived && q.status==='pending');
  const continuation = continuationSession?.continuationQuestId && !continuationQuest ? undefined : continuationSession?.continuationNote;
  const canLinkProject = project?.status === 'active' && !!projectSkill && projectSkill.id === skill?.id;
  const reviewProject = !!project && (project.status === 'paused' || !projectSkill || !!route?.canComplete);
  const focusLabel = session ? 'Return to focus' : project?.status === 'paused' ? 'Resume project' : project && !projectSkill ? 'Review project' : route?.canComplete ? 'Review finished output' : skill ? 'Start focus' : 'Choose a skill';
  const date = new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric', timeZone: data.profile.timeZone }).format(new Date());
  const openCollection = (id?: string, slot = 0) => setParams(old => { const next=new URLSearchParams(old);next.set('collection', '1');next.set('slot',String(slot));if(id)next.set('keepsake',id);else next.delete('keepsake');return next; });
  const closeCollection = () => setParams(old => { const next=new URLSearchParams(old);next.delete('collection');next.delete('keepsake');next.delete('slot');return next; });
  async function pin(id?: string) {
    try { await save('profile', { ...data.profile, experience: { ...prefs, pinnedProjectId: id, dismissedProjectIds: prefs.dismissedProjectIds.filter(value => value !== id) } }, id ? 'Current expedition pinned' : 'Expedition unpinned'); setChoosing(false); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not pin this project.'); }
  }
  async function start() {
    if (session) { navigate('/focus'); return; }
    if (reviewProject && project) { navigate(`/projects/${encodeURIComponent(project.id)}`); return; }
    if (!skill) { navigate('/skills'); return; }
    try { const candidate = continuationQuest || (!continuation ? route?.nextQuest : undefined); const next = newFocusSession(data, skill.id, { projectId: canLinkProject ? project?.id : undefined, questId: canLinkProject && candidate?.skillId === skill.id && candidate.projectId === project?.id ? candidate.id : undefined }); await save('focusSessions', next, 'Focus started · time is credited after review'); navigate('/focus'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not begin a session.'); }
  }
  return <div className="experience-page today-experience">
    <section className="home-opening" aria-label="Your home and next action">
      <HomeScene timeZone={data.profile.timeZone}><div className="home-greeting"><span className="eyebrow">YOUR FIELD ATLAS · {date}</span><h1 tabIndex={-1}>Welcome home,<br/><em>{data.profile.displayName.split(' ')[0] || 'wanderer'}.</em></h1><p>{accountId === 'demo' ? 'Sample world · separate from your progress' : 'A world shaped by the things you do.'}</p></div>
        <Link className="home-landmark" to={`/world?region=${region.id}`}><MapPin size={16}/><span><strong>{region.shortName}</strong><small>{region.stages[p.stage]}</small></span><ArrowRight size={16}/></Link>
      </HomeScene>
      <div className="home-action-dock" data-tour="next-action"><div className="next-action-copy"><span className="eyebrow">{project ? choice.pinned ? 'YOUR CURRENT EXPEDITION' : 'A PLACE TO CONTINUE' : 'YOUR NEXT SESSION'}</span><h2>{continuation || route?.nextObjective?.title || (project ? route?.nextLabel : skill ? `Make time for ${skill.name.toLowerCase()}` : 'Choose a skill to begin')}</h2><div className="next-action-context">{project ? <Link to={`/projects/${project.id}`}>{project.title}<ArrowRight size={14}/></Link> : <Link to="/skills">Explore your skills<ArrowRight size={14}/></Link>}<button onClick={() => { setError(''); setChoosing(true); }}><Settings2 size={14}/>{project ? 'Change' : 'Choose project'}</button>{continuation && <button onClick={()=>{if(continuationSession)setModal({type:'continuation',id:continuationSession.id});}}><Feather size={14}/>Edit continuation</button>}</div></div>
        <div className="home-actions"><Button disabled={busy} onClick={() => void start()}>{reviewProject&&!session?<ArrowRight size={17}/>:<Play size={17}/>}{focusLabel}</Button><Button variant="secondary" data-tour="log-activity" onClick={() => setModal({ type: 'log', options: canLinkProject && project ? { skillId: project.skillId, projectId: project.id } : skill ? { skillId: skill.id } : undefined })}><Plus size={17}/>Log activity</Button></div>
      </div>
      <div className="home-dock-footer"><span>{session ? 'Your current session is kept' : reviewProject ? 'Review the project before beginning more work' : `${prefs.focusMinutes} minute session · ${skill?.name || 'choose any skill'}`}</span>{project && <span><Pin size={12}/>{choice.reason}</span>}</div>
    </section>
    {project?.status === 'paused' && <div className="experience-notice">This expedition is paused. <Link to={`/projects/${project.id}`}>Review it to resume</Link>, or log independent practice.</div>}
    {error && <p role="alert" className="form-error">{error}</p>}
    <section className="today-priorities home-chosen-steps"><SectionTitle title="A few chosen steps" subtitle={priorities.length ? 'Your priorities and actions due today. Keep the list small.' : undefined} action={<Link className="text-link" to="/quests">All quests<ArrowRight size={16}/></Link>}/>{priorities.length ? priorities.map(q => <QuestRow key={q.id} quest={q}/>) : <div className="quiet-empty"><p>No chosen steps for today.</p><Button variant="ghost" onClick={() => setModal({ type: 'quest' })}><Plus size={16}/>Choose a next action</Button></div>}</section>
    <section className="home-memory-strip" aria-label="Your kept work"><button className="home-latest-work" onClick={()=>openCollection(keepsakes[0]?.id)} aria-label={keepsakes[0] ? `Open latest keepsake: ${keepsakes[0].output.title}` : 'Open your keepsake collection'}>{keepsakes[0] ? <KeepsakeGlyph kind={keepsakes[0].kind}/> : <Feather size={25}/>}<span><small>{keepsakes.length ? 'LATEST WORK KEPT' : 'ROOM FOR WHAT YOU MAKE'}</small><strong>{keepsakes[0]?.output.title || 'Your first finished result belongs here.'}</strong></span><ArrowRight size={16}/></button><div className="home-memory-links"><button className="text-link" onClick={()=>openCollection()}>Collection<ArrowRight size={15}/></button><Link className="text-link" to="/chronicle">Open Chronicle<Feather size={15}/></Link></div></section>
    <details className="home-records"><summary><span><Compass size={17}/><span>Collection & recent activity<small>{keepsakes.length} {keepsakes.length===1?'keepsake':'keepsakes'} · {credits.length} recorded {credits.length===1?'activity':'activities'}</small></span></span><ChevronDown size={17}/></summary><div className="home-records-content">
      <div className="home-records-grid"><section className="keepsake-shelf" aria-label="Home keepsake display"><SectionTitle title="Your six display places" subtitle="Choose a slot to arrange your finished work."/><div className="home-display">{display.map((k,i)=><button key={i} onClick={()=>openCollection(k?.id,i)} aria-label={k?`Display slot ${i+1}: ${k.output.title}`:`Choose a keepsake for display slot ${i+1}`} className={k?'display-occupied':'display-empty'}>{k?<KeepsakeGlyph kind={k.kind}/>:<span className="empty-display-mark">+</span>}<small>{String(i+1).padStart(2,'0')}</small>{k&&<span className="display-title">{k.output.title}</span>}</button>)}</div>{!keepsakes.length&&<p className="muted small">Confirm a real finished result to create a keepsake. Practice earns effort XP separately.</p>}</section>
      <section className="recent-work-section"><SectionTitle title="Recent practice" action={<Link className="text-link" to="/history">All history<ArrowRight size={16}/></Link>}/>{credits.length?<div className="recent-work-strip">{credits.slice(0,3).map(c=><button key={c.activity.id} onClick={()=>setModal({type:'correction',activityId:c.activity.id})}><Clock3 size={17}/><span><strong>{c.activity.title}</strong><small>{c.activity.localDate} · {formatMinutes(c.seconds)}</small></span><ArrowRight size={15}/></button>)}</div>:<p className="muted">Your first recorded session will appear here.</p>}</section></div>
      <section className="home-progress-note" aria-label="How your progress connects"><h2>What changed?</h2><p><strong>{formatMinutes(seconds)}</strong> recorded today · <strong>{formatNumber(projection.xp)} XP</strong> across your character’s history.</p><p>{region.shortName}: {formatNumber(p.minutes)} minutes, {p.outcomes} outputs. {p.stage===3?'All three restoration stages are eligible.':`Next: ${p.nextMinutes} cumulative minutes and ${p.nextOutcomes} outputs${p.needsProject?', including a completed project':''}.`}</p><Progress value={p.nextMinutes?p.minutes/p.nextMinutes:1} label={`${region.shortName} effort toward next stage`}/><Link className="text-link" to={`/world?region=${region.id}`}>Inspect the requirements<ArrowRight size={16}/></Link></section>
    </div></details>
    {Date.now()-Date.parse(data.profile.lastExportAt||data.profile.createdAt)>=7*86400000&&<aside className="backup-reminder"><span>Your weekly external backup is due. Include your world and unfinished drafts.</span><Link className="text-link" to="/settings?section=data">Save a backup<ArrowRight size={16}/></Link></aside>}
    <div className="today-field-guide"><OliveCard/></div>
    {choosing && <Dialog title="What are you working toward?" eyebrow="CURRENT EXPEDITION" onClose={() => setChoosing(false)}><p className="muted">Pin one project to give it the next action at home. Your other projects keep their progress.</p><div className="expedition-picker">{data.projects.filter(p => !p.deleted && !p.archived && ['active', 'paused'].includes(p.status)).map(p => <button key={p.id} disabled={busy} onClick={() => void pin(p.id)}><span><strong>{p.title}</strong><small>{REGIONS.find(r => r.id === p.regionId)?.shortName} · {p.status}</small></span>{prefs.pinnedProjectId === p.id ? <Pin size={18}/> : <ArrowRight size={18}/>}</button>)}</div><div className="button-row"><Button variant="secondary" onClick={() => { setChoosing(false); setModal({ type: 'project' }); }}><Plus size={16}/>New project</Button>{prefs.pinnedProjectId && <Button variant="ghost" disabled={busy} onClick={() => void pin()}>Unpin project</Button>}</div>{project && !choice.pinned && <Button variant="ghost" disabled={busy} onClick={async () => { try { await save('profile', { ...data.profile, experience: { ...prefs, dismissedProjectIds: [...new Set([...prefs.dismissedProjectIds, project.id])].slice(-100) } }, 'Suggestion dismissed'); setChoosing(false); } catch { /* run displays the save error */ } }}>Dismiss this suggestion</Button>}{error && <p role="alert" className="form-error">{error}</p>}</Dialog>}
    {params.get('collection') === '1' && <KeepsakeCollection close={closeCollection} initialId={params.get('keepsake') || undefined} initialSlot={Number(params.get('slot')) || 0}/>}
  </div>;
}
