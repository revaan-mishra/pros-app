import { z } from 'zod';
import type { AudioPreferences, GameData, Mutation, Profile, RegionId } from './types';
import type { InterfaceCue, SoundtrackTrack } from './soundtrack';
import type { AmbienceId } from './ambience';

export const audioPreferencesSchema = z.object({
  version:z.literal(1), preset:z.enum(['silent','quiet-focus','world','custom']),
  musicEnabled:z.boolean(), musicVolume:z.number().min(0).max(.5),
  musicChoice:z.enum(['regional','procedural','homestead','woodlands','fairy-lights']),
  ambienceEnabled:z.boolean(), ambienceVolume:z.number().min(0).max(.5),
  ambienceChoice:z.enum(['regional','forest','water','forest-water']),
  interfaceEnabled:z.boolean(), milestonesEnabled:z.boolean(),
}).strict();

export function audioFor(profile: Pick<Profile,'audio'|'sound'>): AudioPreferences {
  return profile.audio ? structuredClone(profile.audio) : {
    version:1,preset:profile.sound?'custom':'silent',musicEnabled:false,musicVolume:.18,musicChoice:'regional',
    ambienceEnabled:false,ambienceVolume:.12,ambienceChoice:'regional',interfaceEnabled:profile.sound,milestonesEnabled:profile.sound,
  };
}
export function audioPreset(preset: Exclude<AudioPreferences['preset'],'custom'>, current: AudioPreferences): AudioPreferences {
  const next={...current,preset};
  if(preset==='silent')return {...next,musicEnabled:false,ambienceEnabled:false,interfaceEnabled:false,milestonesEnabled:false};
  if(preset==='quiet-focus')return {...next,musicEnabled:true,musicVolume:.12,ambienceEnabled:false,interfaceEnabled:false,milestonesEnabled:false};
  return {...next,musicEnabled:true,musicVolume:.18,musicChoice:'regional',ambienceEnabled:true,ambienceVolume:.10,ambienceChoice:'regional',interfaceEnabled:true,milestonesEnabled:true};
}
export const REGIONAL_MUSIC: Record<RegionId,SoundtrackTrack> = {
  observatory:'fairy-lights',foundry:'procedural',atelier:'homestead',training:'woodlands',citadel:'homestead',sanctuary:'fairy-lights',
};
export function resolvedMusic(settings: AudioPreferences, region: RegionId | null): SoundtrackTrack {
  return settings.musicChoice==='regional' ? region ? REGIONAL_MUSIC[region] : 'procedural' : settings.musicChoice;
}
export function resolvedAmbience(settings: AudioPreferences, region: RegionId | null): AmbienceId[] {
  if(!settings.ambienceEnabled)return [];
  if(settings.ambienceChoice==='forest-water')return ['forest','water'];
  if(settings.ambienceChoice!=='regional')return [settings.ambienceChoice];
  if(region==='sanctuary')return ['forest','water'];
  return region==='foundry'||region==='atelier' ? ['water'] : ['forest'];
}

export type Feedback = InterfaceCue | 'milestone' | null;
// Ephemeral preview policy has no playback intent and never enters records/exports.
const previewPolicies=new Map<string,AudioPreferences>();
export function setFeedbackPreview(accountId:string,settings:AudioPreferences|null){if(settings)previewPolicies.set(accountId,structuredClone(settings));else previewPolicies.delete(accountId);}
export function feedbackPreview(accountId:string){return previewPolicies.get(accountId);}
/** One local acknowledgement for one committed command. Read-only/remote updates never call this. */
export function feedbackFor(before: GameData, after: GameData, mutations: Mutation[], freshLandmarks: number): Feedback {
  const prefs=audioFor(before.profile);
  if(after.profile.experience?.focusMode==='practice'&&mutations.some(m=>m.kind==='focusSessions'))return null;
  if(freshLandmarks>0&&prefs.milestonesEnabled)return 'milestone';
  if(!prefs.interfaceEnabled)return null;
  const source=(kind:Mutation['kind'],id:string)=>kind==='profile'?before.profile:before[kind].find(r=>r.id===id);
  for(const m of mutations)if(m.kind==='outputs'&&!m.entity.deleted&&(!source(m.kind,m.entity.id)||source(m.kind,m.entity.id)?.deleted))return 'output';
  for(const m of mutations)if(m.kind==='focusSessions'&&!m.entity.deleted&&'status' in m.entity){
    const old=before.focusSessions.find(s=>s.id===m.entity.id);
    if(!old&&m.entity.status==='running')return 'focus-start';
    if(old?.status==='running'&&m.entity.status==='paused')return 'focus-pause';
    if(old&&old.status!=='review'&&old.status!=='completed'&&['review','completed'].includes(m.entity.status))return 'focus-finish';
  }
  for(const m of mutations)if(m.kind==='quests'&&!m.entity.deleted&&'status' in m.entity&&m.entity.status==='completed'&&before.quests.find(q=>q.id===m.entity.id)?.status!=='completed')return 'quest';
  if(mutations.some(m=>m.kind==='profile')&&JSON.stringify(before.profile.experience?.keepsakeSlots)!==JSON.stringify(after.profile.experience?.keepsakeSlots))return 'keepsake';
  if(mutations.some(m=>['activities','outputs','journals','books','quests','projects'].includes(m.kind)))return 'save';
  return null;
}
