import { Link } from 'react-router-dom';
import { ArrowRight, Feather } from 'lucide-react';
import { useGame } from '../app-context';
import { focusElapsed } from '../domain';
import { Button, Empty, PageHeading, Tag, formatMinutes } from '../components/ui';

export function HistoryTabs({ active = 'activities' }: { active?: string }) {
  return <nav className="history-tabs" aria-label="History views"><Link aria-current={active === 'activities' ? 'page' : undefined} to="/history">Activities</Link><Link aria-current={active === 'focus' ? 'page' : undefined} to="/history?view=focus">Focus sessions</Link><Link to="/outputs">Finished outputs</Link></nav>;
}
export function FocusHistory() {
  const { data, setModal } = useGame(); const sessions = data.focusSessions.filter(s=>!s.deleted).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  return <div className="secondary-page"><PageHeading eyebrow="A WAY BACK TO THE WORK" title="Focus history">Revisit confirmed time and edit the note you left for your next session.</PageHeading><HistoryTabs active="focus"/>{sessions.length ? <div className="focus-history-list">{sessions.map(s=><article className="focus-history-item" key={s.id}><div><h2>{data.skills.find(skill=>skill.id===s.skillId)?.name || 'Archived skill'}</h2><p className="small muted">{new Intl.DateTimeFormat('en',{dateStyle:'medium',timeZone:data.profile.timeZone}).format(new Date(s.createdAt))} · {formatMinutes(focusElapsed(s))}</p><Tag>{s.status}</Tag>{s.continuationNote && <p className="saved-record-text">{s.continuationNote}</p>}{s.continuationQuestId && <Link className="text-link" to="/quests">View next action<ArrowRight size={14}/></Link>}</div>{s.status === 'completed' ? <Button variant="secondary" onClick={()=>setModal({type:'continuation',id:s.id})}><Feather size={16}/>{s.continuationNote?'Edit continuation':'Leave a continuation'}</Button> : ['running','paused','review'].includes(s.status) ? <Link className="btn btn-secondary" to="/focus">Return to session</Link> : <span className="small muted">No effort credited</span>}</article>)}</div> : <Empty icon={Feather} title="Your first session will appear here">Start a focus session, then review the time you actually spent.</Empty>}</div>;
}
