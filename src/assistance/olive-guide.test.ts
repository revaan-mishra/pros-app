import { describe, expect, it } from 'vitest';
import { seedGame } from '../domain';
import { oliveAdvice } from './olive-guide';
import { seedExperienceDemo } from '../experience/sample';

describe('Olive guidance', () => {
  it('never creates records, XP or journal access while making a suggestion', () => {
    const data = seedExperienceDemo(); const before = JSON.stringify(data);
    const advice = oliveAdvice(data, undefined, 5);
    expect(advice.state).toBe('practice'); expect(advice.action).toContain('5 minutes');
    expect(JSON.stringify(data)).toBe(before);
    data.journals.push({ id:'secret',revision:1,createdAt:'2026-01-01',updatedAt:'2026-01-01',title:'private',body:'SECRET JOURNAL',date:'2026-01-01' });
    expect(JSON.stringify(oliveAdvice(data))).not.toContain('SECRET');
  });
  it('does not substitute another project when an explicit project is unavailable', () => {
    expect(oliveAdvice(seedExperienceDemo(),'removed').state).toBe('choose');
  });
  it('handles paused and archived projects before suggesting practice', () => {
    const data = seedExperienceDemo(); const project = data.projects.find(p=>!p.deleted)!;
    project.status='paused'; expect(oliveAdvice(data,project.id).state).toBe('paused');
    project.archived=true; expect(oliveAdvice(data,project.id).state).toBe('unavailable');
  });
  it('does not offer focus using an archived skill', () => {
    const data=seedExperienceDemo();const p=data.projects.find(p=>!p.deleted)!;
    data.skills.find(s=>s.id===p.skillId)!.archived=true;
    expect(oliveAdvice(data,p.id).state).toBe('unavailable');
  });
  it('offers an honest empty state with no invented minutes or output', () => {
    const result=oliveAdvice(seedGame('empty','Example'));
    expect(result.state).toBe('choose');expect(result.action).toBeUndefined();
  });
});
