import { describe, expect, it } from 'vitest';
import { REGIONS } from '../catalog';
import { makeAllocations, projectGame, seedGame } from '../domain';
import { experienceFor } from './preferences';
import { REGION_EXPERIENCES, regionAction, regionRequirement, residentResponse } from './regions';
import type { Activity, GameData, Project, RegionId } from '../types';

const stamp = '2026-11-16T04:00:00.000Z';
const base = (id: string) => ({ id, revision: 1, createdAt: stamp, updatedAt: stamp });
function project(regionId: RegionId, data: GameData, id = 'project'): Project {
  const skill = data.skills.find(s => s.regionId === regionId)!;
  return { ...base(id), title: 'One useful result', description: '', outputCriterion: 'A result that exists', skillId: skill.id, regionId, status: 'active', archived: false, effortTargetSeconds: 3600, objectives: [] };
}
function effort(data: GameData, p: Project, seconds = 3600): Activity {
  return { ...base('effort'), title: 'Relevant work', seconds, allocations: makeAllocations(data.skills, p.skillId), projectId: p.id, occurredAt: stamp, localDate: '2026-11-16', timeZone: 'Asia/Kolkata', source: 'manual', note: '' };
}

describe('authored regional content', () => {
  it('finishes six distinct regional stories and eighteen described restorations', () => {
    expect(Object.keys(REGION_EXPERIENCES).sort()).toEqual(REGIONS.map(r => r.id).sort());
    const residents = new Set<string>(), scenes = new Set<string>();
    let changes = 0;
    for (const region of REGIONS) {
      const content = REGION_EXPERIENCES[region.id];
      residents.add(content.caretaker.name); scenes.add(content.asset);
      expect(content.stages).toHaveLength(4);
      expect(new Set(content.stages.map(s => s.title)).size).toBe(4);
      expect(content.mystery.length).toBeGreaterThan(30);
      for (const [index, stage] of content.stages.entries()) {
        expect(stage.changes.length).toBeGreaterThanOrEqual(3);
        expect(stage.chapter).toHaveLength(2);
        expect(stage.chapter.every(p => p.length > 60)).toBe(true);
        if (index > 0) changes++;
      }
    }
    expect(residents.size).toBe(6); expect(scenes.size).toBe(6); expect(changes).toBe(18);
  });
  it('uses the same cumulative gates and reports actual remaining evidence', () => {
    expect([0,1,2].map(s => regionRequirement(s)?.minutes)).toEqual([60,240,720]);
    expect([0,1,2].map(s => regionRequirement(s)?.outcomes)).toEqual([1,2,3]);
    expect(regionRequirement(2, { minutes: 700.5, outcomes: 4, completedProjects: 0 })).toEqual({ stage:3, minutes:720, outcomes:3, requiresProject:true, remainingMinutes:19.5, remainingOutcomes:0, remainingProjects:1 });
    expect(regionRequirement(2, { minutes:800, outcomes:5, completedProjects:1 })?.remainingProjects).toBe(0);
    expect(regionRequirement(3)).toBeNull(); expect(regionRequirement(NaN)?.stage).toBe(1);
  });
});

