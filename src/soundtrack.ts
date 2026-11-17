import type { RegionId } from './types';

/** Original, local synthesis. Selecting a place never starts audio. */
type ScoreRegion = RegionId | 'neutral';
const CHORDS: Record<ScoreRegion, readonly number[]> = {
  neutral: [130.8128, 164.8138, 195.9977, 246.9417],
  observatory: [146.8324, 184.9972, 220, 277.1826],
  foundry: [110, 146.8324, 164.8138, 220],
  atelier: [138.5913, 174.6141, 207.6523, 261.6256],
  training: [130.8128, 174.6141, 195.9977, 220],
  citadel: [123.4708, 164.8138, 184.9972, 246.9417],
  sanctuary: [130.8128, 174.6141, 195.9977, 261.6256],
};
class CanceledPlayback extends Error {}
interface Cancellation { abort: Promise<never>; rejectAbort: (error: Error) => void }
function cancellation(): Cancellation {
  let rejectAbort!: (error: Error) => void;
  const abort = new Promise<never>((_, reject) => { rejectAbort = reject; });
  void abort.catch(() => {});
  return { abort, rejectAbort };
}
interface Score extends Cancellation {
  context: AudioContext;
  master: GainNode;
  drones: OscillatorNode[];
  nodes: Set<AudioNode>;
  oscillators: Set<OscillatorNode>;
  interval?: ReturnType<typeof setInterval>;
  removeVisibility?: () => void;
  closing: boolean;
}
export type SoundtrackTrack = 'procedural' | 'homestead' | 'woodlands' | 'fairy-lights';
const TRACK_FILES: Record<Exclude<SoundtrackTrack, 'procedural'>, string> = {
  homestead: '/audio/homestead.mp3', woodlands: '/audio/wandering-woodlands.mp3', 'fairy-lights': '/audio/fairy-lights.mp3',
};
interface Recording extends Cancellation { audio: HTMLAudioElement; removeListeners: () => void; closing: boolean; deadlines: Set<ReturnType<typeof setTimeout>>; playTask?: Promise<void> }
let selectedTrack: SoundtrackTrack = 'procedural';
let recording: Recording | null = null;
let playbackRequested = false;
let publishedPlaying = false;
const stateListeners = new Set<(playing: boolean) => void>();
const errorListeners = new Set<(message: string) => void>();
function publishError(message: string) { for (const listener of [...errorListeners]) { try { listener(message); } catch { /* Isolate audio diagnostics. */ } } }
export function subscribeSoundtrackError(listener: (message: string) => void): () => void { errorListeners.add(listener); return () => { errorListeners.delete(listener); }; }
function publishPlaying(playing: boolean): void {
  if (publishedPlaying === playing) return;
  publishedPlaying = playing;
  for (const listener of [...stateListeners]) { try { listener(playing); } catch { /* One view must not disrupt audio cleanup. */ } }
}
/** Reports opt-in playback state; background suspension keeps the existing intent. */
export function subscribeSoundtrackState(listener: (playing: boolean) => void): () => void {
  stateListeners.add(listener);
  try { listener(publishedPlaying); } catch { /* Listener errors are isolated. */ }
  return () => { stateListeners.delete(listener); };
}
let selectionRevision = 0;
let score: Score | null = null;
let starting: Promise<void> | null = null;
let generation = 0;
let region: ScoreRegion = 'neutral';
let volume = .22;
const cues = new Set<() => void>();
const boundedVolume = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(.5, value)) : .22;
const hidden = () => typeof document !== 'undefined' && document.hidden;
function audioContext(): AudioContext {
  const Constructor = globalThis.AudioContext ?? (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Constructor) throw new Error('Audio is not available in this browser.');
  return new Constructor();
}
async function resume(context: AudioContext, abort?: Promise<never>): Promise<void> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      context.resume(),
      ...(abort ? [abort] : []),
      new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('Audio needs a fresh tap to start.')), 1800); }),
    ]);
  } finally { if (timeout) clearTimeout(timeout); }
}
function own<T extends AudioNode>(state: Score, node: T): T { state.nodes.add(node); return node; }
function oscillator(state: Score): OscillatorNode {
  const node = own(state, state.context.createOscillator()); state.oscillators.add(node); return node;
}
async function dispose(state: Score): Promise<void> {
  if (state.closing) return;
  state.closing = true; state.rejectAbort(new CanceledPlayback('Audio stopped.'));
  if (state.interval) clearInterval(state.interval);
  state.removeVisibility?.();
  for (const voice of state.oscillators) { try { voice.stop(); } catch { /* already ended */ } }
  for (const node of state.nodes) { try { node.disconnect(); } catch { /* already disconnected */ } }
  state.nodes.clear(); state.oscillators.clear();
  try { if (state.context.state !== 'closed') await state.context.close(); } catch { /* Browser teardown must not affect saved work. */ }
}
function masterVolume(state: Score, seconds = .25) {
  const now = state.context.currentTime;
  state.master.gain.cancelScheduledValues(now);
  state.master.gain.setTargetAtTime(hidden() ? 0 : volume, now, seconds);
}

