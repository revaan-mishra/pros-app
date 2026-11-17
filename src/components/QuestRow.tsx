import { Flag, Plus } from 'lucide-react';
import { useGame } from '../app-context';
import { dayKey, questStatusMutations } from '../domain';
import { CheckMark, IconButton } from './ui';
import type { Quest } from '../types';
const active = <T extends { deleted?: boolean; archived?: boolean }>(items: T[]) => items.filter(x => !x.deleted && !x.archived);
const safeAction = (promise: Promise<unknown>) => { void promise.catch(() => {}); };
export function QuestRow({ quest }: { quest: Quest }) {
  const { data, run, setModal, busy } = useGame(); const skill = data.skills.find(s => s.id === quest.skillId); const children = active(data.quests).filter(q => q.parentId === quest.id && q.recurrence === 'none'); const uncompletedChildren = children.some(q => q.status === 'pending');
  async function toggle() { if (uncompletedChildren && quest.status !== 'completed') { setModal({ type: 'quest', id: quest.id }); return; } const completed = quest.status !== 'completed'; await run(questStatusMutations(data, quest, completed ? 'completed' : 'pending'), completed ? 'Quest complete · a good step forward' : 'Quest reopened'); }
  return <div className={`quest-row ${quest.status === 'completed' ? 'quest-done' : ''}`}><CheckMark checked={quest.status === 'completed'} label={quest.status === 'completed' ? `Reopen ${quest.title}` : `Complete ${quest.title}`} disabled={busy} onClick={() => safeAction(toggle())}/><button className="quest-description" onClick={() => setModal({ type: 'quest', id: quest.id })}><strong>{quest.title}</strong><small>{skill?.name || 'Your skill'}{quest.occurrenceOf && <> <span>·</span> Routine</>}{children.length > 0 && <> <span>·</span> {children.filter(q => q.status === 'completed').length}/{children.length} steps</>}{quest.dueDate && <> <span>·</span> {quest.dueDate === dayKey(new Date(), data.profile.timeZone) ? 'Today' : quest.dueDate}</>}</small></button>{quest.priority && <Flag className="priority-flag" size={15}/>}<IconButton icon={Plus} label={`Log activity and complete ${quest.title}`} onClick={() => setModal({ type: 'log', options: { skillId: quest.skillId, questId: quest.id, projectId: quest.projectId, complete: true } })}/></div>;
}
