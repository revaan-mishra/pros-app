/** Optional recorded nature beds. Configuration never starts a source. */
export type AmbienceId = 'forest' | 'water';
export const AMBIENCE_FILES: Readonly<Record<AmbienceId, string>> = {
  forest: '/audio/ambience/forest.wav', water: '/audio/ambience/water.wav',
};
interface Voice { audio: HTMLAudioElement; removeError: () => void }
interface Bed {
  voices: Voice[]; stopped: boolean; error?: Error;
  abort: Promise<never>; rejectAbort: (error: Error) => void;
  deadlines: Set<ReturnType<typeof setTimeout>>;
  removeVisibility: () => void; playTask?: Promise<void>;
}
class CanceledAmbience extends Error {}
let selected: AmbienceId[] = [];
let current: Bed | null = null;
let volume = .15;
let published = false;
const stateListeners = new Set<(playing: boolean) => void>();
const errorListeners = new Set<(message: string) => void>();
const hidden = () => typeof document !== 'undefined' && document.hidden;
const bound = (value: number) => Number.isFinite(value) ? Math.max(0,Math.min(.5,value)) : .15;

function publish(playing: boolean) {
  if (published === playing) return; published = playing;
  for (const listener of [...stateListeners]) { try { listener(playing); } catch { /* Isolate presentation. */ } }
}
/** The state describes deliberate playback intent, including a background pause. */
export function subscribeAmbienceState(listener: (playing: boolean) => void): () => void {
  stateListeners.add(listener); try { listener(published); } catch { /* Isolate presentation. */ }
  return () => { stateListeners.delete(listener); };
}
/** Late network/media failures can be presented independently of saving records. */
export function subscribeAmbienceError(listener: (message: string) => void): () => void {
  errorListeners.add(listener); return () => { errorListeners.delete(listener); };
}
function applyVolume(bed: Bed) {
  const gain = volume / Math.sqrt(Math.max(1,bed.voices.length));
  for (const voice of bed.voices) voice.audio.volume = gain;
}
function dispose(bed: Bed) {
  if (bed.stopped) return; bed.stopped = true;
  bed.removeVisibility();
  for (const timer of bed.deadlines) clearTimeout(timer); bed.deadlines.clear();
  for (const voice of bed.voices) {
    voice.removeError();
    try { voice.audio.pause(); voice.audio.removeAttribute('src'); voice.audio.load(); } catch { /* Detached media is already released. */ }
  }
}
function fail(bed: Bed, error: Error) {
  if (current !== bed || bed.stopped) return;
  bed.error = error; current = null; bed.rejectAbort(error); dispose(bed); publish(false);
  for (const listener of [...errorListeners]) { try { listener(error.message); } catch { /* Audio must not affect records. */ } }
}
async function playVoice(bed: Bed, voice: Voice) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.resolve(voice.audio.play()).then(() => {
        // A browser can finish an old play request after its source was stopped.
        if (current !== bed || bed.stopped || hidden()) voice.audio.pause();
      }),
      bed.abort,
      new Promise<never>((_,reject) => {
        timer = setTimeout(() => reject(new Error('Ambience could not load. Check the recording and tap Play to retry.')),8000);
        bed.deadlines.add(timer);
      }),
    ]);
  } finally { if (timer) { clearTimeout(timer); bed.deadlines.delete(timer); } }
}
async function playBed(bed: Bed): Promise<void> {
  if (bed.playTask) return bed.playTask;
  if (hidden()) return;
  const task = Promise.all(bed.voices.map(voice=>playVoice(bed,voice))).then(()=>{});
  bed.playTask = task;
  try { await task; } finally { if (bed.playTask === task) bed.playTask = undefined; }
}

/** A changed selection stops its previous bed; tap Play to hear the new choice. */
export function setAmbienceLayers(ids: readonly AmbienceId[]): void {
  const next = [...new Set(ids.filter(id=>Object.hasOwn(AMBIENCE_FILES,id)))].slice(0,2);
  if (next.join('|') === selected.join('|')) return;
  selected = next; void stopAmbience();
}
export function setAmbienceVolume(value: number): void {
  volume = bound(value); if (current && !current.stopped) applyVolume(current);
}
/** Call only from an explicit playback gesture, never from navigation/profile effects. */
export async function startAmbience(requestedVolume = .15): Promise<void> {
  volume = bound(requestedVolume);
  if (!selected.length) throw new Error('Choose one or two ambience layers before pressing Play.');
  let bed = current;
  if (!bed || bed.stopped) {
    let rejectAbort!: (error: Error) => void;
    const abort = new Promise<never>((_,reject)=>{ rejectAbort=reject; });
    // A later media failure can happen after the initial Play promise has settled.
    void abort.catch(()=>{});
    bed = { voices:[], stopped:false, abort, rejectAbort, deadlines:new Set(), removeVisibility:()=>{} };
    current = bed;
    try {
      const owned = bed;
      for (const id of selected) {
        const audio = new Audio(); audio.crossOrigin='anonymous'; audio.src=AMBIENCE_FILES[id]; audio.loop=true; audio.preload='none';
        const failed=()=>fail(owned,new Error('An ambience recording became unavailable. Tap Play to retry; your work is saved separately.'));
        audio.addEventListener('error',failed);
        owned.voices.push({audio,removeError:()=>audio.removeEventListener('error',failed)});
      }
      const visibility=()=>{
        if (current!==owned || owned.stopped) return;
        if (hidden()) for(const voice of owned.voices)voice.audio.pause();
        else void playBed(owned).catch(error=>{if(!(error instanceof CanceledAmbience))fail(owned,error instanceof Error?error:new Error('Ambience needs a fresh Play gesture.'));});
      };
      if(typeof document!=='undefined'){
        document.addEventListener('visibilitychange',visibility);
        owned.removeVisibility=()=>document.removeEventListener('visibilitychange',visibility);
      }
    } catch(error) {
      const failure=error instanceof Error?error:new Error('Ambience is unavailable in this browser.');
      fail(bed,failure); throw failure;
    }
  }
  applyVolume(bed);
  try {
    await playBed(bed);
    if(current===bed && !bed.stopped)publish(true);
  } catch(error) {
    if(error instanceof CanceledAmbience)return;
    if(bed.error)throw bed.error;
    if(current!==bed || bed.stopped)return;
    const failure=error instanceof Error?error:new Error('Ambience could not start.'); fail(bed,failure); throw failure;
  }
}
/** Safe for silent practice, account switching and stop during a pending Play. */
export async function stopAmbience(): Promise<void> {
  const bed=current; current=null; publish(false);
  if(bed){bed.rejectAbort(new CanceledAmbience('Ambience stopped.'));dispose(bed);}
}
