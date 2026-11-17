import { describe, expect, it } from 'vitest';
import { EXTRA_SKILLS, extraStarterForSkill, skillGuide } from './skill-content';

const originals = ['spanish','japanese','french','german','frontend','ai-engineering','data-science','systems-architecture','game-development','acoustic-guitar','music-production','digital-illustration','creative-writing','choreography','calisthenics','weightlifting','cardio','mobility','portfolio-investing','capital-allocation','public-speaking','macroeconomics','stoicism','analytical-thinking','focus-endurance','meditation'];
const regions = ['observatory','foundry','atelier','training','citadel','sanctuary'];

describe('expanded authored skill catalog', () => {
  it('adds forty-eight distinct stable identities, eight in every region, without replacing any original identity', () => {
    expect(EXTRA_SKILLS).toHaveLength(48);
    expect(new Set(EXTRA_SKILLS.map(s=>s.id)).size).toBe(48);
    expect(new Set(EXTRA_SKILLS.map(s=>s.name)).size).toBe(48);
    for (const region of regions) expect(EXTRA_SKILLS.filter(s=>s.regionId===region)).toHaveLength(8);
    for (const skill of EXTRA_SKILLS) {
      expect(originals).not.toContain(skill.id);
      expect(skill.id).toMatch(/^[a-z][a-z0-9-]+$/);
      expect(skill.revision).toBe(0); expect(skill.createdAt).toBe(skill.updatedAt);
      expect(Number.isFinite(Date.parse(skill.createdAt))).toBe(true);
      expect(skill.equipped).toBe(false); expect(skill.archived).toBe(false); expect(skill.custom).toBe(false);
      expect(skill.description.length).toBeGreaterThan(45);
      expect(skill.affinities.every(a=>Number.isInteger(a.percent)&&a.percent>0&&a.percent<=100)).toBe(true);
      expect(new Set(skill.affinities.map(a=>a.attribute)).size).toBe(skill.affinities.length);
      expect(skill.affinities.reduce((sum,a)=>sum+a.percent,0)).toBe(100);
    }
  });

  it('gives each new skill a distinct editable project with three practical actions and a real completion criterion', () => {
    const titles = new Set<string>(), outputs = new Set<string>();
    for (const skill of EXTRA_SKILLS) {
      const starter = extraStarterForSkill(skill.id)!;
      expect(starter).toBeDefined(); expect(starter.actions).toHaveLength(3);
      expect(new Set(starter.actions).size).toBe(3);
      expect(starter.actions.every(action=>action.length>18)).toBe(true);
      expect(starter.outputCriterion.length).toBeGreaterThan(40);
      expect(starter.description).toBe(skill.description);
      titles.add(starter.title); outputs.add(starter.outputCriterion);
      starter.actions[0]='An adapted first action'; starter.title='My adapted project';
      expect(extraStarterForSkill(skill.id)!.actions[0]).not.toBe('An adapted first action');
      expect(extraStarterForSkill(skill.id)!.title).not.toBe('My adapted project');
    }
    expect(titles.size).toBe(48); expect(outputs.size).toBe(48);
  });

  it('authors tips and three distinct evidence milestones for all seventy-four identities without mutating shared content', () => {
    const ids=[...originals,...EXTRA_SKILLS.map(s=>s.id)],tips=new Set<string>();
    expect(new Set(ids).size).toBe(74);
    for (const id of ids) {
      const guide=skillGuide(id)!;
      expect(guide).toBeDefined(); expect(guide.tip.length).toBeGreaterThan(45); tips.add(guide.tip);
      expect(guide.milestones.map(m=>m.xp)).toEqual([60,240,720]);
      expect(new Set(guide.milestones.map(m=>m.title)).size).toBe(3);
      expect(new Set(guide.milestones.map(m=>m.output)).size).toBe(3);
      expect(guide.milestones.every(m=>m.output.length>35&&m.title.length>5)).toBe(true);
      guide.tip='Changed'; guide.milestones[0].output='Changed evidence';
      expect(skillGuide(id)!.tip).not.toBe('Changed'); expect(skillGuide(id)!.milestones[0].output).not.toBe('Changed evidence');
    }
    expect(tips.size).toBe(74);
  });

  it('leaves unknown and user-created skills to the existing generic fallback without inventing catalog content', () => {
    expect(extraStarterForSkill('custom:my-skill')).toBeUndefined();
    expect(extraStarterForSkill('frontend')).toBeUndefined();
    expect(skillGuide('custom:my-skill')).toBeUndefined();
    for (const key of ['__proto__','constructor','toString']) expect(skillGuide(key)).toBeUndefined();
  });
});
