import { describe, expect, it } from 'vitest';
import { REGIONS, SKILLS, SKILL_CATALOG, starterForSkill } from '../catalog';
import { projectGame, seedGame } from '../domain';
import { EXTENDED_SKILLS, extendedGuideForSkill, extendedStarterForSkill } from './extended-skill-content';
import { skillGuide } from './skill-content';

describe('additional optional skill paths', () => {
  it('adds six distinct identities in each region while preserving the original starters', () => {
    expect(EXTENDED_SKILLS).toHaveLength(36);
    expect(SKILLS).toHaveLength(26);
    expect(SKILL_CATALOG).toHaveLength(110);
    expect(new Set(SKILL_CATALOG.map(skill => skill.id)).size).toBe(110);
    expect(new Set(SKILL_CATALOG.map(skill => skill.name.toLowerCase())).size).toBe(110);
    for (const region of REGIONS) expect(EXTENDED_SKILLS.filter(skill => skill.regionId === region.id)).toHaveLength(6);
    for (const skill of EXTENDED_SKILLS) {
      expect(skill.id).toMatch(/^[a-z0-9][a-z0-9-]+$/);
      expect(skill.name.length).toBeGreaterThan(1);
      expect(skill.description.length).toBeGreaterThan(60);
      expect(skill.equipped).toBe(false); expect(skill.archived).toBe(false); expect(skill.custom).toBe(false);
      expect(skill.revision).toBe(0); expect(Number.isFinite(Date.parse(skill.createdAt))).toBe(true);
      expect(new Set(skill.affinities.map(item => item.attribute)).size).toBe(skill.affinities.length);
      expect(skill.affinities.reduce((sum,item) => sum + item.percent,0)).toBe(100);
      expect(skill.affinities.every(item=>Number.isInteger(item.percent)&&item.percent>0)).toBe(true);
    }
  });

  it('supplies distinct projects, outputs, tips and three evidence-based milestones through the existing lookup', () => {
    const titles=new Set<string>(),outputs=new Set<string>(),tips=new Set<string>();
    for (const skill of EXTENDED_SKILLS) {
      const starter=starterForSkill(skill.id),guide=skillGuide(skill.id)!;
      expect(starter).toEqual(extendedStarterForSkill(skill.id));
      expect(starter.description).toBe(skill.description);
      expect(starter.outputCriterion.length).toBeGreaterThan(60);
      expect(starter.actions).toHaveLength(3);
      expect(new Set(starter.actions).size).toBe(3);
      expect(starter.actions.every(action=>action.length>35)).toBe(true);
      expect(guide).toEqual(extendedGuideForSkill(skill.id));
      expect(guide.tip.length).toBeGreaterThan(60);
      expect(guide.milestones.map(milestone=>milestone.xp)).toEqual([60,240,720]);
      expect(new Set(guide.milestones.map(milestone=>milestone.output)).size).toBe(3);
      expect(guide.milestones.every(milestone=>milestone.title.length>5&&milestone.output.length>40)).toBe(true);
      titles.add(starter.title); outputs.add(starter.outputCriterion); tips.add(guide.tip);
    }
    expect(titles.size).toBe(36); expect(outputs.size).toBe(36); expect(tips.size).toBe(36);
    for (const skill of SKILL_CATALOG) expect(skillGuide(skill.id)?.milestones).toHaveLength(3);
  });

  it('keeps suggestions editable without modifying the shared catalog or later lookups', () => {
    const skill=EXTENDED_SKILLS[0];const starter=extendedStarterForSkill(skill.id)!,guide=extendedGuideForSkill(skill.id)!;
    starter.title='My own project';starter.actions[0]='Adapted first step';guide.tip='Changed';guide.milestones[0].output='Changed';
    expect(extendedStarterForSkill(skill.id)?.title).not.toBe('My own project');
    expect(extendedStarterForSkill(skill.id)?.actions[0]).not.toBe('Adapted first step');
    expect(extendedGuideForSkill(skill.id)?.tip).not.toBe('Changed');
    expect(extendedGuideForSkill(skill.id)?.milestones[0].output).not.toBe('Changed');
    for(const id of ['__proto__','constructor','custom:mine']){
      expect(extendedStarterForSkill(id)).toBeUndefined();expect(extendedGuideForSkill(id)).toBeUndefined();
      expect(starterForSkill(id).actions).toHaveLength(3);
    }
  });

  it('does not inject optional skills into fresh worlds or manufacture progression when one is added', () => {
    const data=seedGame('empty','Example');const before=JSON.stringify(data);const projection=projectGame(data);
    for(const skill of EXTENDED_SKILLS){starterForSkill(skill.id);skillGuide(skill.id);expect(data.skills.some(owned=>owned.id===skill.id)).toBe(false);}
    expect(data.skills).toHaveLength(26);expect(JSON.stringify(data)).toBe(before);
    const added=projectGame({...data,skills:[...data.skills,structuredClone(EXTENDED_SKILLS[0])]});
    expect(added.xp).toBe(projection.xp);expect(added.regions).toEqual(projection.regions);
    expect(added.skills[EXTENDED_SKILLS[0].id].xp).toBe(0);expect(added.skills[EXTENDED_SKILLS[0].id].level).toBe(1);
  });
});
