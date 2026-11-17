import { afterEach, describe, expect, it, vi } from 'vitest';
import { MUSIC, musicAvailableOffline, readMusicChoice, saveMusicChoice, saveMusicOffline } from './music';

afterEach(() => vi.unstubAllGlobals());
describe('recorded music remains optional and honestly reports offline readiness', () => {
  it('does not report a partial media response as a full offline recording', async () => {
    vi.stubGlobal('caches', { open: vi.fn(async () => ({ match: vi.fn(async (path: string) => ({ status: path.includes('fairy') ? 206 : 200 })) })) });
    expect(await musicAvailableOffline()).toBe(false);
  });
  it('reports readiness only after all three full responses exist', async () => {
    vi.stubGlobal('caches', { open: vi.fn(async () => ({ match: vi.fn(async (path: string) => new Response(new Uint8Array(MUSIC.find(t=>t.file===path)?.bytes||0),{status:200})) })) });
    expect(await musicAvailableOffline()).toBe(true);
    expect(MUSIC.filter(track => track.file)).toHaveLength(3);
  });
  it('rejects an unavailable offline save without claiming success', async () => {
    vi.stubGlobal('caches', undefined);
    expect(await musicAvailableOffline()).toBe(false);
    await expect(saveMusicOffline()).rejects.toThrow('secure browser');
  });
  it('keeps track choices isolated and tolerates blocked storage', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) });
    saveMusicChoice('local:one', 'woodlands');
    expect(readMusicChoice('local:one')).toBe('woodlands');
    expect(readMusicChoice('local:two')).toBe('homestead');
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('Blocked'); }, setItem: () => { throw new Error('Blocked'); } });
    expect(() => saveMusicChoice('local:one', 'procedural')).not.toThrow();
    expect(readMusicChoice('local:one')).toBe('homestead');
  });
});

import { AMBIENCE_CACHE, mediaAvailableOffline, removeMediaOffline, saveMediaOffline } from './music';
describe('individual optional media downloads',()=>{
  it('saves a complete nature loop with progress and removes only that offline copy',async()=>{
    const cache={match:vi.fn(async()=>new Response(new Uint8Array(1267244),{status:200})),put:vi.fn(async()=>{}),delete:vi.fn(async()=>true)};
    const open=vi.fn(async()=>cache);vi.stubGlobal('caches',{open});
    const bytes=new Uint8Array(1267244);vi.stubGlobal('fetch',vi.fn(async()=>new Response(bytes,{status:200})));
    const progress=vi.fn();await saveMediaOffline('forest',progress);
    expect(open).toHaveBeenCalledWith(AMBIENCE_CACHE);expect(cache.put).toHaveBeenCalledTimes(1);expect(progress).toHaveBeenLastCalledWith(1267244,1267244);
    expect(await mediaAvailableOffline('forest')).toBe(true);await removeMediaOffline('forest');expect(cache.delete).toHaveBeenCalledWith('/audio/ambience/forest.wav');
  });
  it('preserves a previous cache when the new download is partial, truncated or canceled',async()=>{
    const put=vi.fn(async()=>{});vi.stubGlobal('caches',{open:vi.fn(async()=>({put,match:vi.fn(async()=>({status:200}))}))});
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(new Uint8Array(16),{status:206})));await expect(saveMediaOffline('water')).rejects.toThrow('complete');
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(new Uint8Array(16),{status:200})));await expect(saveMediaOffline('water')).rejects.toThrow('incomplete');
    const request=new AbortController();request.abort();vi.stubGlobal('fetch',vi.fn(async()=>new Response(new Uint8Array(1267244),{status:200})));await expect(saveMediaOffline('water',undefined,request.signal)).rejects.toThrow('canceled');
    expect(put).not.toHaveBeenCalled();
  });
});

it('does not call a truncated 200 cache entry ready even when its length header claims a complete file',async()=>{
  vi.stubGlobal('caches',{open:vi.fn(async()=>({match:vi.fn(async()=>new Response(new Uint8Array(16),{status:200,headers:{'Content-Length':'1267244'}}))}))});
  expect(await mediaAvailableOffline('forest')).toBe(false);
});
