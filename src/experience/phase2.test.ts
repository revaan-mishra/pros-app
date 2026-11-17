import 'fake-indexeddb/auto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { creditedActivities, dayKey, projectGame, questStatusMutations, seedGame, validOutputs } from '../domain';
import { draftJSON } from '../draft-data';
import { claimLandmarks } from '../discoveries';
import { commitMutations, db, exportBackup, importBackup, initializeGame, listDrafts, listSnapshots, loadDraft, loadGame, previewImport, restoreSnapshot, saveDraft, saveSnapshot, undoCommand, validateBackup } from '../storage';
import { completeProjectMutations, historicalAllocations, projectEditMutations } from './model';
import { changeImpact, completeBookMutations, continuationMutations, outputChangeMutations, questEditMutations, rescheduledQuest, routineOccurrenceMutations } from './record-commands';
import { draftDestination, projectDraftSchema } from './record-drafts';
import type { Activity, GameData, Mutation, Project, Quest } from '../types';

const at = '2026-11-16T04:00:00.000Z';
const base = (id: string, revision = 0) => ({ id, revision, createdAt: at, updatedAt: at });
function fixture() {
  const data = seedGame('empty','Test'); data.profile.timeZone = 'Asia/Kolkata';
  data.projects.push({ ...base('project'), title:'A finished take', description:'Practice and keep a take.', outputCriterion:'A complete recording', skillId:'acoustic-guitar', regionId:'atelier', status:'active', archived:false, effortTargetSeconds:3600, objectives:[{id:'step',title:'Prepare the piece',required:true,completed:true}] });
  return data;
}
function log(data: GameData, id = 'practice', seconds = 3600): Activity { return { ...base(id), title:'Practice', seconds, allocations:historicalAllocations(data,'acoustic-guitar','',100), occurredAt:at, localDate:'2026-11-16', timeZone:'Asia/Kolkata', note:'', source:'manual', projectId:'project' }; }
function apply(data: GameData, mutations: Mutation[]) { for(const m of mutations){ if(m.kind==='profile')data.profile=m.entity as GameData['profile'];else{const list=data[m.kind] as typeof m.entity[];const index=list.findIndex(e=>e.id===m.entity.id);if(index<0)list.push(m.entity);else list[index]=m.entity;}} }
function projectDraft(data: GameData) { const p=data.projects[0];return { recordId:p.id,commandId:'draft-command',baseRevision:p.revision,createdAt:p.createdAt,title:'An unfinished title',description:'Private description',criterion:p.outputCriterion,skillId:p.skillId,effort:'60',date:'',status:p.status,objectives:p.objectives }; }
function quest(id='quest'): Quest { return { ...base(id),title:'Practice',skillId:'acoustic-guitar',dueDate:'2026-11-16',status:'pending',archived:false,priority:false,recurrence:'none',note:'' }; }
beforeEach(async()=>{if(!db.isOpen())await db.open();await Promise.all([db.records.clear(),db.commands.clear(),db.undos.clear(),db.snapshots.clear(),db.drafts.clear(),db.cloudRecords.clear(),db.syncMetadata.clear(),db.syncConflicts.clear()]);});
afterAll(()=>db.close());

