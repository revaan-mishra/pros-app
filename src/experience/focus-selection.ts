import { dayKey } from '../domain';
import type { Activity, FocusSession, GameData } from '../types';

export function availableFocusSkill(data: GameData, requested?: string|null, session?: FocusSession) {
  if(session)return data.skills.find(s=>s.id===session.skillId);
  const live=data.skills.filter(s=>!s.deleted&&!s.archived);
  return live.find(s=>s.id===requested)||live.find(s=>s.id===data.profile.lastSkillId)||live.find(s=>s.equipped)||live[0];
}
export function focusStartMinutes(input:string, stopwatch:boolean, saved:number) {
  if(stopwatch)return Number.isFinite(saved)&&saved>=1&&saved<=180?saved:25;
  const minutes=Number(input);if(!Number.isFinite(minutes)||minutes<1||minutes>180)throw new Error('Choose between 1 and 180 minutes.');return minutes;
}
/** Interval-based evidence keeps its original local start date; estimates remain editable. */
export function intervalEvidenceDate(activity:Activity|undefined,focus:FocusSession|undefined,timeZone:string):string|undefined {
  if(activity?.startedAt&&Number.isFinite(Date.parse(activity.startedAt)))return dayKey(activity.startedAt,activity.timeZone);
  const first=focus?.segments.filter(s=>Number.isFinite(s.start)).reduce<number|undefined>((value,s)=>value===undefined? s.start:Math.min(value,s.start),undefined);
  return first!==undefined?dayKey(first,activity?.timeZone||timeZone):undefined;
}
