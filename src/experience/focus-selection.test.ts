import { describe,expect,it } from 'vitest';
import { seedGame } from '../domain';
import { availableFocusSkill,focusStartMinutes,intervalEvidenceDate } from './focus-selection';
import type { Activity,FocusSession } from '../types';
const at='2026-11-17T00:00:00Z';
describe('focus context and dated evidence sanity',()=>{
  it('avoids a stale requested or remembered skill but preserves a running session source',()=>{
    const data=seedGame('empty');const stale=data.skills[0];stale.archived=true;data.profile.lastSkillId=stale.id;
    expect(availableFocusSkill(data,stale.id)?.id).not.toBe(stale.id);
    const session:FocusSession={id:'s',revision:0,createdAt:at,updatedAt:at,skillId:stale.id,status:'paused',targetSeconds:60,segments:[]};
    expect(availableFocusSkill(data,undefined,session)?.id).toBe(stale.id);
    data.skills.forEach(s=>s.archived=true);expect(availableFocusSkill(data)).toBeUndefined();
  });
  it('ignores an irrelevant empty countdown input for stopwatch',()=>{
    expect(focusStartMinutes('',true,25)).toBe(25);expect(focusStartMinutes('NaN',true,50)).toBe(50);
    expect(()=>focusStartMinutes('',false,25)).toThrow();expect(focusStartMinutes('15',false,25)).toBe(15);
  });
  it('locks interval evidence to its recorded start date while estimates remain freely dated',()=>{
    const session:FocusSession={id:'s',revision:0,createdAt:at,updatedAt:at,skillId:'frontend',status:'review',targetSeconds:3600,segments:[{start:Date.parse('2026-11-16T18:15:00Z'),end:Date.parse('2026-11-16T19:15:00Z')}]};
    expect(intervalEvidenceDate(undefined,session,'Asia/Kolkata')).toBe('2026-11-16');
    const activity:Activity={id:'a',revision:0,createdAt:at,updatedAt:at,title:'Timed',seconds:3600,allocations:[],occurredAt:at,localDate:'2026-11-16',timeZone:'Asia/Kolkata',source:'manual',note:'',startedAt:'2026-11-16T18:15:00Z',endedAt:'2026-11-16T19:15:00Z'};
    expect(intervalEvidenceDate(activity,undefined,'America/New_York')).toBe('2026-11-16');
    delete activity.startedAt;delete activity.endedAt;expect(intervalEvidenceDate(activity,undefined,'UTC')).toBeUndefined();
  });
});
