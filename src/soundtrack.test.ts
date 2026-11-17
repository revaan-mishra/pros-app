import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

class Param {
  value = 0;
  targets: number[] = [];
  setValueAtTime(value: number) { this.value = value; return this; }
  linearRampToValueAtTime(value: number) { this.value = value; return this; }
  exponentialRampToValueAtTime(value: number) { this.value = value; return this; }
  setTargetAtTime(value: number) { this.targets.push(value); this.value = value; return this; }
  cancelScheduledValues() { return this; }
}
class Node {
  disconnect = vi.fn();
  connect(next: unknown) { return next; }
}
class Gain extends Node { gain = new Param(); }
class Tone extends Node {
  frequency = new Param(); type = 'sine'; onended: (() => void) | null = null;
  start = vi.fn(); stop = vi.fn();
}
class Filter extends Node { frequency = new Param(); type = 'lowpass'; }
class FakeContext {
  static instances: FakeContext[] = [];
  static resumeGate: Promise<void> | null = null;
  state = 'suspended'; currentTime = 10; destination = new Node();
  tones: Tone[] = []; gains: Gain[] = [];
  constructor() { FakeContext.instances.push(this); }
  createGain() { const gain = new Gain(); this.gains.push(gain); return gain; }
  createOscillator() { const tone = new Tone(); this.tones.push(tone); return tone; }
  createBiquadFilter() { return new Filter(); }
  resume = vi.fn(async () => { if (FakeContext.resumeGate) await FakeContext.resumeGate; if (this.state !== 'closed') this.state = 'running'; });
  suspend = vi.fn(async () => { this.state = 'suspended'; });
  close = vi.fn(async () => { this.state = 'closed'; });
}
class FakeRecording extends EventTarget {
  static instances: FakeRecording[] = [];
  static failNext = false;
  static playGate: Promise<void> | null = null;
  src: string; crossOrigin = ''; loop = false; preload = ''; volume = 1; paused = true;
  constructor(src = '') { super(); this.src = src; FakeRecording.instances.push(this); }
  play = vi.fn(async () => { if (FakeRecording.playGate) await FakeRecording.playGate; if (FakeRecording.failNext) { FakeRecording.failNext = false; throw new Error('Missing track'); } this.paused = false; });
  pause = vi.fn(() => { this.paused = true; });
  removeAttribute = vi.fn((name: string) => { if (name === 'src') this.src = ''; });
  load = vi.fn();
}
let audio: typeof import('./soundtrack');
let page: EventTarget & { hidden: boolean };
beforeEach(async () => {
  vi.resetModules(); vi.useFakeTimers(); FakeContext.instances = []; FakeContext.resumeGate = null;
  FakeRecording.instances = []; FakeRecording.failNext = false; FakeRecording.playGate = null; vi.stubGlobal('Audio', FakeRecording);
  page = Object.assign(new EventTarget(), { hidden: false });
  vi.stubGlobal('document', page); vi.stubGlobal('AudioContext', FakeContext);
  audio = await import('./soundtrack');
});
afterEach(async () => { await audio.stopSoundtrack(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('user-controlled audio lifecycle', () => {
  it('region selection stays silent; concurrent starts share one context and region changes reuse it', async () => {
    audio.setSoundtrackRegion('foundry');
    expect(FakeContext.instances).toHaveLength(0);
    await Promise.all([audio.startSoundtrack(.2), audio.startSoundtrack(.3)]);
    const context = FakeContext.instances[0];
    const initial = context.tones.slice(0, 8).filter((_, index) => index % 2 === 0).map(tone => tone.frequency.value);
    audio.setSoundtrackRegion('observatory');
    const moved = context.tones.slice(0, 8).filter((_, index) => index % 2 === 0).map(tone => tone.frequency.value);
    expect(FakeContext.instances).toHaveLength(1);
    expect(moved).not.toEqual(initial);
    expect(context.close).not.toHaveBeenCalled();
  });
  it('retunes each of the six places and rejects unsafe volume values', async () => {
    await audio.startSoundtrack(); const context = FakeContext.instances[0];
    const firstDrone = context.tones[0];
    for (const region of ['observatory', 'foundry', 'atelier', 'training', 'citadel', 'sanctuary'] as const) audio.setSoundtrackRegion(region);
    expect(firstDrone.frequency.targets).toHaveLength(6);
    expect(firstDrone.frequency.targets.every(Number.isFinite)).toBe(true);
    audio.setSoundtrackVolume(8); expect(context.gains[0].gain.value).toBe(.5);
    audio.setSoundtrackVolume(-3); expect(context.gains[0].gain.value).toBe(0);
    audio.setSoundtrackVolume(Number.NaN); expect(Number.isFinite(context.gains[0].gain.value)).toBe(true);
  });
  it('stop cancels pending startup without leaving oscillators, contexts, or timers alive', async () => {
    let release!: () => void;
    FakeContext.resumeGate = new Promise<void>(resolve => { release = resolve; });
    const pending = audio.startSoundtrack(); const context = FakeContext.instances[0];
    await audio.stopSoundtrack(); release(); await pending;
    expect(context.close).toHaveBeenCalledTimes(1);
    expect(context.tones.every(tone => tone.stop.mock.calls.length === 1 && tone.disconnect.mock.calls.length === 1)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('suppresses hidden-page notes and resumes without replaying a backlog', async () => {
    await audio.startSoundtrack(); const context = FakeContext.instances[0]; const count = context.tones.length;
    page.hidden = true; page.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(context.tones).toHaveLength(count);
    expect(context.suspend).toHaveBeenCalledTimes(1);
    page.hidden = false; page.dispatchEvent(new Event('visibilitychange')); await Promise.resolve(); await Promise.resolve();
    expect(context.tones).toHaveLength(count);
    await vi.advanceTimersByTimeAsync(4200);
    expect(context.tones.length - count).toBeLessThanOrEqual(1);
  });
  it('one-shot cues close their audio resources and remain harmless when audio is unavailable', async () => {
    await audio.playCompletionCue(); await audio.playFocusIgnitionCue();
    await vi.advanceTimersByTimeAsync(2000);
    expect(FakeContext.instances).toHaveLength(2);
    expect(FakeContext.instances.every(context => context.state === 'closed')).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    vi.stubGlobal('AudioContext', undefined);
    await expect(audio.playCompletionCue()).resolves.toBeUndefined();
    await expect(audio.playFocusIgnitionCue()).resolves.toBeUndefined();
  });
  it('a rejected browser resume releases resources and leaves the next explicit attempt usable', async () => {
    FakeContext.resumeGate = Promise.reject(new Error('Gesture required'));
    await expect(audio.startSoundtrack()).rejects.toThrow('Gesture required');
    expect(FakeContext.instances[0].state).toBe('closed'); expect(vi.getTimerCount()).toBe(0);
    FakeContext.resumeGate = null;
    await audio.startSoundtrack(); expect(FakeContext.instances).toHaveLength(2);
    expect(FakeContext.instances[1].state).toBe('running');
  });
  it('recorded-track selection is silent while muted and releases the old source on a live switch', async () => {
    await audio.setSoundtrackTrack('homestead');
    expect(FakeRecording.instances).toHaveLength(0);
    await audio.startSoundtrack(.18); const first = FakeRecording.instances[0];
    expect(first.src).toBe('/audio/homestead.mp3'); expect(first.loop).toBe(true); expect(first.volume).toBe(.18);
    await audio.setSoundtrackTrack('woodlands');
    expect(first.paused).toBe(true); expect(first.src).toBe(''); expect(first.load).toHaveBeenCalledTimes(1);
    expect(FakeRecording.instances[1].src).toBe('/audio/wandering-woodlands.mp3');
    await audio.stopSoundtrack();
    await audio.setSoundtrackTrack('fairy-lights'); expect(FakeRecording.instances).toHaveLength(2);
  });
  it('a failed recorded track does not silently start another selection', async () => {
    await audio.setSoundtrackTrack('homestead'); FakeRecording.failNext = true;
    await expect(audio.startSoundtrack()).rejects.toThrow('Missing track');
    expect(FakeRecording.instances[0].src).toBe('');
    await audio.setSoundtrackTrack('woodlands'); expect(FakeRecording.instances).toHaveLength(1);
    await audio.startSoundtrack(); expect(FakeRecording.instances).toHaveLength(2);
  });
  it('recorded audio pauses in the background and never resumes after an explicit stop', async () => {
    await audio.setSoundtrackTrack('fairy-lights'); await audio.startSoundtrack(); const recording = FakeRecording.instances[0];
    page.hidden = true; page.dispatchEvent(new Event('visibilitychange')); expect(recording.paused).toBe(true);
    page.hidden = false; page.dispatchEvent(new Event('visibilitychange')); await Promise.resolve(); expect(recording.paused).toBe(false);
    const plays = recording.play.mock.calls.length;
    await audio.stopSoundtrack(); page.dispatchEvent(new Event('visibilitychange')); expect(recording.play).toHaveBeenCalledTimes(plays);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('publishes a later media failure and detaches unsubscribed views', async () => {
    const states: boolean[] = []; const unsubscribe = audio.subscribeSoundtrackState(playing => states.push(playing));
    await audio.setSoundtrackTrack('homestead'); await audio.startSoundtrack();
    const recording = FakeRecording.instances[0]; expect(recording.crossOrigin).toBe('anonymous');
    recording.dispatchEvent(new Event('error'));
    expect(states).toEqual([false, true, false]); expect(recording.src).toBe('');
    unsubscribe(); await audio.startSoundtrack(); await audio.stopSoundtrack();
    expect(states).toEqual([false, true, false]);
  });
  it('keeps active track switches steady but reports a failed background resume as stopped', async () => {
    const states: boolean[] = []; const unsubscribe = audio.subscribeSoundtrackState(playing => states.push(playing));
    await audio.setSoundtrackTrack('homestead'); await audio.startSoundtrack(); await audio.setSoundtrackTrack('woodlands');
    expect(states).toEqual([false, true]);
    page.hidden = true; page.dispatchEvent(new Event('visibilitychange'));
    FakeRecording.failNext = true; page.hidden = false; page.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(1);
    expect(states).toEqual([false, true, false]); unsubscribe();
  });

  it('coalesces overlapping feedback into one cue group and releases the previous group', async () => {
    await audio.playInterfaceCue('save'); const first=FakeContext.instances[0];
    await audio.playMilestoneCue(); const second=FakeContext.instances[1];
    expect(first.state).toBe('closed'); expect(second.state).toBe('running');
    expect(FakeContext.instances.filter(context=>context.state!=='closed')).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(2000);
    expect(second.state).toBe('closed'); expect(vi.getTimerCount()).toBe(0);
  });

  it('all interface cues remain bounded and unavailable audio never changes action success', async () => {
    for(const cue of ['save','quest','output','keepsake','focus-start','focus-pause','focus-finish','sheet'] as const)await audio.playInterfaceCue(cue);
    expect(FakeContext.instances.filter(context=>context.state!=='closed')).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(2000);expect(FakeContext.instances.every(context=>context.state==='closed')).toBe(true);
    vi.stubGlobal('AudioContext',undefined);
    await expect(audio.playInterfaceCue('output')).resolves.toBeUndefined();await expect(audio.playMilestoneCue()).resolves.toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancels a stalled recording immediately and a late browser resolution cannot revive it or stop its replacement', async () => {
    let release!: () => void;
    FakeRecording.playGate = new Promise<void>(resolve => { release = resolve; });
    const states: boolean[] = []; audio.subscribeSoundtrackState(v => states.push(v));
    await audio.setSoundtrackTrack('homestead'); const pending = audio.startSoundtrack();
    const old = FakeRecording.instances[0]; expect(vi.getTimerCount()).toBe(1);
    await audio.stopSoundtrack(); await expect(pending).resolves.toBeUndefined();
    expect(vi.getTimerCount()).toBe(0); expect(old.src).toBe('');
    FakeRecording.playGate = null; await audio.setSoundtrackTrack('woodlands'); await audio.startSoundtrack();
    const replacement = FakeRecording.instances[1]; expect(replacement.paused).toBe(false);
    release(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(old.paused).toBe(true); expect(old.load).toHaveBeenCalledTimes(1);
    expect(replacement.paused).toBe(false); expect(states).toEqual([false, true]);
  });

  it('stop releases a never-resolving procedural startup without waiting for a timeout', async () => {
    FakeContext.resumeGate = new Promise<void>(() => {});
    const pending = audio.startSoundtrack(); expect(vi.getTimerCount()).toBe(1);
    await audio.stopSoundtrack(); await expect(pending).resolves.toBeUndefined();
    expect(vi.getTimerCount()).toBe(0); expect(FakeContext.instances[0].state).toBe('closed');
  });

  it('media errors abort pending music and publish an independent diagnostic', async () => {
    FakeRecording.playGate = new Promise<void>(() => {});
    const errors: string[] = []; const unsubscribe = audio.subscribeSoundtrackError(e => errors.push(e));
    await audio.setSoundtrackTrack('homestead');
    const result = expect(audio.startSoundtrack()).rejects.toThrow('became unavailable');
    FakeRecording.instances[0].dispatchEvent(new Event('error')); await result;
    expect(errors).toHaveLength(1); expect(vi.getTimerCount()).toBe(0); expect(FakeRecording.instances[0].src).toBe('');
    unsubscribe(); FakeRecording.instances[0].dispatchEvent(new Event('error')); expect(errors).toHaveLength(1);
  });

  it('preempting a pending cue cancels its resume deadline while preserving the replacement cue', async () => {
    FakeContext.resumeGate = new Promise<void>(() => {});
    const pending = audio.playInterfaceCue('save');
    FakeContext.resumeGate = null; await audio.playMilestoneCue(); await pending;
    expect(FakeContext.instances[0].state).toBe('closed');
    expect(FakeContext.instances[1].state).toBe('running'); expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(2000); expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects inherited source keys instead of treating them as tracks or chord palettes', async () => {
    expect(await audio.setSoundtrackTrack('constructor' as 'homestead')).toBe(false);
    expect(await audio.setSoundtrackTrack('__proto__' as 'homestead')).toBe(false);
    audio.setSoundtrackRegion('constructor' as 'foundry');
    await audio.startSoundtrack(); expect(FakeRecording.instances).toHaveLength(0);
    expect(FakeContext.instances[0].tones.every(tone => Number.isFinite(tone.frequency.value))).toBe(true);
  });

});
