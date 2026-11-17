import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

class Recording extends EventTarget {
  static instances: Recording[]=[];
  static gate: Promise<void>|null=null;
  static fail: string|null=null;
  src='';crossOrigin='';loop=false;preload='';volume=1;paused=true;
  constructor(){super();Recording.instances.push(this);}
  play=vi.fn(async()=>{
    if(Recording.gate)await Recording.gate;
    if(Recording.fail && this.src.includes(Recording.fail))throw new Error('Recording unavailable');
    this.paused=false;
  });
  pause=vi.fn(()=>{this.paused=true;});
  removeAttribute=vi.fn((name:string)=>{if(name==='src')this.src='';});
  load=vi.fn();
}
let ambience:typeof import('./ambience');
let page:EventTarget & {hidden:boolean};
beforeEach(async()=>{
  vi.resetModules();vi.useFakeTimers();Recording.instances=[];Recording.gate=null;Recording.fail=null;
  page=Object.assign(new EventTarget(),{hidden:false});vi.stubGlobal('document',page);vi.stubGlobal('Audio',Recording);
  ambience=await import('./ambience');
});
afterEach(async()=>{await ambience.stopAmbience();vi.useRealTimers();vi.unstubAllGlobals();vi.restoreAllMocks();});

describe('deliberate bounded ambience playback',()=>{
  it('stays silent when selecting and requires an explicit start for at most two unique beds',async()=>{
    await expect(ambience.startAmbience()).rejects.toThrow('Choose one or two');
    ambience.setAmbienceLayers(['forest','water','forest']);expect(Recording.instances).toHaveLength(0);
    await Promise.all([ambience.startAmbience(.2),ambience.startAmbience(.3)]);
    expect(Recording.instances).toHaveLength(2);
    expect(Recording.instances.map(a=>a.src)).toEqual(['/audio/ambience/forest.wav','/audio/ambience/water.wav']);
    for(const source of Recording.instances){expect(source.loop).toBe(true);expect(source.preload).toBe('none');expect(source.play).toHaveBeenCalledTimes(1);expect(source.volume).toBeCloseTo(.3/Math.sqrt(2));}
    expect(vi.getTimerCount()).toBe(0);
  });
  it('a changed selection releases old media and never auto-starts the new selection',async()=>{
    const states:boolean[]=[];const unsub=ambience.subscribeAmbienceState(value=>states.push(value));
    ambience.setAmbienceLayers(['forest']);await ambience.startAmbience();const first=Recording.instances[0];
    ambience.setAmbienceLayers(['water']);expect(states).toEqual([false,true,false]);expect(first.src).toBe('');expect(first.paused).toBe(true);
    expect(first.load).toHaveBeenCalledTimes(1);expect(Recording.instances).toHaveLength(1);
    await ambience.startAmbience();expect(Recording.instances[1].src).toBe('/audio/ambience/water.wav');
    unsub();await ambience.stopAmbience();expect(states).toEqual([false,true,false,true]);
  });
  it('stop cancels pending starts and an eventual browser play resolution cannot revive them',async()=>{
    let release!:()=>void;Recording.gate=new Promise<void>(resolve=>{release=resolve;});
    ambience.setAmbienceLayers(['forest','water']);const pending=ambience.startAmbience();
    expect(vi.getTimerCount()).toBe(2);await ambience.stopAmbience();await pending;
    expect(vi.getTimerCount()).toBe(0);release();await Promise.resolve();await Promise.resolve();await Promise.resolve();
    for(const source of Recording.instances){expect(source.paused).toBe(true);expect(source.src).toBe('');expect(source.load).toHaveBeenCalledTimes(1);}
  });
  it('pauses both beds while hidden, resumes only existing opt-in, and stops permanently on sign-out',async()=>{
    ambience.setAmbienceLayers(['forest','water']);await ambience.startAmbience();
    page.hidden=true;page.dispatchEvent(new Event('visibilitychange'));
    expect(Recording.instances.every(a=>a.paused)).toBe(true);
    page.hidden=false;page.dispatchEvent(new Event('visibilitychange'));await Promise.resolve();await Promise.resolve();
    expect(Recording.instances.every(a=>!a.paused)).toBe(true);
    await ambience.stopAmbience();const plays=Recording.instances.map(a=>a.play.mock.calls.length);
    page.dispatchEvent(new Event('visibilitychange'));expect(Recording.instances.map(a=>a.play.mock.calls.length)).toEqual(plays);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('a failed layer stops and releases the entire bed without starting a substitute',async()=>{
    const errors:string[]=[];const states:boolean[]=[];
    ambience.subscribeAmbienceError(message=>errors.push(message));ambience.subscribeAmbienceState(value=>states.push(value));
    ambience.setAmbienceLayers(['forest','water']);Recording.fail='water';
    await expect(ambience.startAmbience()).rejects.toThrow('Recording unavailable');
    expect(Recording.instances).toHaveLength(2);expect(Recording.instances.every(a=>a.src===''&&a.paused)).toBe(true);
    expect(states).toEqual([false]);expect(errors).toEqual(['Recording unavailable']);expect(vi.getTimerCount()).toBe(0);
    Recording.fail=null;await ambience.startAmbience();expect(Recording.instances).toHaveLength(4);expect(states).toEqual([false,true]);
  });
  it('reports a late media failure independently and detaches its listeners after cleanup',async()=>{
    const states:boolean[]=[],errors:string[]=[];const unsub=ambience.subscribeAmbienceError(e=>errors.push(e));
    ambience.subscribeAmbienceState(v=>states.push(v));ambience.setAmbienceLayers(['forest']);await ambience.startAmbience();
    Recording.instances[0].dispatchEvent(new Event('error'));expect(states).toEqual([false,true,false]);expect(errors).toHaveLength(1);
    Recording.instances[0].dispatchEvent(new Event('error'));expect(errors).toHaveLength(1);unsub();
    await ambience.startAmbience();Recording.instances[1].dispatchEvent(new Event('error'));expect(errors).toHaveLength(1);
  });
  it('times out a stalled recording and leaves the next explicit attempt usable',async()=>{
    Recording.gate=new Promise(()=>{});ambience.setAmbienceLayers(['water']);
    const result=expect(ambience.startAmbience()).rejects.toThrow('could not load');
    await vi.advanceTimersByTimeAsync(8001);await result;
    expect(Recording.instances[0].src).toBe('');expect(vi.getTimerCount()).toBe(0);
    Recording.gate=null;await ambience.startAmbience();expect(Recording.instances[1].paused).toBe(false);
  });
  it('bounds volume safely and ignores unknown source identifiers',async()=>{
    ambience.setAmbienceLayers(['missing' as 'forest','forest']);await ambience.startAmbience();
    expect(Recording.instances).toHaveLength(1);ambience.setAmbienceVolume(12);expect(Recording.instances[0].volume).toBe(.5);
    ambience.setAmbienceVolume(-1);expect(Recording.instances[0].volume).toBe(0);
    ambience.setAmbienceVolume(NaN);expect(Recording.instances[0].volume).toBe(.15);
  });
});
