import { creditedActivities, dayKey, latestEntities, projectGame, validOutputs } from '../domain';
import { REGIONS } from '../catalog';
import type { GameData, Journal, RegionId } from '../types';

type Credit = ReturnType<typeof creditedActivities>[number];
export type ChronicleKind = 'reflection' | 'output' | 'practice' | 'book-note';
export type ChronicleQualification = 'personal' | 'current' | 'changed' | 'removed';
export interface ChronicleEvent {
  id: string; sourceId: string; kind: ChronicleKind; date: string; timestamp: string;
  title: string; body: string; regionIds: RegionId[]; qualification: ChronicleQualification;
  detail: string; seconds?: number; href: string; journalId?: string; activityId?: string;
}
export interface ChronicleFilter { from?: string; to?: string; regionId?: RegionId; search?: string; kind?: ChronicleKind; changedOnly?: boolean }
export interface ChronicleSummary {
  from: string; to: string; seconds: number; activities: number; outputs: number; projects: number; books: number; reflections: number;
  distribution: { id: string; name: string; seconds: number }[];
  selectedOutputs: { id: string; title: string; regionId: RegionId; confirmedAt: string; href: string }[];
  statement: string;
}
export function offsetCalendarDay(date: string, offset: number) {
  const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + offset); return value.toISOString().slice(0,10);
}
/** Historical timed work keeps its recorded timezone; estimates keep their chosen date. */
export function creditedDays(credit: Credit): { date: string; seconds: number }[] {
  if (!credit.intervals.length) return [{ date: credit.activity.localDate, seconds: credit.seconds }];
  const totals = new Map<string,number>();
  for (const interval of credit.intervals) {
    let cursor = interval.start;
    while (cursor < interval.end) {
      const date = dayKey(cursor,credit.activity.timeZone);
      let next = interval.end;
      if (dayKey(interval.end-1,credit.activity.timeZone) !== date) {
        let low=cursor+1,high=interval.end;
        while(low<high){const middle=Math.floor((low+high)/2);if(dayKey(middle,credit.activity.timeZone)===date)low=middle+1;else high=middle;}
        next=low;
      }
      totals.set(date,(totals.get(date)||0)+(next-cursor)/1000);cursor=next;
    }
  }
  return [...totals].map(([date,seconds])=>({date,seconds})).sort((a,b)=>a.date.localeCompare(b.date));
}
const recordHref = (id: string) => `/outputs?output=${encodeURIComponent(id)}`;
const between = (date:string,from?:string,to?:string)=> (!from||date>=from)&&(!to||date<=to);
export function milestoneReference(value?: string): {regionId:RegionId;stage:number}|null {
  if(!value)return null;
  const match=value.match(/^(observatory|foundry|atelier|training|citadel|sanctuary)(?::|-stage-|:stage:)([1-3])$/);
  return match?{regionId:match[1] as RegionId,stage:Number(match[2])}:null;
}
function journalRegions(j:Journal,data:GameData):RegionId[]{
  const milestone=milestoneReference(j.milestoneId);if(milestone)return [milestone.regionId];
  const p=data.projects.find(p=>p.id===j.projectId);if(p)return[p.regionId];
  const output=data.outputs.find(o=>!o.deleted&&o.bookId===j.bookId);if(output)return[output.regionId];
  const book=data.books.find(b=>b.id===j.bookId),skill=data.skills.find(s=>s.id===book?.skillId);if(skill)return[skill.regionId];
  const activity=data.activities.find(a=>a.id===j.activityId);return [...new Set(activity?.allocations.map(a=>a.regionId)||[])];
}
/** Entries are current views of source evidence, never a second history that awards XP. */
export function chronicleEvents(data:GameData,filter:ChronicleFilter={}):ChronicleEvent[]{
  const events:ChronicleEvent[]=[]; const eligible=new Set(validOutputs(data).map(o=>o.id)); const projection=projectGame(data);
  const credits=creditedActivities(data),creditById=new Map(credits.map(c=>[c.activity.id,c]));
  for(const journal of latestEntities(data.journals).filter(j=>!j.deleted)){
    const milestone=milestoneReference(journal.milestoneId); const qualified=!journal.milestoneId || !!milestone&&projection.regions[milestone.regionId].stage>=milestone.stage;
    events.push({id:`journal:${journal.id}`,sourceId:journal.id,kind:'reflection',date:journal.date,timestamp:journal.createdAt,title:journal.title,body:journal.body,regionIds:journalRegions(journal,data),qualification:journal.milestoneId?qualified?'current':'changed':'personal',detail:journal.milestoneId?qualified?'Milestone note · current evidence qualifies':milestone?'Milestone evidence changed · writing preserved':'Milestone reference unavailable · writing preserved':'Your writing · preserved independently of progression',href:'/journal',journalId:journal.id});
  }
  for(const output of latestEntities(data.outputs))events.push({id:`output:${output.id}`,sourceId:output.id,kind:'output',date:dayKey(output.confirmedAt,data.profile.timeZone),timestamp:output.confirmedAt,title:output.title,body:output.description,regionIds:[output.regionId],qualification:output.deleted?'removed':eligible.has(output.id)?'current':'changed',detail:output.deleted?'Removed evidence · excluded from recap totals':eligible.has(output.id)?output.bookId?'Finished book · one distinct output':output.projectId?'Completed project · one distinct output':'Finished result · one distinct output':'Source requirements changed · excluded from recap totals',href:recordHref(output.id)});
  for(const activity of latestEntities(data.activities).filter(a=>!a.deleted)){
    const credit=creditById.get(activity.id);const regions=[...new Set((credit?.allocations||activity.allocations).map(a=>a.regionId))];
    const slices=credit?creditedDays(credit):[];
    if(!slices.length && activity.note.trim())slices.push({date:activity.localDate,seconds:0});
    for(const slice of slices){
      const share=filter.regionId?(credit?.allocations||activity.allocations).filter(a=>a.regionId===filter.regionId).reduce((sum,a)=>sum+a.percent,0)/100:1;
      const seconds=slice.seconds*share;
      if(filter.regionId&&share===0)continue;
      events.push({id:`practice:${activity.id}:${slice.date}`,sourceId:activity.id,kind:'practice',date:slice.date,timestamp:activity.occurredAt,title:activity.title,body:activity.note,regionIds:regions,qualification:seconds>0?'current':'changed',seconds,detail:seconds>0?`${formatChronicleEffort(seconds)} credited · ${activity.source==='focus'?'confirmed focus':activity.source==='reading'?'reading':'recorded practice'}`:'Activity note retained · no currently credited effort',href:'/history',activityId:activity.id});
    }
  }
  for(const book of latestEntities(data.books).filter(b=>!b.deleted&&b.notes.trim())){
    const output=data.outputs.find(o=>!o.deleted&&o.bookId===book.id);const skill=data.skills.find(s=>s.id===book.skillId);const regionId=output?.regionId||skill?.regionId;
    events.push({id:`book-note:${book.id}`,sourceId:book.id,kind:'book-note',date:dayKey(book.updatedAt,data.profile.timeZone),timestamp:book.updatedAt,title:book.title,body:book.notes,regionIds:regionId?[regionId]:[],qualification:'personal',detail:`Book notes · last edited ${dayKey(book.updatedAt,data.profile.timeZone)} · ${book.status}`,href:'/library'});
  }
  const search=filter.search?.trim().toLocaleLowerCase();
  return events.filter(e=>between(e.date,filter.from,filter.to)&&(!filter.regionId||e.regionIds.includes(filter.regionId))&&(!filter.kind||e.kind===filter.kind)&&(!filter.changedOnly||['changed','removed'].includes(e.qualification))&&(!search||`${e.title} ${e.body} ${e.detail}`.toLocaleLowerCase().includes(search))).sort((a,b)=>b.date.localeCompare(a.date)||b.timestamp.localeCompare(a.timestamp)||a.id.localeCompare(b.id));
}
export function formatChronicleEffort(seconds:number){
  const safe=Number.isFinite(seconds)?Math.max(0,seconds):0;
  if(safe<60)return `${new Intl.NumberFormat('en',{maximumFractionDigits:1}).format(safe)} sec`;
  return `${new Intl.NumberFormat('en',{maximumFractionDigits:1}).format(safe/60)} min`;
}
/** Seven inclusive calendar dates ending today in the confirmed profile timezone. */
export function weeklyChronicle(data:GameData,now:number=Date.now(),regionId?:RegionId):ChronicleSummary{
  const to=dayKey(now,data.profile.timeZone),from=offsetCalendarDay(to,-6),bySkill=new Map<string,number>();let seconds=0;const activityIds=new Set<string>();
  for(const credit of creditedActivities(data)){
    const inWindow=creditedDays(credit).filter(d=>between(d.date,from,to)).reduce((sum,d)=>sum+d.seconds,0);if(!inWindow)continue;
    const allocations=credit.allocations.filter(a=>!regionId||a.regionId===regionId);
    let local=0;for(const allocation of allocations){const share=inWindow*allocation.percent/100;local+=share;bySkill.set(allocation.skillId,(bySkill.get(allocation.skillId)||0)+share);}
    if(local>0){seconds+=local;activityIds.add(credit.activity.id);}
  }
  const outputs=validOutputs(data).filter(o=>(!regionId||o.regionId===regionId)&&between(dayKey(o.confirmedAt,data.profile.timeZone),from,to));
  const reflections=latestEntities(data.journals).filter(j=>!j.deleted&&!j.milestoneId&&between(j.date,from,to)&&(!regionId||journalRegions(j,data).includes(regionId))).length;
  const distribution=[...bySkill].map(([id,seconds])=>({id,name:data.skills.find(s=>s.id===id)?.name||'Archived skill',seconds})).sort((a,b)=>b.seconds-a.seconds||a.id.localeCompare(b.id));
  const projects=new Set(outputs.flatMap(o=>o.projectId?[o.projectId]:[])).size,books=new Set(outputs.flatMap(o=>o.bookId?[o.bookId]:[])).size;
  const selectedOutputs=outputs.slice().sort((a,b)=>b.confirmedAt.localeCompare(a.confirmedAt)||a.id.localeCompare(b.id)).slice(0,6).map(o=>({id:o.id,title:o.title,regionId:o.regionId,confirmedAt:o.confirmedAt,href:recordHref(o.id)}));
  return {from,to,seconds,activities:activityIds.size,outputs:outputs.length,projects,books,reflections,distribution,selectedOutputs,statement:seconds||outputs.length?`${formatChronicleEffort(seconds)} of credited effort across ${activityIds.size} ${activityIds.size===1?'activity':'activities'}. ${outputs.length} distinct finished ${outputs.length===1?'result':'results'}, including ${projects} ${projects===1?'project':'projects'} and ${books} ${books===1?'book':'books'}.`:'No credited effort or finished results in these seven dates. Your earlier progress is preserved.'};
}
export function worldMemories(data:GameData){
  const projection=projectGame(data);
  return REGIONS.map(region=>({regionId:region.id,stage:projection.regions[region.id].stage,minutes:projection.regions[region.id].minutes,outputs:projection.regions[region.id].outcomes,projects:projection.regions[region.id].completedProjects,href:`/world?region=${region.id}`}));
}
