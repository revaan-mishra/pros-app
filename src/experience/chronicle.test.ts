import { describe, expect, it } from 'vitest';
import { creditedActivities, dailyEffort, makeAllocations, projectGame, seedGame } from '../domain';
import type { Activity, GameData, Journal, Output, Project } from '../types';
import { chronicleEvents, creditedDays, milestoneReference, weeklyChronicle, worldMemories } from './chronicle-model';

const at='2026-11-15T08:00:00.000Z';
const now=Date.parse('2026-11-17T04:00:00.000Z');
const base=(id:string)=>({id,revision:1,createdAt:at,updatedAt:at});
function fixture(){const data=seedGame('empty');data.profile.timeZone='Asia/Kolkata';return data;}
function activity(data:GameData,id='work',seconds=3600):Activity{return {...base(id),title:'An actual practice',seconds,allocations:makeAllocations(data.skills,'acoustic-guitar'),occurredAt:at,localDate:'2026-11-15',timeZone:'Asia/Kolkata',source:'manual',note:'A note I wrote.'};}
function project(data:GameData):Project{return {...base('project'),title:'A finished recording',description:'',outputCriterion:'One complete take',skillId:'acoustic-guitar',regionId:'atelier',status:'completed',archived:false,effortTargetSeconds:3600,objectives:[]};}
function output(id='result',extra:Partial<Output>={}):Output{return {...base(id),title:'A take kept',description:'A real saved result',skillId:'acoustic-guitar',regionId:'atelier',confirmedAt:at,...extra};}
function journal(id='words',extra:Partial<Journal>={}):Journal{return {...base(id),title:'A note to return to',body:'My personal memory stays exactly as written.',date:'2026-11-15',...extra};}

describe('Chronicle timing and conservation',()=>{
  it('uses seven inclusive calendar dates in the confirmed profile zone and excludes outside estimates',()=>{
    const data=fixture();data.activities.push(activity(data,'included-start',13),{...activity(data,'included-end',17),localDate:'2026-11-17'}, {...activity(data,'before',1000),localDate:'2026-11-10'},{...activity(data,'future',1000),localDate:'2026-11-18'});
    const result=weeklyChronicle(data,now);
    expect(result.from).toBe('2026-11-11');expect(result.to).toBe('2026-11-17');expect(result.seconds).toBe(30);expect(result.activities).toBe(2);
    data.profile.timeZone='Pacific/Kiritimati';const shifted=weeklyChronicle(data,Date.parse('2026-11-17T12:00:00Z'));expect(shifted.from).toBe('2026-11-12');expect(shifted.to).toBe('2026-11-18');
  });
  it('splits a timed activity across midnight, including only the credited part in the recap',()=>{
    const data=fixture();const timed={...activity(data),occurredAt:'2026-11-10T18:00:00.000Z',localDate:'2026-11-10',startedAt:'2026-11-10T18:00:00.000Z',endedAt:'2026-11-10T19:00:00.000Z'};
    data.activities.push(timed);
    const days=creditedDays(creditedActivities(data)[0]);expect(days).toEqual([{date:'2026-11-10',seconds:1800},{date:'2026-11-11',seconds:1800}]);
    expect(weeklyChronicle(data,now).seconds).toBe(1800);
    expect(chronicleEvents(data,{kind:'practice',from:'2026-11-11',to:'2026-11-11'}).map(e=>e.seconds)).toEqual([1800]);
    data.profile.timeZone='UTC';expect(weeklyChronicle(data,now).seconds).toBe(1800);expect(creditedDays(creditedActivities(data)[0])).toEqual(days);
  });
  it('conserves timed evidence over DST and duplicate overlapping activities',()=>{
    const data=fixture();const timed={...activity(data,'a',10800),timeZone:'America/New_York',occurredAt:'2026-11-01T03:30:00Z',localDate:'2026-10-31',startedAt:'2026-11-01T03:30:00Z',endedAt:'2026-11-01T06:30:00Z'};
    data.activities.push(timed,{...timed,id:'b',note:''});
    const credits=creditedActivities(data);expect(credits).toHaveLength(1);
    expect(creditedDays(credits[0])).toEqual([{date:'2026-10-31',seconds:1800},{date:'2026-11-01',seconds:9000}]);
    expect(Object.values(dailyEffort(data)).reduce((a,b)=>a+b,0)).toBe(10800);
    const events=chronicleEvents(data,{kind:'practice'});expect(events.reduce((sum,e)=>sum+(e.seconds||0),0)).toBe(10800);
  });
  it('divides effort by historical region allocation without multiplying activity counts or total seconds',()=>{
    const data=fixture();const work=activity(data,'split',61);work.allocations=makeAllocations(data.skills,'acoustic-guitar','frontend',37);data.activities.push(work);
    const all=weeklyChronicle(data,now),atelier=weeklyChronicle(data,now,'atelier'),foundry=weeklyChronicle(data,now,'foundry');
    expect(all.seconds).toBe(61);expect(atelier.seconds).toBeCloseTo(22.57);expect(foundry.seconds).toBeCloseTo(38.43);expect(atelier.seconds+foundry.seconds).toBeCloseTo(all.seconds);expect(all.activities).toBe(1);
    expect(all.distribution.reduce((s,a)=>s+a.seconds,0)).toBeCloseTo(61);
    expect(chronicleEvents(data,{kind:'practice',regionId:'atelier'})[0].seconds).toBeCloseTo(22.57);
    data.skills.find(s=>s.id==='acoustic-guitar')!.regionId='citadel';expect(weeklyChronicle(data,now,'atelier').seconds).toBeCloseTo(22.57);
  });
});