describe('recoverable work and versioned backups',()=>{
  it('detects competing autosaves and requires an explicit comparison before replacing a newer draft',async()=>{
    const a={commandId:'same-submission',title:'Original'};
    await saveDraft('local:alice','project:new:general',a,null);
    await saveDraft('local:alice','project:new:general',{...a,title:'First tab'},{value:a});
    await expect(saveDraft('local:alice','project:new:general',{...a,title:'Second tab'},{value:a})).rejects.toThrow('Review both');
    expect((await loadDraft<{title:string}>('local:alice','project:new:general'))!.title).toBe('First tab');
    // Explicitly choosing the second tab after review adopts the version it compared.
    await saveDraft('local:alice','project:new:general',{...a,title:'Second tab'},{value:{...a,title:'First tab'}});
    expect((await loadDraft<{title:string}>('local:alice','project:new:general'))!.title).toBe('Second tab');
  });
  it('refuses a record save if another tab changes its reviewed draft before commit',async()=>{
    const data=fixture();await initializeGame('local:alice',data);
    const original={commandId:'capture',recordId:'practice',minutes:'60'};
    await saveDraft('local:alice','activity-v2:manual',original,null);
    await saveDraft('local:alice','activity-v2:manual',{...original,minutes:'30'},{value:original});
    await expect(commitMutations('local:alice',[{kind:'activities',entity:log(data)}],'capture',{name:'activity-v2:manual',value:original})).rejects.toThrow('Review both');
    expect((await loadGame('local:alice'))!.activities).toEqual([]);expect(await db.commands.get(['local:alice','capture'])).toBeUndefined();
    const reviewed={...original,minutes:'30'};
    await commitMutations('local:alice',[{kind:'activities',entity:log(data,'practice',1800)}],'capture',{name:'activity-v2:manual',value:reviewed});
    expect(await loadDraft('local:alice','activity-v2:manual')).toBeNull();
    await saveDraft('local:alice','activity-v2:manual',{...reviewed,minutes:'15'},null);
    await commitMutations('local:alice',[{kind:'activities',entity:log(data,'practice',1800)}],'capture',{name:'activity-v2:manual',value:reviewed});
    expect((await loadDraft<{minutes:string}>('local:alice','activity-v2:manual'))!.minutes).toBe('15');
  });
  it('round trips nested project preparation, private notes and every form draft through restart and backup',async()=>{
    const data=fixture();await initializeGame('local:alice',data);
    const values={ 'project:project':projectDraft(data),'quest:new:general':{title:'A next action',note:'Private note'},'book:new':{title:'A book',notes:'Reading notes'},'output:new:general':{title:'A result',description:'What changed'},'journal:new':{title:'Private journal',body:'My unfinished words'},'activity-v2:manual':{recordId:'pending-effort',commandId:'capture',minutes:'15'} };
    for(const [name,value] of Object.entries(values))await saveDraft('local:alice',name,value);
    db.close();await db.open();expect(projectDraftSchema.parse(await loadDraft('local:alice','project:project')).objectives[0].id).toBe('step');
    const backup=await exportBackup('local:alice');expect(backup.version).toBe(2);expect(backup.drafts).toHaveLength(6);
    await importBackup('local:bob',backup);expect((await listDrafts('local:bob')).map(d=>d.name).sort()).toEqual(Object.keys(values).sort());
    expect(await loadDraft('local:bob','journal:new')).toEqual(values['journal:new']);expect(projectGame((await loadGame('local:bob'))!)).toEqual(projectGame(data));
    expect(await loadDraft('local:unrelated','journal:new')).toBeNull();
  });
  it('continues to accept version 1, requires drafts in version 2, and rejects duplicate names or credential objects',async()=>{
    await initializeGame('local:alice',fixture());const backup=await exportBackup('local:alice');const {drafts:_,...old}=backup;
    expect(validateBackup({...old,version:1}).drafts).toBeUndefined();expect(()=>validateBackup(old)).toThrow('drafts');
    const draft={name:'journal:new',value:{body:'A thought'},updatedAt:at};expect(()=>validateBackup({...backup,drafts:[draft,draft]})).toThrow('duplicate draft');
    expect(()=>validateBackup({...backup,drafts:[{...draft,value:{body:'text',auth:{refreshToken:'must-not-export'}}}]})).toThrow('Authentication');
    await expect(saveDraft('local:alice','journal:new',{password:'must-not-store'})).rejects.toThrow('Authentication');
    expect(await listDrafts('local:alice')).toEqual([]);
  });
  it('atomically saves a record and consumes only its matching submission draft',async()=>{
    const data=fixture();await initializeGame('local:alice',data);await saveDraft('local:alice','activity-v2:manual',{commandId:'capture',recordId:'practice'});await saveDraft('local:bob','activity-v2:manual',{commandId:'capture',recordId:'other'});
    const invalid=log(data);invalid.allocations[0].skillId='missing';
    await expect(commitMutations('local:alice',[{kind:'activities',entity:invalid}],'capture','activity-v2:manual')).rejects.toThrow();
    expect(await loadDraft('local:alice','activity-v2:manual')).not.toBeNull();expect((await loadGame('local:alice'))!.activities).toEqual([]);
    await commitMutations('local:alice',[{kind:'activities',entity:log(data)}],'capture','activity-v2:manual');expect(await loadDraft('local:alice','activity-v2:manual')).toBeNull();
    await saveDraft('local:alice','activity-v2:manual',{commandId:'new-capture',recordId:'new'});
    await commitMutations('local:alice',[{kind:'activities',entity:log(data)}],'capture','activity-v2:manual');
    expect(await loadDraft('local:alice','activity-v2:manual')).toEqual({commandId:'new-capture',recordId:'new'});expect(await loadDraft('local:bob','activity-v2:manual')).not.toBeNull();
    expect(projectGame((await loadGame('local:alice'))!).xp).toBe(60);
  });
  it('preserves both record and draft versions until an import conflict is explicitly resolved',async()=>{
    const data=fixture();await initializeGame('local:alice',data);await saveDraft('local:alice','project:project',projectDraft(data));const backup=await exportBackup('local:alice');
    backup.drafts![0].value=draftJSON({...projectDraft(data),title:'Backup draft'});backup.data.projects[0].title='Backup project';
    const preview=await previewImport('local:alice',backup);expect(preview.draftConflicts).toHaveLength(1);expect(preview.conflicts.map(c=>c.key)).toContain('projects:project');
    const count=(await listSnapshots('local:alice')).length;
    await expect(importBackup('local:alice',backup)).rejects.toThrow('choice');expect((await listSnapshots('local:alice')).length).toBe(count);
    expect((await loadGame('local:alice'))!.projects[0].title).toBe(data.projects[0].title);
    await importBackup('local:alice',backup,{'projects:project':'use-backup','draft:project:project':'keep-local'});
    expect((await loadDraft<{title:string}>('local:alice','project:project'))!.title).toBe('An unfinished title');
    await importBackup('local:alice',backup,{'draft:project:project':'use-backup'});expect((await loadDraft<{title:string}>('local:alice','project:project'))!.title).toBe('Backup draft');
  });
  it('rebases a current editing draft after import but preserves a stale draft as a conflict',async()=>{
    const data=fixture();data.projects[0].revision=7;await initializeGame('local:alice',data);await saveDraft('local:alice','project:project',projectDraft(data));
    const backup=await exportBackup('local:alice');await importBackup('local:restored',backup);
    const restored=(await loadGame('local:restored'))!;const draft=await loadDraft<{baseRevision:number}>('local:restored','project:project');expect(draft!.baseRevision).toBe(restored.projects[0].revision);
    backup.drafts![0].value=draftJSON({...projectDraft(data),baseRevision:2});await importBackup('local:stale',backup);expect((await loadDraft<{baseRevision:number}>('local:stale','project:project'))!.baseRevision).toBe(-1);
  });
  it('restores draft text with recovery snapshots and preserves newer drafts for legacy snapshots',async()=>{
    await initializeGame('local:alice',fixture());await saveDraft('local:alice','journal:new',{body:'First unfinished words'});const snapshot=await saveSnapshot('local:alice');await saveDraft('local:alice','journal:new',{body:'Newer unfinished words'});
    await restoreSnapshot('local:alice',snapshot.id);expect(await loadDraft('local:alice','journal:new')).toEqual({body:'First unfinished words'});
    const current=(await loadGame('local:alice'))!;await db.snapshots.put({id:'legacy',accountId:'local:alice',createdAt:at,recordCount:1,data:current});
    await saveDraft('local:alice','journal:new',{body:'Keep this with old snapshot'});await restoreSnapshot('local:alice','legacy');expect(await loadDraft('local:alice','journal:new')).toEqual({body:'Keep this with old snapshot'});
  });
  it('unions celebration history during import and snapshot restore rather than replaying rewards',async()=>{
    await initializeGame('local:alice',fixture());const early=await saveSnapshot('local:alice');await claimLandmarks('local:alice',[{id:'atelier:1',regionId:'atelier',stage:1}]);
    const backup=await exportBackup('local:alice');backup.drafts!.find(d=>d.name==='landmark-presentations-v1')!.value={version:1,seenIds:['atelier:2']};
    const preview=await previewImport('local:alice',backup);expect(preview.draftConflicts).toEqual([]);expect(preview.mergedDrafts).toBe(1);await importBackup('local:alice',backup);
    await restoreSnapshot('local:alice',early.id);expect(await claimLandmarks('local:alice',[{id:'atelier:1',regionId:'atelier',stage:1},{id:'atelier:2',regionId:'atelier',stage:2}])).toEqual([]);
  });
  it('keeps a large archive’s eligible wardrobe intact while chunking recovery',async()=>{
    const data=fixture();data.activities=Array.from({length:2100},(_,i)=>log(data,`practice-${i}`,60));apply(data,completeProjectMutations(data,data.projects[0],at));
    data.outputs.push({...base('second'),title:'Second result',description:'',skillId:'acoustic-guitar',regionId:'atelier',confirmedAt:at},{...base('third'),title:'Third result',description:'',skillId:'acoustic-guitar',regionId:'atelier',confirmedAt:at});
    const outfit=projectGame(data).eligibleCosmetics.find(id=>id.endsWith('outfit'))!;expect(outfit).toBeTruthy();data.profile.equipment.outfit=outfit;await initializeGame('local:alice',data);await importBackup('local:restored',await exportBackup('local:alice'));
    expect((await loadGame('local:restored'))!.profile.equipment.outfit).toBe(outfit);expect(projectGame((await loadGame('local:restored'))!).regions.atelier.stage).toBe(3);
  });
});