describe('useful regional routes', () => {
  it('honors a pinned paused project and never starts it or manufactures evidence', () => {
    const data = seedGame('empty'); const p = project('foundry', data, 'pinned'); p.status = 'paused';
    data.projects.push(project('foundry', data, 'active'), p);
    data.profile.experience = { ...experienceFor(data.profile), pinnedProjectId:p.id };
    const before = structuredClone(data);
    const action = regionAction(data, 'foundry');
    expect(action.project?.id).toBe('pinned'); expect(action.label).toBe('Review paused project');
    expect(residentResponse(data, 'foundry').state).toBe('paused-project');
    expect(data).toEqual(before); expect(projectGame(data).xp).toBe(0);
  });
  it('routes to the active project and its stable next quest', () => {
    const data = seedGame('empty'), p = project('atelier', data, 'colon:project');
    p.objectives.push({ id:'prepare',title:'Choose a small piece',required:true,completed:false });
    data.projects.push(p); data.quests.push({ ...base('q'),title:'Choose a small piece',skillId:p.skillId,projectId:p.id,objectiveId:'prepare',status:'pending',archived:false,priority:false,recurrence:'none',note:'' });
    const action = regionAction(data, 'atelier');
    expect(action.href).toBe('/projects/colon%3Aproject'); expect(action.quest?.id).toBe('q');
    expect(action.detail).toContain('Choose a small piece');
    expect(residentResponse(data, 'atelier').state).toBe('active-project');
  });
  it('uses custom regional skills and offers an actionable empty-region fallback', () => {
    const data = seedGame('empty');
    for (const s of data.skills.filter(s => s.regionId === 'observatory')) s.archived = true;
    expect(regionAction(data, 'observatory').kind).toBe('create-skill');
    const original = data.skills.find(s => s.regionId === 'observatory')!;
    data.skills.push({ ...original,...base('custom:question'),name:'My own questions',custom:true,archived:false,equipped:false });
    const action = regionAction(data, 'observatory');
    expect(action.kind).toBe('practice'); expect(action.skill?.id).toBe('custom:question');
    expect(action.href).toBe('/focus?skill=custom%3Aquestion');
  });
  it('does not suggest focus through archived, deleted or moved project skills', () => {
    const data = seedGame('empty'), p = project('foundry', data); data.projects.push(p);
    const skill = data.skills.find(s => s.id === p.skillId)!;
    data.profile.experience = { ...experienceFor(data.profile),pinnedProjectId:p.id };
    for (const change of [{ archived:true },{ archived:false,deleted:true },{ deleted:false,regionId:'sanctuary' as const }]) {
      Object.assign(skill,change);
      const action = regionAction(data,'foundry');
      expect(action.kind).toBe('practice'); expect(action.project).toBeUndefined();
      expect(action.skill?.regionId).toBe('foundry'); expect(action.skill?.id).not.toBe(p.skillId);
    }
    expect(data.projects[0].id).toBe(p.id);
  });
  it('omits a mismatched next-action skill from the focus handoff', () => {
    const data = seedGame('empty'), p = project('atelier',data); data.projects.push(p);
    data.quests.push({ ...base('stale-action'),title:'Old linked action',skillId:'spanish',projectId:p.id,status:'pending',archived:false,priority:false,recurrence:'none',note:'' });
    const action = regionAction(data,'atelier');
    expect(action.project?.id).toBe(p.id); expect(action.skill?.id).toBe(p.skillId); expect(action.quest).toBeUndefined();
  });
});

describe('factual regional residents', () => {
  it('distinguishes preparation/effort readiness from actual output completion', () => {
    const data = seedGame('empty'), p = project('foundry', data); data.projects.push(p);
    expect(residentResponse(data, 'foundry').state).toBe('active-project');
    data.activities.push(effort(data,p));
    const ready = residentResponse(data, 'foundry');
    expect(ready.state).toBe('delivery-ready'); expect(ready.text).toContain('Confirm only when');
    expect(projectGame(data).regions.foundry.outcomes).toBe(0);
  });
  it('prioritizes changed evidence after a correction and does not claim a finished result', () => {
    const data = seedGame('empty'), p = project('citadel', data); p.status = 'completed'; data.projects.push(p);
    data.outputs.push({ ...base('kept:result'),title:'An explained decision',description:'',skillId:p.skillId,regionId:p.regionId,projectId:p.id,confirmedAt:stamp });
    data.activities.push(effort(data,p));
    expect(residentResponse(data,'citadel').state).toBe('kept-output');
    data.activities[0].seconds = 300;
    const changed = residentResponse(data,'citadel');
    expect(changed.state).toBe('changed-evidence'); expect(changed.action.href).toBe('/outputs?output=kept%3Aresult');
    expect(changed.text).toContain('no longer meets');
    expect(projectGame(data).regions.citadel.stage).toBe(0);
  });
  it('preserves progression on a long return and explains the absence without penalty', () => {
    const data = seedGame('empty'), p = project('sanctuary', data);
    data.activities.push({ ...effort(data,p),projectId:undefined });
    const before = projectGame(data);
    expect(residentResponse(data,'sanctuary',{now:Date.parse('2027-01-01T00:00:00Z')}).state).toBe('returning');
    expect(projectGame(data)).toEqual(before);
    expect(residentResponse(data,'sanctuary').state).toBe('practice');
  });
  it.each(REGIONS.map(r => [r.id] as const))('keeps %s useful after campaign completion', regionId => {
    const data = seedGame('empty'), p = project(regionId,data); p.status='completed'; data.projects.push(p);
    data.activities.push(effort(data,p,720*60));
    for (let i=0;i<3;i++) data.outputs.push({ ...base(`output-${i}`),title:`Finished result ${i}`,description:'',skillId:p.skillId,regionId,confirmedAt:stamp,...(i===0?{projectId:p.id}:{}) });
    const projection = projectGame(data);
    expect(projection.regions[regionId].stage).toBe(3);
    const response = residentResponse(data,regionId,{projection});
    expect(response.state).toBe('flourishing'); expect(response.action.kind).toBe('practice');
    expect(response.text).toContain('never resets');
  });
});
