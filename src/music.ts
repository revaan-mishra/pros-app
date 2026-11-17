import type { SoundtrackTrack } from './soundtrack';

export const MUSIC_CACHE = 'pros-soundtracks-v1';
export const MUSIC = [
  { id: 'homestead', title: 'Homestead', by: 'troubadour', mood: 'A warm place to begin', file: '/audio/homestead.mp3', bytes: 3293101 },
  { id: 'woodlands', title: 'Wandering Woodlands', by: 'troubadour', mood: 'Room to wander and think', file: '/audio/wandering-woodlands.mp3', bytes: 3803448 },
  { id: 'fairy-lights', title: 'Fairy Lights', by: 'troubadour', mood: 'A little wonder after dusk', file: '/audio/fairy-lights.mp3', bytes: 3800642 },
  { id: 'procedural', title: 'A Place to Begin', by: 'PROS', mood: 'An original score that follows your region', file: null, bytes: 0 },
] as const;
export const MUSIC_SOURCE = 'https://opengameart.org/content/fantasy-song-pack-volume-1';
export function readMusicChoice(accountId: string): SoundtrackTrack {
  try { const value = localStorage.getItem(`pros.ui.${accountId}.music`); if (MUSIC.some(track => track.id === value)) return value as SoundtrackTrack; } catch { /* Optional display preference. */ }
  return 'homestead';
}
export function saveMusicChoice(accountId: string, value: SoundtrackTrack) {
  try { localStorage.setItem(`pros.ui.${accountId}.music`, value); } catch { /* Playback remains available in memory. */ }
}
export async function musicAvailableOffline(): Promise<boolean> {
  if (typeof caches === 'undefined') return false;
  const matches=await Promise.all(MUSIC.filter(t=>t.file).map(t=>mediaAvailableOffline(t.id)));
  return matches.every(Boolean);
}
/** Fetch full files deliberately. Media range requests alone cannot populate an offline cache. */
export async function saveMusicOffline(): Promise<void> {
  if (typeof caches === 'undefined') throw new Error('Offline music needs a secure browser address. The original score remains available.');
  const cache = await caches.open(MUSIC_CACHE);
  const requests = MUSIC.filter(t => t.file).map(t => new Request(t.file!, { cache: 'reload', credentials: 'same-origin' }));
  await cache.addAll(requests);
  if (!await musicAvailableOffline()) throw new Error('Music could not finish saving. Keep this window open and try again.');
}

export const AMBIENCE_CACHE = 'pros-ambience-v1';
export const AMBIENCE_MEDIA = [
  {id:'forest',title:'Forest',by:'SpritePilot',mood:'Birds and woodland air',file:'/audio/ambience/forest.wav',bytes:1267244},
  {id:'water',title:'River',by:'SpritePilot',mood:'Flowing water over rocks',file:'/audio/ambience/water.wav',bytes:1267244},
] as const;
export const OPTIONAL_MEDIA = [
  ...MUSIC.filter(t=>t.file!==null).map(t=>({...t,cache:MUSIC_CACHE})),
  ...AMBIENCE_MEDIA.map(t=>({...t,cache:AMBIENCE_CACHE})),
];
export type MediaId = typeof OPTIONAL_MEDIA[number]['id'];
function mediaItem(id: string) {
  const item=OPTIONAL_MEDIA.find(t=>t.id===id);
  if(!item?.file)throw new Error('Choose an available recording.');
  return item;
}
export async function mediaAvailableOffline(id: string): Promise<boolean> {
  if(typeof caches==='undefined')return false;
  const item=mediaItem(id),cache=await caches.open(item.cache),response=await cache.match(item.file!);
  if(response?.status!==200)return false;
  try{return (await response.clone().blob()).size===item.bytes;}catch{return false;}
}
export async function removeMediaOffline(id: string) {
  if(typeof caches==='undefined')throw new Error('Offline media storage is unavailable in this browser.');
  const item=mediaItem(id),cache=await caches.open(item.cache);await cache.delete(item.file!);
}
/** Download one complete verified-size file; a failed/aborted fetch never replaces its cache copy. */
export async function saveMediaOffline(id: string, progress?: (loaded: number,total: number)=>void, signal?: AbortSignal): Promise<void> {
  if(typeof caches==='undefined')throw new Error('Offline sound needs a secure browser address. The original score remains available.');
  const item=mediaItem(id);const response=await fetch(item.file!,{cache:'reload',credentials:'same-origin',signal});
  if(response.status!==200)throw new Error('A complete recording could not be downloaded. Try again while online.');
  const chunks:Uint8Array[]=[];let bytes=0;progress?.(0,item.bytes);
  const accept=(chunk:Uint8Array)=>{bytes+=chunk.byteLength;if(bytes>item.bytes)throw new Error('This recording differs from its expected download. No offline copy was replaced.');chunks.push(chunk);progress?.(bytes,item.bytes);};
  if(response.body){const reader=response.body.getReader();try{while(true){const next=await reader.read();if(next.done)break;accept(next.value);}}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}}
  else accept(new Uint8Array(await response.arrayBuffer()));
  if(signal?.aborted)throw new DOMException('Download canceled','AbortError');
  if(bytes!==item.bytes)throw new Error('The recording was incomplete. Retry the download; your existing files are preserved.');
  const cache=await caches.open(item.cache);const blob=new Blob(chunks as BlobPart[],{type:item.file!.endsWith('.wav')?'audio/wav':'audio/mpeg'});
  if(signal?.aborted)throw new DOMException('Download canceled','AbortError');
  await cache.put(item.file!,new Response(blob,{status:200,headers:{'Content-Type':blob.type,'Content-Length':String(bytes),'X-PROS-Offline':'saved'}}));
  if(!await mediaAvailableOffline(id))throw new Error('The browser did not retain this recording. Try again or remove other optional audio.');
}