describe('output corrections and next actions',()=>{
  it('removes a project output with its source and equipment in one undoable transaction, preserving effort',async()=>{
    const data=fixture();data.activities.push(log(data));apply(data,completeProjectMutations(data,data.projects[0],at));const output=data.outputs[0];data.profile.equipment.emblem=projectGame(data).eligibleCosmetics[0];
    await initializeGame('local:alice',data);const mutations=outputChangeMutations(data,{...output,deleted:true});expect(changeImpact(data,mutations).after.xp).toBe(60);expect(changeImpact(data,mutations).after.regions.atelier.stage).toBe(0);
    const cmd=await commitMutations('local:alice',mutations);let stored=(await loadGame('local:alice'))!;expect(stored.projects[0].status).toBe('active');expect(stored.profile.equipment.emblem).toBe('');expect(creditedActivities(stored)[0].seconds).toBe(3600);
    await undoCommand('local:alice',cmd.id);stored=(await loadGame('local:alice'))!;expect(validOutputs(stored)[0].id).toBe(output.id);expect(stored.projects[0].status).toBe('completed');expect(stored.profile.equipment.emblem).toBe(data.profile.equipment.emblem);
  });
  it('reopens books on output removal and reuses their legacy output without losing custom annotations',()=>{
    const data=seedGame('demo');const book=data.books.find(b=>b.id==='book-prince')!;const old=data.outputs.find(o=>o.bookId===book.id)!;old.description='My corrected annotation';const id=old.id;
    apply(data,outputChangeMutations(data,{...old,deleted:true}));expect(data.books.find(b=>b.id===book.id)!.status).toBe('reading');
    apply(data,completeBookMutations(data,data.books.find(b=>b.id===book.id)!,at));expect(validOutputs(data).find(o=>o.bookId===book.id)?.id).toBe(id);expect(data.outputs.find(o=>o.id===id)!.description).toBe('My corrected annotation');
  });
  it('preserves historical book regions and supports maximum-length project criteria and labels',async()=>{
    const data=fixture();data.projects[0].objectives[0].title='Step '.repeat(75);data.projects[0].outputCriterion='Result '.repeat(90);data.activities.push(log(data));
    const edits=projectEditMutations(data,data.projects[0],at);expect(edits.filter(m=>m.kind==='quests').every(m=>(m.entity as Quest).title.length<=200)).toBe(true);
    await initializeGame('local:alice',data);await commitMutations('local:alice',edits);const current=(await loadGame('local:alice'))!;await commitMutations('local:alice',completeProjectMutations(current,current.projects[0],at));expect(validOutputs((await loadGame('local:alice'))!)[0].title.length).toBe(200);
    const books=seedGame('demo');const book=books.books[0];const old=books.outputs.find(o=>o.bookId===book.id)!;books.skills.find(s=>s.id===book.skillId)!.regionId='sanctuary';expect((completeBookMutations(books,book).find(m=>m.kind==='outputs')!.entity as typeof old).regionId).toBe(old.regionId);
  });
  it('creates a continuation quest once, updates notes independently, and undoes both together',async()=>{
    const data=fixture();const session={...base('focus'),skillId:'acoustic-guitar',projectId:'project',targetSeconds:1500,status:'completed' as const,segments:[{start:Date.parse(at)-1500000,end:Date.parse(at)}],confirmedSeconds:1500,continuationNote:'Start at bar eight'};data.focusSessions.push(session);await initializeGame('local:alice',data);
    const cmd=await commitMutations('local:alice',continuationMutations(data,session,'Start at bar nine',true,'Practice bar nine',at),'next-action');
    await commitMutations('local:alice',continuationMutations(data,session,'Start at bar nine',true,'Practice bar nine',at),'next-action');let saved=(await loadGame('local:alice'))!;expect(saved.quests).toHaveLength(1);expect(projectGame(saved).xp).toBe(0);
    const next=continuationMutations(saved,saved.focusSessions[0],'A new note',true,'Do not overwrite the task',at);expect(next).toHaveLength(1);
    await undoCommand('local:alice',cmd.id);saved=(await loadGame('local:alice'))!;expect(saved.quests.filter(q=>!q.deleted)).toEqual([]);expect(saved.focusSessions[0].continuationNote).toBe('Start at bar eight');
  });
  it('keeps archived projects out of newly converted continuation links',()=>{
    const data=fixture();data.projects[0].archived=true;const session={...base('focus'),skillId:'acoustic-guitar',projectId:'project',targetSeconds:60,status:'completed' as const,segments:[],confirmedSeconds:60};data.focusSessions.push(session);
    const next=continuationMutations(data,session,'One next step',true,'One next step',at);expect((next.find(m=>m.kind==='quests')!.entity as Quest).projectId).toBeUndefined();
  });
});

