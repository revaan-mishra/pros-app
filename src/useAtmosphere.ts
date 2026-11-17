import { useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from './app-context';
import { audioFor, audioPreferencesSchema, resolvedAmbience, resolvedMusic, setFeedbackPreview } from './audio-preferences';
import { setSoundtrackRegion, setSoundtrackTrack, setSoundtrackVolume, startSoundtrack, stopSoundtrack, subscribeSoundtrackState, subscribeSoundtrackError } from './soundtrack';
import { setAmbienceLayers, setAmbienceVolume, startAmbience, stopAmbience, subscribeAmbienceState, subscribeAmbienceError } from './ambience';
import type { AudioPreferences, RegionId } from './types';

/** Restored preferences configure sources; only play() below can start a quiet channel. */
export function useAtmosphere(region: RegionId | null, silentPractice: boolean) {
  const { accountId, data, save, toast } = useGame();
  const restored=audioFor(data.profile);
  if(!data.profile.audio)try{const legacy=localStorage.getItem(`pros.ui.${accountId}.music`);if(legacy&&['procedural','homestead','woodlands','fairy-lights'].includes(legacy))restored.musicChoice=legacy as AudioPreferences['musicChoice'];}catch{}
  const signature=JSON.stringify(restored);
  const settings = useMemo(()=>JSON.parse(signature) as AudioPreferences,[signature]);
  const [musicPlaying,setMusicPlaying] = useState(false); const [ambiencePlaying,setAmbiencePlaying] = useState(false);
  const [ready,setReady] = useState(false); const [working,setWorking] = useState(false); const [error,setError] = useState('');
  const alive=useRef(true); const revision=useRef(0); const active=useRef(false);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;revision.current++;setFeedbackPreview(accountId,null);void stopSoundtrack();void stopAmbience();};},[accountId]);
  useEffect(()=>subscribeSoundtrackState(setMusicPlaying),[]);
  useEffect(()=>subscribeAmbienceState(setAmbiencePlaying),[]);
  useEffect(()=>subscribeSoundtrackError(message=>{setError(message);toast(message,true);}),[toast]);
  useEffect(()=>subscribeAmbienceError(message=>{setError(message);toast(message,true);}),[toast]);
  async function configure(next: AudioPreferences) {
    const token=++revision.current;
    setFeedbackPreview(accountId,next);
    setSoundtrackRegion(region);setSoundtrackVolume(next.musicVolume);setAmbienceVolume(next.ambienceVolume);
    setAmbienceLayers(resolvedAmbience(next,region));
    if(!next.musicEnabled||silentPractice)await stopSoundtrack();
    if(!next.ambienceEnabled||silentPractice)await stopAmbience();
    if(token!==revision.current||!alive.current)return false;
    const accepted=await setSoundtrackTrack(resolvedMusic(next,region));
    if(!accepted&&alive.current)setError('The selected music could not play. Choose another score or tap Play to retry.');
    return token===revision.current&&alive.current;
  }
  useEffect(()=>{let disposed=false;setReady(false);void configure(settings).then(()=>{if(!disposed)setReady(true);}).catch(e=>{if(!disposed){setReady(true);setError(e instanceof Error?e.message:'Sound choices could not be applied.');}});return()=>{disposed=true;};},[accountId,settings,region,silentPractice]);
  async function pause() { revision.current++;await Promise.all([stopSoundtrack(),stopAmbience()]); }
  async function play(next: AudioPreferences = settings) {
    if(active.current)return;
    if(silentPractice)throw new Error('Silent practice keeps music and ambience off. Choose Immersive or Minimal focus first.');
    if(!next.musicEnabled&&!next.ambienceEnabled)throw new Error('Choose a music or ambience channel before playing.');
    active.current=true;setWorking(true);setError('');
    try {
      audioPreferencesSchema.parse(next);if(!await configure(next))return;
      const requests:Promise<unknown>[]=[];
      if(next.musicEnabled)requests.push(startSoundtrack(next.musicVolume));
      if(next.ambienceEnabled)requests.push(startAmbience(next.ambienceVolume));
      const results=await Promise.allSettled(requests);const rejected=results.find(r=>r.status==='rejected');
      if(rejected?.status==='rejected')throw rejected.reason;
    } catch(e) { const message=e instanceof Error?e.message:'Sound could not start. Tap Play to retry.';if(alive.current)setError(message);throw e; }
    finally {active.current=false;if(alive.current)setWorking(false);}
  }
  async function saveSettings(next: AudioPreferences) {
    const checked=audioPreferencesSchema.parse(next);
    await save('profile',{...data.profile,audio:checked,sound:checked.interfaceEnabled||checked.milestonesEnabled},'Sound choices saved · playback remains under your control');
  }
  return { settings,musicPlaying,ambiencePlaying,playing:musicPlaying||ambiencePlaying,ready,working,error,play,pause,saveSettings,
    preview:(next:AudioPreferences)=>configure(next),
  };
}