/** Explicit user action is required by callers. Concurrent taps share one source. */
export async function startSoundtrack(requestedVolume = .22): Promise<void> {
  playbackRequested = true;
  volume = boundedVolume(requestedVolume);
  const request = selectionRevision;
  try {
    if (selectedTrack !== 'procedural') await startRecording(selectedTrack);
    else await startProcedural(volume);
    if (playbackRequested && request === selectionRevision) publishPlaying(true);
  } catch (error) {
    if (error instanceof CanceledPlayback) return;
    if (request === selectionRevision) { playbackRequested = false; publishPlaying(false); await haltSources(); }
    throw error;
  }
}
async function startProcedural(requestedVolume: number): Promise<void> {
  volume = boundedVolume(requestedVolume);
  if (starting) return starting;
  if (score && !score.closing && score.context.state !== 'closed') {
    const existing = score;
    await resume(existing.context, existing.abort);
    if (score === existing && !existing.closing) masterVolume(existing);
    return;
  }
  const token = ++generation;
  const task = (async () => {
    let state: Score | null = null;
    try {
      const context = audioContext();
      const master = context.createGain();
      state = { ...cancellation(), context, master, drones: [], nodes: new Set([master]), oscillators: new Set(), closing: false };
      score = state;
      master.gain.value = 0; master.connect(context.destination);
      for (const [index, frequency] of CHORDS[region].entries()) {
        const voice = oscillator(state); const gain = own(state, context.createGain()); const filter = own(state, context.createBiquadFilter());
        voice.type = 'sine'; voice.frequency.value = frequency / 2;
        gain.gain.value = .09; filter.type = 'lowpass'; filter.frequency.value = 760;
        voice.connect(filter).connect(gain).connect(master); voice.start(); state.drones.push(voice);
        const shimmer = oscillator(state); const depth = own(state, context.createGain());
        shimmer.frequency.value = .038 + index * .009; depth.gain.value = .025;
        shimmer.connect(depth).connect(gain.gain); shimmer.start();
      }
      await resume(context, state.abort);
      if (token !== generation || score !== state || state.closing) { await dispose(state); return; }
      masterVolume(state, .9);
      let step = 0;
      const play = () => {
        if (!state || score !== state || state.closing || hidden() || context.state !== 'running') return;
        const chord = CHORDS[region]; const melody = [0, 1, 2, 3, 2, 1, 3, 1];
        const voice = oscillator(state); const gain = own(state, context.createGain()); const now = context.currentTime;
        voice.type = 'sine'; voice.frequency.value = chord[melody[step++ % melody.length]] * 2;
        gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(.075, now + .09); gain.gain.exponentialRampToValueAtTime(.0001, now + 4.8);
        voice.connect(gain).connect(master);
        voice.onended = () => { voice.disconnect(); gain.disconnect(); state?.oscillators.delete(voice); state?.nodes.delete(voice); state?.nodes.delete(gain); };
        voice.start(now); voice.stop(now + 4.9);
      };
      play(); state.interval = setInterval(play, 4200);
      if (typeof document !== 'undefined') {
        const current = state;
        const visibility = () => {
          if (score !== current || current.closing) return;
          masterVolume(current, .08);
          if (hidden()) void context.suspend().catch(() => {});
          else void resume(context, current.abort).then(() => { if (score === current && !current.closing) masterVolume(current, .4); }).catch(() => { if (score === current && !current.closing) void stopSoundtrack(); });
        };
        document.addEventListener('visibilitychange', visibility);
        state.removeVisibility = () => document.removeEventListener('visibilitychange', visibility);
        if (hidden()) visibility();
      }
    } catch (error) {
      if (state) { if (score === state) score = null; await dispose(state); }
      throw error;
    }
  })();
  starting = task;
  try { await task; } finally { if (starting === task) starting = null; }
}

