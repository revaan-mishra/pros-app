import { describe, expect, it } from 'vitest';
import { clipTourRect, finishTour, initialTourState, moveTour, readTourState, skipTour, startTour, TOUR_STEPS, REFERENCE_TOUR_STEPS, TOUR_VERSION, legacyTourStorageKey, tourSteps, tourNavigationTarget, tourStorageKey, writeTourState, type TourStorage } from './tour';

function memoryStorage(): TourStorage {
  const values = new Map<string, string>();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } };
}
describe('guided tour lifecycle', () => {
  it('offers three real daily-loop stops and a separate seven-stop reference without recording progress', () => {
    expect(TOUR_STEPS.map(step => step.route)).toEqual(['/', '/', '/world']);
    expect(TOUR_STEPS.map(step => step.target)).toEqual(['next-action','log-activity','world-nav']);
    expect(REFERENCE_TOUR_STEPS.map(step => step.route)).toEqual(['/', '/quests', '/skills', '/world', '/character', '/focus', '/settings?section=data']);
    expect(new Set(TOUR_STEPS.map(step => step.id)).size).toBe(TOUR_STEPS.length);
    expect(initialTourState().status).toBe('not-started');
  });
  it('resumes interrupted progress for only the same account', () => {
    const storage = memoryStorage();
    const started = startTour(initialTourState(), false, '2026-11-13T12:00:00Z');
    const advanced = moveTour(moveTour(started, 1), 1);
    expect(writeTourState('local:one', advanced, storage)).toBe(true);
    expect(startTour(readTourState('local:one', storage)).step).toBe(2);
    expect(readTourState('local:two', storage)).toEqual(initialTourState());
    expect(tourStorageKey('local:one')).not.toBe(tourStorageKey('local%3Aone'));
  });
  it('allows skipping at any step and deliberate replay from the beginning', () => {
    const progress = { ...startTour(initialTourState('reference')), step: 4 };
    const skipped = skipTour(progress);
    expect(skipped.status).toBe('skipped'); expect(skipped.step).toBe(4);
    expect(startTour(skipped).step).toBe(0);
    expect(startTour(progress, true).step).toBe(0);
    expect(startTour(finishTour(progress)).step).toBe(0);
  });
  it('never moves outside the step list and finishes at the final stop', () => {
    const initial = startTour(initialTourState());
    expect(moveTour(initial, -1).step).toBe(0);
    const complete = finishTour(initial);
    expect(complete.status).toBe('completed'); expect(complete.step).toBe(TOUR_STEPS.length - 1);
    expect(moveTour(complete, 1).step).toBe(TOUR_STEPS.length - 1);
  });
  it.each(['not-json', 'null', '{}', '{"version":9,"status":"in-progress","step":2,"updatedAt":"now"}', '{"version":1,"status":"in-progress","step":99,"updatedAt":"now"}', '{"version":1,"status":"in-progress","step":-1,"updatedAt":"now"}', '{"version":1,"status":"unknown","step":1,"updatedAt":"now"}'])('recovers safely from invalid or unsupported stored state: %s', raw => {
    const storage = memoryStorage(); storage.setItem(tourStorageKey('local:test'), raw);
    expect(readTourState('local:test', storage)).toEqual(initialTourState());
  });
  it('does not fail the app when browser storage is unavailable or full', () => {
    const blocked: TourStorage = { getItem: () => { throw new Error('Blocked'); }, setItem: () => { throw new Error('Quota'); } };
    expect(readTourState('local:test', blocked)).toEqual(initialTourState());
    expect(writeTourState('local:test', startTour(initialTourState()), blocked)).toBe(false);
    expect(writeTourState('local:test', startTour(initialTourState()), null)).toBe(false);
  });
});
describe('guided tour highlight bounds', () => {
  it('clips a partly visible control and leaves room around the viewport', () => {
    expect(clipTourRect({ left: -20, top: 35, width: 100, height: 44 }, { width: 390, height: 780 })).toEqual({ left: 8, top: 28, width: 79, height: 58 });
    expect(clipTourRect({ left: 350, top: 750, width: 100, height: 50 }, { width: 390, height: 780 })).toEqual({ left: 343, top: 743, width: 39, height: 29 });
  });
  it('does not create a highlight for invisible or malformed targets', () => {
    expect(clipTourRect({ left: 0, top: 0, width: 0, height: 50 }, { width: 390, height: 780 })).toBeNull();
    expect(clipTourRect({ left: 500, top: 100, width: 50, height: 50 }, { width: 390, height: 780 })).toBeNull();
    expect(clipTourRect({ left: NaN, top: 100, width: 50, height: 50 }, { width: 390, height: 780 })).toBeNull();
  });
});