describe('scheduling and form restoration',()=>{
  it('checks concrete routine occurrences rather than treating the routine template as an unfinished subtask forever',()=>{
    const data=fixture();const parent=quest('parent');data.quests.push(parent,{...quest('routine'),recurrence:'daily',parentId:'parent'});
    expect(questStatusMutations(data,parent,'completed')).toHaveLength(1);
    apply(data,routineOccurrenceMutations(data,at));expect(()=>questStatusMutations(data,parent,'completed')).toThrow('subtasks');
    const occurrence=data.quests.find(q=>q.occurrenceOf==='routine')!;apply(data,questStatusMutations(data,occurrence,'skipped',at));
    expect(questStatusMutations(data,parent,'completed')).toHaveLength(1);
  });
  it('does not let later routine occurrences invalidate a completed project or rewrite occurrence history',()=>{
    const data=fixture();data.activities.push(log(data));apply(data,completeProjectMutations(data,data.projects[0],at));
    data.quests.push({...quest('legacy-routine'),recurrence:'daily',projectId:'project',objectiveId:'step',title:'Prepare the piece'});
    apply(data,routineOccurrenceMutations(data,at));const occurrence=data.quests.find(q=>q.occurrenceOf==='legacy-routine')!;
    apply(data,questStatusMutations(data,occurrence,'skipped',at));expect(data.projects[0].status).toBe('completed');expect(projectGame(data).regions.atelier.stage).toBe(1);
    const edited={...data.projects[0],objectives:data.projects[0].objectives.map(o=>({...o,title:'Renamed preparation'}))};
    apply(data,projectEditMutations(data,edited,at));expect(data.quests.find(q=>q.id===occurrence.id)!.title).toBe('Prepare the piece');expect(data.quests.find(q=>q.id===occurrence.id)!.status).toBe('skipped');
  });
  it('keeps a recurring occurrence’s identity after skipping, rescheduling and reopening without duplicate generation',()=>{
    const data=fixture();data.quests.push({...quest('routine'),recurrence:'daily'});apply(data,routineOccurrenceMutations(data,at));const occurrence=data.quests.find(q=>q.occurrenceOf==='routine')!;
    apply(data,questStatusMutations(data,occurrence,'skipped',at));let current=data.quests.find(q=>q.id===occurrence.id)!;expect(current.skippedAt).toBe(at);
    current=rescheduledQuest(current,'2026-11-20',at,'move-1');apply(data,[{kind:'quests',entity:current}]);expect(current.originalDueDate).toBe('2026-11-16');expect(current.id).toBe(occurrence.id);expect(routineOccurrenceMutations(data,at)).toEqual([]);
    apply(data,questStatusMutations(data,current,'pending',at));expect(data.quests.find(q=>q.id===occurrence.id)!.skippedAt).toBeUndefined();expect(projectGame(data).xp).toBe(0);
    expect(rescheduledQuest(current,undefined,at,'move-2').dueDate).toBeUndefined();expect(()=>rescheduledQuest(current,'2026-02-31')).toThrow('calendar');
  });
  it('uses confirmed calendar dates across midnight, time-zone changes, weekly cadence and paused templates',()=>{
    const data=fixture();data.quests.push({...quest('routine'),recurrence:'daily',dueDate:'2026-11-01'});
    const next='2026-11-16T19:00:00Z';expect(dayKey(next,data.profile.timeZone)).toBe('2026-11-17');expect((routineOccurrenceMutations(data,next)[0].entity as Quest).dueDate).toBe('2026-11-17');
    data.profile.timeZone='America/New_York';expect((routineOccurrenceMutations(data,next)[0].entity as Quest).dueDate).toBe('2026-11-16');
    data.quests[0].archived=true;expect(routineOccurrenceMutations(data,next)).toEqual([]);data.quests[0].archived=false;data.quests[0].recurrence='weekly';data.quests[0].dueDate='2026-11-16';expect(routineOccurrenceMutations(data,'2026-11-17T18:00:00Z')).toEqual([]);
  });
  it('rejects stale concurrent hierarchy changes atomically and does not lose either saved quest',async()=>{
    const data=fixture();data.quests.push(quest('a'),quest('b'));await initializeGame('local:alice',data);
    await commitMutations('local:alice',questEditMutations(data,{...data.quests[0],parentId:'b'}));
    await expect(commitMutations('local:alice',questEditMutations(data,{...data.quests[1],parentId:'a'}))).rejects.toThrow('cycle');
    const saved=(await loadGame('local:alice'))!;expect(saved.quests.find(q=>q.id==='a')!.parentId).toBe('b');expect(saved.quests.find(q=>q.id==='b')!.parentId).toBeUndefined();
  });
  it('resumes the correct forms and stable IDs, including imported IDs containing colons',()=>{
    const data=fixture();const draft=(name:string)=>({name,value:{},updatedAt:at});
    expect(draftDestination(draft('project:project:custom'),data)).toEqual({type:'project',id:'project:custom'});
    expect(draftDestination(draft('project:new:acoustic-guitar'),data)).toMatchObject({type:'project',skillId:'acoustic-guitar'});
    expect(draftDestination(draft('output:new:project:project'),data)).toMatchObject({type:'output',projectId:'project'});
    expect(draftDestination(draft('activity-v2:focus:focus'),data)).toMatchObject({type:'log',options:{focusSessionId:'focus'}});
    expect(draftDestination(draft('landmark-presentations-v1'),data)).toBeNull();
  });
});