async function playRecording(state: Recording): Promise<void> {
  if (state.playTask) return state.playTask;
  const task = (async () => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        Promise.resolve(state.audio.play()).then(() => {
          // Some browsers settle a queued play after its source was detached.
          if (recording !== state || state.closing || !playbackRequested || hidden()) state.audio.pause();
        }),
        state.abort,
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error('This track could not load. Try again when it is available.')), 8000);
          state.deadlines.add(timeout);
        }),
      ]);
    } finally { if (timeout) { clearTimeout(timeout); state.deadlines.delete(timeout); } }
  })();
  state.playTask = task;
  try { await task; } finally { if (state.playTask === task) state.playTask = undefined; }
}
function disposeRecording(state: Recording, reason: Error = new CanceledPlayback('Music stopped.')): void {
  if (state.closing) return;
  state.closing = true; state.rejectAbort(reason); state.removeListeners();
  for (const timeout of state.deadlines) clearTimeout(timeout); state.deadlines.clear();
  try { state.audio.pause(); state.audio.removeAttribute('src'); state.audio.load(); } catch { /* detached media is already released */ }
}
async function startRecording(track: Exclude<SoundtrackTrack, 'procedural'>): Promise<void> {
  if (starting) return starting;
  if (recording && !recording.closing) {
    recording.audio.volume = volume;
    if (!hidden()) await playRecording(recording);
    return;
  }
  const token = ++generation;
  const task = (async () => {
    let state: Recording | null = null;
    try {
      const audio = new Audio(); audio.crossOrigin = 'anonymous'; audio.src = TRACK_FILES[track]; audio.loop = true; audio.preload = 'none'; audio.volume = volume;
      state = { ...cancellation(), audio, removeListeners: () => {}, closing: false, deadlines: new Set() }; recording = state;
      const current = state;
      const visibility = () => {
        if (recording !== current || current.closing) return;
        if (hidden()) audio.pause();
        else if (playbackRequested) void playRecording(current).then(() => { if (recording !== current || current.closing || hidden()) audio.pause(); }).catch(() => { if (recording === current && !current.closing) void stopSoundtrack(); });
      };
      const failed = () => { const error = new Error('This music recording became unavailable. Tap Play to retry or choose another score.'); if (recording === current) { recording = null; playbackRequested = false; publishPlaying(false); publishError(error.message); } disposeRecording(current, error); };
      audio.addEventListener('error', failed);
      if (typeof document !== 'undefined') document.addEventListener('visibilitychange', visibility);
      state.removeListeners = () => { audio.removeEventListener('error', failed); if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', visibility); };
      if (!hidden()) await playRecording(state);
      if (token !== generation || recording !== state || state.closing || !playbackRequested) disposeRecording(state);
    } catch (error) {
      if (state) { if (recording === state) recording = null; disposeRecording(state); }
      throw error;
    }
  })();
  starting = task;
  try { await task; } finally { if (starting === task) starting = null; }
}
async function haltSources(): Promise<void> {
  generation++; const old = score; const oldRecording = recording; score = null; recording = null; starting = null;
  if (oldRecording) disposeRecording(oldRecording);
  for (const stop of [...cues]) stop();
  if (old) await dispose(old);
}
/** Safe on navigation/sign-out, including a stop while start is still pending. */
export async function stopSoundtrack(): Promise<void> {
  playbackRequested = false; publishPlaying(false); selectionRevision++; await haltSources();
}
/** Selection is silent while muted. Active playback switches only under existing user opt-in. */
export async function setSoundtrackTrack(track: SoundtrackTrack): Promise<boolean> {
  if (track !== 'procedural' && !Object.hasOwn(TRACK_FILES, track)) return false;
  if (track === selectedTrack) return true;
  const change = ++selectionRevision; selectedTrack = track;
  await haltSources();
  if (!playbackRequested || change !== selectionRevision) return true;
  try { await startSoundtrack(volume); return true; }
  catch { playbackRequested = false; publishPlaying(false); return false; }
}
export function setSoundtrackVolume(requestedVolume: number): void {
  volume = boundedVolume(requestedVolume);
  if (recording && !recording.closing) recording.audio.volume = volume;
  if (score && !score.closing && score.context.state !== 'closed') masterVolume(score);
}
export function setSoundtrackRegion(next: RegionId | null): void {
  region = next && Object.hasOwn(CHORDS, next) ? next : 'neutral';
  const current = score;
  if (!current || current.closing || current.context.state === 'closed') return;
  const now = current.context.currentTime;
  current.drones.forEach((voice, index) => { voice.frequency.cancelScheduledValues(now); voice.frequency.setTargetAtTime(CHORDS[region][index] / 2, now, 1.2); });
}

interface CueTone { frequency: number; amplitude: number; start: number; duration: number; type?: OscillatorType; endFrequency?: number }
async function playCue(tones: CueTone[], lifetime: number): Promise<void> {
  // A simultaneous save/quest/world change is one cue, never a stack of chimes.
  for (const stop of [...cues]) stop();
  if (hidden()) return;
  let context: AudioContext | null = null; const voices: OscillatorNode[] = []; const nodes: AudioNode[] = [];
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let stopped = false; const cancel = cancellation();
  const stop = () => {
    if (stopped) return; stopped = true; cancel.rejectAbort(new CanceledPlayback('Cue stopped.'));
    if (timeout) clearTimeout(timeout); cues.delete(stop);
    for (const voice of voices) { try { voice.stop(); } catch { /* ended */ } }
    for (const node of nodes) { try { node.disconnect(); } catch { /* disposed */ } }
    if (context && context.state !== 'closed') void context.close().catch(() => {});
  };
  try {
    context = audioContext(); cues.add(stop);
    // This deadline also closes contexts whose resume promise never resolves.
    timeout = setTimeout(stop, lifetime + 1900);
    await resume(context, cancel.abort);
    if (stopped || context.state !== 'running' || hidden()) { stop(); return; }
    clearTimeout(timeout); timeout = setTimeout(stop, lifetime);
    const now = context.currentTime;
    for (const tone of tones) {
      const voice = context.createOscillator(); const gain = context.createGain(); voices.push(voice); nodes.push(voice, gain);
      const start = now + tone.start; voice.type = tone.type || 'sine'; voice.frequency.setValueAtTime(tone.frequency, start);
      if (tone.endFrequency) voice.frequency.exponentialRampToValueAtTime(tone.endFrequency, start + Math.min(.12, tone.duration));
      gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(tone.amplitude, start + .02); gain.gain.exponentialRampToValueAtTime(.0001, start + tone.duration);
      voice.connect(gain).connect(context.destination); voice.start(start); voice.stop(start + tone.duration + .05);
    }
  } catch { stop(); }
}
/** Soft bronze acknowledgement. Call only after an accepted local write and opt-in. */
export async function playCompletionCue(): Promise<void> {
  await playCue([
    { frequency: 528, amplitude: .035, start: 0, duration: 1.5 },
    { frequency: 792, amplitude: .019, start: 0, duration: 1.1 },
    { frequency: 1056, amplitude: .01, start: 0, duration: .85 },
  ], 1700);
}
/** Lantern ignition, for a successfully started focus session with sound enabled. */
export async function playFocusIgnitionCue(): Promise<void> {
  await playCue([
    { frequency: 880, endFrequency: 220, amplitude: .026, start: 0, duration: .15, type: 'triangle' },
    { frequency: 261.6256, amplitude: .026, start: .08, duration: 1.1 },
  ], 1350);
}

export type InterfaceCue = 'save' | 'quest' | 'output' | 'keepsake' | 'focus-start' | 'focus-pause' | 'focus-finish' | 'sheet';
/** Restrained material acknowledgements. Call after a successful local action and opt-in. */
export async function playInterfaceCue(kind: InterfaceCue): Promise<void> {
  const patterns: Record<Exclude<InterfaceCue,'focus-start'>,{tones:CueTone[];lifetime:number}> = {
    save:{tones:[{frequency:420,endFrequency:280,amplitude:.015,start:0,duration:.09,type:'triangle'}],lifetime:160},
    quest:{tones:[{frequency:392,amplitude:.018,start:0,duration:.2},{frequency:523.25,amplitude:.014,start:.08,duration:.24}],lifetime:400},
    output:{tones:[{frequency:440,amplitude:.021,start:0,duration:.38},{frequency:659.25,amplitude:.014,start:.09,duration:.48}],lifetime:650},
    keepsake:{tones:[{frequency:329.63,amplitude:.019,start:0,duration:.3},{frequency:493.88,amplitude:.012,start:.04,duration:.42}],lifetime:550},
    'focus-pause':{tones:[{frequency:392,endFrequency:261.63,amplitude:.016,start:0,duration:.2}],lifetime:300},
    'focus-finish':{tones:[{frequency:261.63,amplitude:.021,start:0,duration:.45},{frequency:392,amplitude:.014,start:.1,duration:.5}],lifetime:720},
    sheet:{tones:[{frequency:180,endFrequency:260,amplitude:.008,start:0,duration:.065,type:'triangle'}],lifetime:130},
  };
  if(kind==='focus-start')return playFocusIgnitionCue();
  const pattern=patterns[kind]; if(pattern)await playCue(pattern.tones,pattern.lifetime);
}
/** One combined major unlock cue, regardless of how many thresholds were crossed. */
export async function playMilestoneCue(): Promise<void> { await playCompletionCue(); }
