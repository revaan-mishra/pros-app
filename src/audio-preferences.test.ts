import 'fake-indexeddb/auto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { audioFor, audioPreset, audioPreferencesSchema, feedbackFor, resolvedAmbience, resolvedMusic } from './audio-preferences';
import { seedGame } from './domain';
import { REGIONS } from './catalog';
import { commitMutations, db, exportBackup, importBackup, initializeGame, listSnapshots, loadGame, undoCommand, validateBackup } from './storage';
import type { Mutation } from './types';

beforeEach(async()=>{if(!db.isOpen())await db.open();for(const table of db.tables)await table.clear();});
afterAll(()=>db.close());
describe('independent and portable sound choices',()=>{
  it('opens silent, keeps legacy feedback opt-in, and does not mutate its profile',()=>{
    const data=seedGame('empty');const original=structuredClone(data.profile);const p=audioFor(data.profile);
    expect([p.musicEnabled,p.ambienceEnabled,p.interfaceEnabled,p.milestonesEnabled]).toEqual([false,false,false,false]);
    expect(audioFor({...data.profile,sound:true}).interfaceEnabled).toBe(true);p.musicEnabled=true;expect(data.profile).toEqual(original);
  });
  it('provides three complete presets and at most two regional nature layers',()=>{
    const data=seedGame('empty');const p=audioFor(data.profile),world=audioPreset('world',p);
    expect(audioPreset('silent',world)).toMatchObject({musicEnabled:false,ambienceEnabled:false,interfaceEnabled:false,milestonesEnabled:false});
    expect(audioPreset('quiet-focus',world)).toMatchObject({musicEnabled:true,ambienceEnabled:false,interfaceEnabled:false,milestonesEnabled:false});
    for(const r of REGIONS){expect(resolvedMusic(world,r.id)).toBeTruthy();expect(resolvedAmbience(world,r.id).length).toBeLessThanOrEqual(2);}
    expect(resolvedAmbience(world,'sanctuary')).toEqual(['forest','water']);expect(p.musicEnabled).toBe(false);
  });
  it('snapshots the first sound-contract write and round-trips choices through backup and Undo',async()=>{
    const data=seedGame('empty');await initializeGame('local:owner',data);const before=(await listSnapshots('local:owner')).length;
    const next={...data.profile,audio:audioPreset('world',audioFor(data.profile))};
    const command=await commitMutations('local:owner',[{kind:'profile',entity:next}]);
    expect((await listSnapshots('local:owner')).length).toBe(before+1);
    const backup=await exportBackup('local:owner');expect(validateBackup(backup).data.profile.audio).toEqual(next.audio);
    await importBackup('local:restored',backup);expect((await loadGame('local:restored'))!.profile.audio).toEqual(next.audio);
    await undoCommand('local:owner',command.id);expect((await loadGame('local:owner'))!.profile.audio).toBeUndefined();
    expect((await loadGame('local:restored'))!.profile.audio).toEqual(next.audio);
  });
  it('accepts old records but rejects unknown channels and invalid sound ranges',()=>{
    const data=seedGame('empty'),p=audioFor(data.profile);expect(audioPreferencesSchema.safeParse(p).success).toBe(true);
    expect(audioPreferencesSchema.safeParse({...p,musicVolume:1}).success).toBe(false);
    expect(audioPreferencesSchema.safeParse({...p,apiKey:'secret'}).success).toBe(false);
    expect(audioPreferencesSchema.safeParse({...p,ambienceChoice:'an-unbounded-playlist'}).success).toBe(false);
  });
});
describe('one feedback result per committed command',()=>{
  it('chooses a combined milestone before ordinary feedback and respects independent controls',()=>{
    const before=seedGame('empty');before.profile.audio=audioPreset('world',audioFor(before.profile));const after=structuredClone(before);
    const output={id:'o',revision:0,createdAt:'2026-11-17T00:00:00Z',updatedAt:'2026-11-17T00:00:00Z',title:'Finished',description:'',skillId:'frontend',regionId:'foundry' as const,confirmedAt:'2026-11-17T00:00:00Z'};
    const mutations:Mutation[]=[{kind:'outputs',entity:output}];after.outputs.push(output);
    expect(feedbackFor(before,after,mutations,4)).toBe('milestone');before.profile.audio.milestonesEnabled=false;expect(feedbackFor(before,after,mutations,4)).toBe('output');
    before.profile.audio.interfaceEnabled=false;expect(feedbackFor(before,after,mutations,4)).toBeNull();
  });
  it('does not celebrate view/preferences changes or add sound to silent-practice confirmation',()=>{
    const before=seedGame('empty');before.profile.audio=audioPreset('world',audioFor(before.profile));const after=structuredClone(before);
    expect(feedbackFor(before,after,[{kind:'profile',entity:after.profile}],0)).toBeNull();
    after.profile.experience={version:1,dismissedProjectIds:[],keepsakeSlots:[null,null,null,null,null,null],focusMode:'practice',focusMinutes:25};
    const session={id:'s',revision:0,createdAt:'2026-11-17T00:00:00Z',updatedAt:'2026-11-17T00:00:00Z',skillId:'frontend',status:'completed' as const,targetSeconds:60,segments:[]};
    expect(feedbackFor(before,after,[{kind:'focusSessions',entity:session}],3)).toBeNull();
  });
});

import { feedbackPreview,setFeedbackPreview } from './audio-preferences';
it('keeps temporary sound previews account-scoped and clears them without altering saved records',()=>{
  const data=seedGame('empty'),silent=audioPreset('silent',audioFor(data.profile));
  setFeedbackPreview('local:one',silent);expect(feedbackPreview('local:one')).toEqual(silent);expect(feedbackPreview('local:two')).toBeUndefined();
  silent.interfaceEnabled=true;expect(feedbackPreview('local:one')?.interfaceEnabled).toBe(false);
  setFeedbackPreview('local:one',null);expect(feedbackPreview('local:one')).toBeUndefined();expect(data.profile.audio).toBeUndefined();
});
