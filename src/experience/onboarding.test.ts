import { describe,expect,it } from 'vitest';
import { onboardingSchema,startingSkillOptions } from './onboarding';
describe('recoverable onboarding',()=>{
  it('rejects malformed or unavailable selections instead of replacing a saved draft',()=>{
    expect(()=>onboardingSchema.parse({name:'A',selected:['removed'],step:1,goal:''})).toThrow();
    expect(()=>onboardingSchema.parse({name:'A',selected:['frontend','frontend'],step:1,goal:''})).toThrow();
    expect(()=>onboardingSchema.parse({name:'A',selected:['frontend'],step:99,goal:''})).toThrow();
  });
  it('keeps every selected starter visible in the short list and searches',()=>{
    const selected=['frontend','acoustic-guitar','calisthenics'];
    for(const search of ['', 'german']){const result=startingSkillOptions(selected,search,false);expect(result.slice(0,3).map(s=>s.id).sort()).toEqual([...selected].sort());}
    expect(startingSkillOptions(selected,'',false)).toHaveLength(9);
  });
});
