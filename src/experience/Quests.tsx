import { useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { ArrowRight, Flag, ListFilter, Plus, Search } from 'lucide-react';
import { useGame } from '../app-context';
import { bossProgress, dayKey, questStatusMutations } from '../domain';
import { Button, Dialog, Empty, PageHeading, Progress, SectionTitle, Tag } from '../components/ui';
import { usePhoneLayout } from '../components/phone-layout';
import { QuestRow } from '../components/QuestRow';
import type { Quest } from '../types';
import './records.css';

function ScheduleHistory({ quest }: { quest: Quest }) {
  const {data} = useGame();
  const [count, setCount] = useState(20); const history = [...(quest.scheduleHistory || [])].reverse();
  if (!history.length) return null;
  return <details className="schedule-history"><summary>{history.length} schedule {history.length === 1 ? 'change' : 'changes'} · originally {quest.originalDueDate || 'unscheduled'}</summary><ol>{history.slice(0,count).map(item=><li key={item.id}>{item.from || 'Someday'} → {item.to || 'Someday'} <time dateTime={item.at}>· {new Intl.DateTimeFormat('en',{dateStyle:'medium',timeStyle:'short',timeZone:data.profile.timeZone}).format(new Date(item.at))}</time></li>)}</ol>{count < history.length && <Button variant="ghost" onClick={()=>setCount(v=>v+20)}>Show more changes</Button>}</details>;
}
const views = [['active','Open'],['today','Today'],['completed','Completed'],['skipped','Skipped'],['rescheduled','Rescheduled'],['archive','Archived']];
const panels = [['steps','Steps'],['projects','Projects'],['routines','Routines']];

export function QuestsPage() {
  const { data, setModal, run, save, busy } = useGame(); const [params,setParams] = useSearchParams(); const [error,setError] = useState('');
  const phone = usePhoneLayout();
  const [filters, setFilters] = useState(false);
  const location = useLocation();
  const section = panels.find(([id]) => id === params.get('panel'))?.[0] || (params.has('projects') ? 'projects' : 'steps');
  const view = views.some(([id])=>id===params.get('view')) ? params.get('view')! : 'active'; const search = params.get('q') || ''; const routine = params.get('routine');
  const projectView = params.get('projects') || 'active'; const today = dayKey(Date.now(),data.profile.timeZone);
  const update = (key: string, value: string, replace = false) => setParams(old => {
    const next = new URLSearchParams(old);
    if (value) next.set(key, value);
    else next.delete(key);
    return next;
  }, { replace });
  const viewLabel = views.find(([id]) => view === id)?.[1];
  const searchField = <div className="search-field"><Search size={17}/><input type="search" aria-label="Search quests" placeholder="Search actions and notes" value={search} onChange={event => update('q', event.target.value, true)}/></div>;
  const statusViews = <div className="segmented" role="group" aria-label="Quest history view">
    {views.map(([id, label]) => <button key={id} aria-pressed={view === id} className={view === id ? 'selected' : ''} onClick={() => update('view', id)}>{label}</button>)}
  </div>;
  const panelHref = (id: string) => {
    const next = new URLSearchParams(params);
    next.set('panel', id);
    return { pathname: location.pathname, search: next.toString() };
  };
  const quests = data.quests.filter(q=>!q.deleted && q.recurrence==='none' && (!routine || q.occurrenceOf===routine) && `${q.title} ${q.note}`.toLowerCase().includes(search.toLowerCase()) && (
    view==='archive'?q.archived:view==='rescheduled'?!!q.scheduleHistory?.length:!q.archived && (view==='completed'?q.status==='completed':view==='skipped'?q.status==='skipped':q.status==='pending' && (view!=='today'||!q.dueDate||q.dueDate<=today))
  )).sort((a,b)=>Number(b.priority)-Number(a.priority)||(a.dueDate || '9999').localeCompare(b.dueDate || '9999')||a.id.localeCompare(b.id));
  const projects = data.projects.filter(p=>!p.deleted && (projectView==='archived'?p.archived:!p.archived&&(projectView==='all'||p.status===projectView)));
  async function perform(work:()=>Promise<unknown>){setError('');try{await work();}catch(e){setError(e instanceof Error?e.message:'Could not save this change.');}}
  return <div className="experience-page quests-page">
    <PageHeading eyebrow="THE QUEST BOARD" title="Give the work a direction" action={<Button aria-haspopup="dialog" onClick={() => setModal({ type: 'quest' })}><Plus size={16}/>New quest</Button>}>Choose an action, make room for a project, or return to a routine.</PageHeading>
    {phone && <nav className="quest-panel-nav" aria-label="Quest sections">
      {panels.map(([id, label]) => <Link key={id} to={panelHref(id)} aria-current={section === id ? 'page' : undefined}>{label}</Link>)}
    </nav>}
    <div hidden={phone && section !== 'steps'}>
      {phone ? <div className="quest-filter-bar">
        <span>{viewLabel}{search && <small> · Search active</small>}</span>
        <Button variant="secondary" aria-haspopup="dialog" onClick={() => setFilters(true)}><ListFilter size={16}/>Filters</Button>
      </div> : <div className="toolbar">{statusViews}{searchField}</div>}

    {routine && <div className="experience-notice">Occurrences of {data.quests.find(q=>q.id===routine)?.title || 'this routine'} <Button variant="ghost" onClick={()=>update('routine','')}>Show every quest</Button></div>}
    <section><SectionTitle title={view==='skipped'?'Steps you chose to skip':view==='rescheduled'?'Dates you changed':view==='archive'?'Archived steps':view==='completed'?'Completed steps':'Your next steps'} action={<Tag>{quests.length}</Tag>}/>{quests.length ? quests.map(q=><article className="quest-record" key={q.id}><QuestRow quest={q}/>{q.archived && <Tag>Archived</Tag>}<details className="quest-row-options"><summary>Options</summary><div className="quest-controls">{q.status==='pending' ? <button disabled={busy} onClick={()=>void perform(()=>run(questStatusMutations(data,q,'skipped'),'Occurrence skipped · progress preserved'))}>Skip</button> : <button disabled={busy} onClick={()=>void perform(()=>run(questStatusMutations(data,q,'pending'),'Quest reopened · no extra effort awarded'))}>Reopen</button>}<button disabled={busy} onClick={()=>setModal({type:'schedule',id:q.id})}>Reschedule</button><button disabled={busy} onClick={()=>void perform(()=>save('quests',{...q,archived:!q.archived},q.archived?'Quest restored':'Quest archived'))}>{q.archived?'Restore from archive':'Archive'}</button></div></details>{q.skippedAt && <p className="small muted">Skipped {new Intl.DateTimeFormat('en',{dateStyle:'medium',timeZone:data.profile.timeZone}).format(new Date(q.skippedAt))}</p>}<ScheduleHistory quest={q}/></article>) : <Empty icon={Flag} title="No quests in this view">Choose another history view or add a next action.</Empty>}</section>
    </div>
    {error && <p role="alert" className="form-error">{error}</p>}
    <details className="quest-support" hidden={phone && section !== 'projects'} open={phone || section === 'projects' || undefined}><summary>Projects and expeditions</summary><SectionTitle title="Projects and expeditions" action={<Button variant="secondary" aria-haspopup="dialog" onClick={()=>setModal({type:'project'})}><Plus size={16}/>New project</Button>}/><div className="segmented" role="group" aria-label="Project status filter">{[['active','Active'],['draft','Draft'],['paused','Paused'],['completed','Completed'],['archived','Archived'],['all','All']].map(([id,label])=><button key={id} className={projectView===id?'selected':''} onClick={()=>update('projects',id)}>{label}</button>)}</div><div className="project-grid">{projects.map(p=><article className="project-record-card" key={p.id}><Link to={`/projects/${p.id}`}><Tag>{p.status}</Tag><h3>{p.title}</h3><p>{p.outputCriterion}</p><Progress value={bossProgress(p,data)} label={`${p.title} progress`}/><div className="progress-caption"><span>{Math.round(bossProgress(p,data)*100)}% resolved</span><ArrowRight size={16}/></div></Link><Button variant="ghost" onClick={()=>setModal({type:'project',id:p.id})}>Edit project</Button></article>)}</div>{!projects.length&&<p className="muted">No projects with this status.</p>}</details>
    <details className="quest-support" hidden={phone && section !== 'routines'} open={phone || section === 'routines' || !!routine || undefined}><summary>Routine templates and history</summary><SectionTitle title="Routines" subtitle="Pausing stops new occurrences. Existing ones keep their dates and history."/>{data.quests.filter(q=>!q.deleted&&q.recurrence!=='none').map(q=><article className="routine-record" key={q.id}><div><strong>{q.title}</strong><small>{q.recurrence} · {q.archived?'Paused':'Active'}</small></div><div className="button-row"><Button variant="secondary" disabled={busy} onClick={()=>void perform(()=>save('quests',{...q,archived:!q.archived},q.archived?'Routine resumed':'Routine paused'))}>{q.archived?'Resume':'Pause'}</Button><Button variant="ghost" onClick={()=>setModal({type:'quest',id:q.id})}>Edit template</Button><Button variant="ghost" onClick={()=>setParams(old=>{const next=new URLSearchParams(old);next.set('panel','steps');next.set('routine',q.id);next.set('view','rescheduled');return next;})}>Schedule history</Button><Button variant="ghost" onClick={()=>setParams(old=>{const next=new URLSearchParams(old);next.set('panel','steps');next.set('routine',q.id);next.set('view','active');return next;})}>Open occurrences</Button></div></article>)}{!data.quests.some(q=>!q.deleted&&q.recurrence!=='none')&&<p className="muted">Create a quest with repetition to begin a routine.</p>}</details><p className="small muted quest-scheduling-note">Scheduling and checkboxes do not add effort XP. Skipping, rescheduling and pausing never remove recorded progress.</p>
    {filters && phone && <Dialog title="Quest filters" onClose={() => setFilters(false)} className="quest-filters-sheet"
      footer={<Button onClick={() => setFilters(false)}>Show quests</Button>}>
      {searchField}
      {statusViews}
    </Dialog>}
  </div>;
}
