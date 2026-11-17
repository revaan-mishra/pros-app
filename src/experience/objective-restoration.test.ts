import 'fake-indexeddb/auto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { seedGame } from '../domain';
import { commitMutations, db, initializeGame, loadGame, undoCommand } from '../storage';
import { projectEditMutations } from './model';
import type { Objective, Project, Quest } from '../types';

const at='2026-11-17T04:00:00.000Z';
const base=(id:string)=>({id,revision:0,createdAt:at,updatedAt:at});
const objective:Objective={id:'original-objective',title:'Prepare a short take',required:true,completed:false};
function fixture(){
  const data=seedGame('empty');
  const project:Project={...base('project'),title:'One short recording',description:'',outputCriterion:'A complete take',skillId:'acoustic-guitar',regionId:'atelier',status:'active',archived:false,effortTargetSeconds:60,objectives:[{...objective}]};
  const quest:Quest={...base('original-quest'),title:objective.title,skillId:project.skillId,projectId:project.id,objectiveId:objective.id,status:'pending',archived:false,priority:true,recurrence:'none',note:'A note from the earlier action.',dueDate:'2026-11-18',originalDueDate:'2026-11-17',scheduleHistory:[{id:'original-move',at,from:'2026-11-17',to:'2026-11-18'}]};
  data.projects.push(project);data.quests.push(quest);return data;
}
beforeEach(async()=>{
  if(!db.isOpen())await db.open();
  await Promise.all([db.records.clear(),db.commands.clear(),db.undos.clear(),db.snapshots.clear(),db.drafts.clear(),db.cloudRecords.clear(),db.syncMetadata.clear(),db.syncConflicts.clear()]);
});
afterAll(()=>db.close());

describe('explicit objective restoration after draft review',()=>{
  it('restores the original linked quest when an older reviewed draft reintroduces its objective',async()=>{
    const initial=fixture();await initializeGame('local:review',initial);
    const before=(await loadGame('local:review'))!;
    await commitMutations('local:review',projectEditMutations(before,{...before.projects[0],objectives:[]}));
    const removed=(await loadGame('local:review'))!;expect(removed.quests[0].archived).toBe(true);
    // The form rebases after explicit review, keeping the earlier objective IDs.
    const reviewed={...removed.projects[0],objectives:[{...objective,title:'Prepare the revised take'}]};
    const result=await commitMutations('local:review',projectEditMutations(removed,reviewed));
    const restored=(await loadGame('local:review'))!;
    expect(restored.quests).toHaveLength(1);expect(restored.quests[0]).toMatchObject({id:'original-quest',objectiveId:objective.id,title:'Prepare the revised take',archived:false,priority:true,note:'A note from the earlier action.',dueDate:'2026-11-18',originalDueDate:'2026-11-17',scheduleHistory:initial.quests[0].scheduleHistory});
    expect(restored.projects[0].objectives[0].id).toBe(objective.id);
    expect(restored.quests[0].revision).toBeGreaterThan(removed.quests[0].revision);
    await undoCommand('local:review',result.id);
    const undone=(await loadGame('local:review'))!;
    expect(undone.projects[0].objectives).toEqual([]);expect(undone.quests[0].archived).toBe(true);expect(undone.quests[0].title).toBe(objective.title);expect(undone.quests[0].scheduleHistory).toEqual(initial.quests[0].scheduleHistory);
    await commitMutations('local:review',projectEditMutations(undone,{...undone.projects[0],objectives:[{...objective}]}));
    const again=(await loadGame('local:review'))!;expect(again.quests).toHaveLength(1);expect(again.quests[0]).toMatchObject({id:'original-quest',archived:false,objectiveId:objective.id});
  });
  it('preserves intentional archives for objectives that never left the live project',()=>{
    const data=fixture();data.quests[0].archived=true;
    const mutations=projectEditMutations(data,{...data.projects[0],title:'A renamed project',objectives:[{...objective,title:'A clearer preparation title'}]});
    const quest=mutations.find(m=>m.kind==='quests')!.entity as Quest;
    expect(quest.archived).toBe(true);expect(quest.id).toBe('original-quest');expect(quest.title).toBe('A clearer preparation title');expect(quest.scheduleHistory).toEqual(data.quests[0].scheduleHistory);
    expect(data.projects[0].title).toBe('One short recording');expect(data.quests[0].title).toBe(objective.title);
  });
});