describe('intro and reference continuity',()=>{
  it('resumes each mode independently and does not overwrite another mode or account',()=>{
    const storage=memoryStorage();
    const intro={...startTour(initialTourState()),step:1};
    const reference={...startTour(initialTourState('reference')),step:4};
    expect(writeTourState('local:guide-one',intro,storage)).toBe(true);
    expect(writeTourState('local:guide-one',reference,storage)).toBe(true);
    expect(readTourState('local:guide-one',storage).step).toBe(1);
    expect(readTourState('local:guide-one',storage,'reference').step).toBe(4);
    expect(readTourState('local:guide-two',storage,'reference')).toEqual(initialTourState('reference'));
    expect(writeTourState('local:guide-one',reference,storage,'intro')).toBe(false);
    expect(readTourState('local:guide-one',storage).step).toBe(1);
    expect(startTour(reference,false,'now','intro').step).toBe(0);
  });
  it.each(['completed','skipped'] as const)('respects a prior %s seven-step tour without repeating the introduction',status=>{
    const storage=memoryStorage();
    const raw=JSON.stringify({version:1,status,step:6,updatedAt:'2026-11-13T12:00:00Z'});
    storage.setItem(legacyTourStorageKey('local:legacy'),raw);
    const intro=readTourState('local:legacy',storage);
    expect(intro.status).toBe(status);expect(intro.mode).toBe('intro');expect(intro.step).toBe(2);expect(intro.version).toBe(TOUR_VERSION);
    const reference=readTourState('local:legacy',storage,'reference');
    expect(reference.status).toBe(status);expect(reference.step).toBe(6);
    expect(storage.getItem(legacyTourStorageKey('local:legacy'))).toBe(raw);
    expect(startTour(intro,true).step).toBe(0);
    expect(readTourState('local:another',storage).status).toBe('not-started');
  });
  it('maps interrupted legacy stops into the brief guide while preserving exact reference position',()=>{
    const storage=memoryStorage();
    for(const [step,expected] of [[0,1],[1,0],[2,0],[3,2],[6,2]]){
      storage.setItem(legacyTourStorageKey('local:legacy-moving'),JSON.stringify({version:1,status:'in-progress',step,updatedAt:'now'}));
      expect(readTourState('local:legacy-moving',storage).step).toBe(expected);
      expect(readTourState('local:legacy-moving',storage,'reference').step).toBe(step);
    }
  });
  it('keeps new explicit state ahead of the legacy copy and suppresses an invitation after a full reference',()=>{
    const storage=memoryStorage();
    const reference=finishTour(startTour(initialTourState('reference')));
    expect(writeTourState('local:finished-reference',reference,storage)).toBe(true);
    expect(readTourState('local:finished-reference',storage).status).toBe('completed');
    storage.setItem(legacyTourStorageKey('local:finished-reference'),JSON.stringify({version:1,status:'in-progress',step:4,updatedAt:'old'}));
    expect(readTourState('local:finished-reference',storage).status).toBe('completed');
    storage.setItem(legacyTourStorageKey('local:explicit'),JSON.stringify({version:1,status:'in-progress',step:6,updatedAt:'old'}));
    expect(writeTourState('local:explicit',skipTour(startTour(initialTourState())),storage)).toBe(true);
    expect(readTourState('local:explicit',storage).status).toBe('skipped');
  });
  it('bounds movements and completion to the selected guide',()=>{
    for(const mode of ['intro','reference'] as const){
      const started=startTour(initialTourState(mode));
      const last=tourSteps(mode).length-1;
      expect(finishTour(started).step).toBe(last);
      expect(moveTour({...started,step:last},1).step).toBe(last);
      expect(skipTour({...started,step:99}).step).toBe(last);
    }
  });
});


describe('guided route and query readiness',()=>{
  it('opens the visible Data section for the reference backup stop',()=>{
    const backup=REFERENCE_TOUR_STEPS.find(step=>step.id==='backup')!;
    expect(tourNavigationTarget(backup.route,'/world','?region=foundry')).toBe('/settings?section=data');
    expect(tourNavigationTarget(backup.route,'/settings','')).toBe('/settings?section=data');
    expect(tourNavigationTarget(backup.route,'/settings','?section=help')).toBe('/settings?section=data');
    expect(tourNavigationTarget(backup.route,'/settings','?section=data')).toBeNull();
  });
  it('preserves a same-path place or filter when the configured stop has no query',()=>{
    expect(tourNavigationTarget('/world','/world','?region=foundry')).toBeNull();
    expect(tourNavigationTarget('/skills','/skills','?view=all&region=atelier')).toBeNull();
    expect(tourNavigationTarget('/','/','?collection=1')).toBeNull();
  });
  it('matches configured query values regardless of ordering while retaining unrelated same-path parameters',()=>{
    expect(tourNavigationTarget('/settings?section=data','/settings','?origin=guide&section=data')).toBeNull();
    const target=tourNavigationTarget('/settings?section=data','/settings','?origin=guide&section=help')!;
    const url=new URL(target,'https://pros.invalid');
    expect(url.searchParams.get('origin')).toBe('guide');expect(url.searchParams.getAll('section')).toEqual(['data']);
    expect(tourNavigationTarget('/settings?section=data',url.pathname,url.search)).toBeNull();
    const duplicate=tourNavigationTarget('/settings?section=data','/settings','?section=help&section=data')!;
    const deduplicated=new URL(duplicate,'https://pros.invalid');
    expect(deduplicated.searchParams.getAll('section')).toEqual(['data']);
    expect(tourNavigationTarget('/settings?section=data',deduplicated.pathname,deduplicated.search)).toBeNull();
  });
  it('settles each configured stop after one navigation without carrying queries between pages',()=>{
    for(const step of [...TOUR_STEPS,...REFERENCE_TOUR_STEPS]){
      const target=tourNavigationTarget(step.route,'/unrelated','?old=filter')!;
      const current=new URL(target,'https://pros.invalid');
      expect(current.searchParams.has('old')).toBe(false);
      expect(tourNavigationTarget(step.route,current.pathname,current.search)).toBeNull();
    }
  });
});