describe('factual evidence and preserved writing',()=>{
  it('counts each valid output once, with project/book counts included rather than added again',()=>{
    const data=fixture();const p=project(data);data.projects.push(p);data.activities.push({...activity(data),projectId:p.id});
    data.books.push({...base('book'),title:'A finished book',author:'',status:'completed',pages:100,totalPages:100,skillId:'french',notes:'An idea I wrote down.',archived:false});
    data.outputs.push(output('a-project',{projectId:p.id}),output('b-duplicate',{projectId:p.id}),output('c-book',{skillId:'french',regionId:'observatory',bookId:'book'}),output('d-duplicate',{skillId:'french',regionId:'observatory',bookId:'book'}));
    const result=weeklyChronicle(data,now);expect(result.outputs).toBe(2);expect(result.projects).toBe(1);expect(result.books).toBe(1);expect(result.selectedOutputs).toHaveLength(2);expect(result.seconds).toBe(3600);
    expect(chronicleEvents(data,{kind:'book-note'})[0].qualification).toBe('personal');
    expect(chronicleEvents(data,{kind:'output'}).filter(e=>e.qualification==='current')).toHaveLength(2);
    data.projects[0].status='active';data.books[0].status='reading';const changed=weeklyChronicle(data,now);expect(changed.outputs).toBe(0);expect(changed.projects).toBe(0);expect(changed.books).toBe(0);expect(changed.seconds).toBe(3600);
  });
  it('keeps corrected and removed output text and stable encoded links while excluding them from the recap',()=>{
    const data=fixture();data.outputs.push(output('missing:project',{projectId:'not-present'}),output('removed:result',{deleted:true}));
    const events=chronicleEvents(data,{changedOnly:true});expect(events).toHaveLength(2);
    expect(events.find(e=>e.sourceId==='missing:project')).toMatchObject({qualification:'changed',href:'/outputs?output=missing%3Aproject',body:'A real saved result'});
    expect(events.find(e=>e.sourceId==='removed:result')).toMatchObject({qualification:'removed',href:'/outputs?output=removed%3Aresult'});
    expect(weeklyChronicle(data,now).outputs).toBe(0);
  });
  it('re-evaluates linked milestones after correction without deleting personal writing',()=>{
    const data=fixture();data.activities.push(activity(data));data.outputs.push(output());data.journals.push(journal('personal',{projectId:'missing-source'}),journal('automatic',{milestoneId:'atelier:1'}));
    expect(chronicleEvents(data,{kind:'reflection'}).find(e=>e.sourceId==='automatic')?.qualification).toBe('current');
    data.activities[0].seconds=60;
    const changed=chronicleEvents(data,{kind:'reflection'});expect(changed.find(e=>e.sourceId==='automatic')).toMatchObject({qualification:'changed',body:'My personal memory stays exactly as written.',href:'/journal',journalId:'automatic'});
    expect(changed.find(e=>e.sourceId==='personal')).toMatchObject({qualification:'personal',body:'My personal memory stays exactly as written.'});
    expect(weeklyChronicle(data,now).reflections).toBe(1);
  });
  it('handles unknown milestone references explicitly and uses current journal revisions and tombstones',()=>{
    const data=fixture();data.journals.push(journal('older'),journal('older',{revision:2,deleted:true}),journal('unknown',{milestoneId:'no-longer-supported'}));
    const entries=chronicleEvents(data,{kind:'reflection'});expect(entries).toHaveLength(1);expect(entries[0]).toMatchObject({sourceId:'unknown',qualification:'changed'});expect(entries[0].detail).toBe('Milestone reference unavailable · writing preserved');
    expect(milestoneReference('atelier-stage-2')).toEqual({regionId:'atelier',stage:2});expect(milestoneReference('foundry:stage:3')).toEqual({regionId:'foundry',stage:3});expect(milestoneReference('atelier:9')).toBeNull();
  });
  it('keeps an uncredited activity note available without claiming additional effort',()=>{
    const data=fixture();const work=activity(data);work.allocations=[];data.activities.push(work);
    const event=chronicleEvents(data,{kind:'practice'})[0];expect(event).toMatchObject({qualification:'changed',seconds:0,body:'A note I wrote.',href:'/history',activityId:'work'});expect(weeklyChronicle(data,now).seconds).toBe(0);
  });
  it('filters stable entries by type, date, region, changed status and the exact user text',()=>{
    const data=fixture();data.outputs.push(output('one'),output('two',{regionId:'foundry',skillId:'frontend',title:'My navigation model',confirmedAt:'2026-11-16T07:00:00Z'}));data.journals.push(journal());
    const entries=chronicleEvents(data,{kind:'output',regionId:'foundry',from:'2026-11-16',to:'2026-11-16',search:'NAVIGATION'});expect(entries.map(e=>e.sourceId)).toEqual(['two']);
    expect(chronicleEvents(data,{from:'2026-11-17',to:'2026-11-10'})).toEqual([]);
  });
  it('shows current world evidence without inventing a historical unlock date and never mutates progress',()=>{
    const data=fixture();data.activities.push(activity(data));data.outputs.push(output());data.journals.push(journal());const original=structuredClone(data),before=projectGame(data);
    const memories=worldMemories(data);expect(memories).toHaveLength(6);expect(memories.find(m=>m.regionId==='atelier')).toMatchObject({stage:1,minutes:60,outputs:1,href:'/world?region=atelier'});
    expect(memories.every(m=>!('date' in m)&&!('timestamp' in m)&&!('unlockedAt' in m))).toBe(true);
    chronicleEvents(data);weeklyChronicle(data,now);expect(data).toEqual(original);expect(projectGame(data)).toEqual(before);
    data.activities[0].seconds=1;expect(worldMemories(data).find(m=>m.regionId==='atelier')?.stage).toBe(0);expect(data.journals[0].body).toBe(original.journals[0].body);
  });
});
