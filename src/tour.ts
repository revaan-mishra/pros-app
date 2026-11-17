export const TOUR_VERSION = 2 as const;
export type TourMode = 'intro' | 'reference';
export interface TourStep {
  id: string;
  route: string;
  target: string;
  eyebrow: string;
  title: string;
  body: string;
  takeaway: string;
}

export const REFERENCE_TOUR_STEPS: readonly TourStep[] = [
  {
    id: 'effort', route: '/', target: 'log-activity', eyebrow: '01 · A LITTLE REAL EFFORT',
    title: 'Your story starts with what you do.',
    body: 'Use Log activity after a little practice, reading, or work. Choose a skill and your time. One minute earns one XP, shared fairly if you split it between skills.',
    takeaway: 'This tour only shows you around. It will not log time or change your progress.',
  },
  {
    id: 'quests', route: '/quests', target: 'quests-nav', eyebrow: '02 · A USEFUL NEXT STEP',
    title: 'Give a bigger intention a small beginning.',
    body: 'Quests hold your next actions and routines. Projects bring preparation, relevant practice, and a finished result together as an adventure. Completing a checkbox never adds another effort reward.',
    takeaway: 'A clear next action helps you begin again. Pausing a project is always allowed.',
  },
  {
    id: 'skills', route: '/skills', target: 'skills-nav', eyebrow: '03 · PATHS OF YOUR OWN',
    title: 'Make room for what interests you.',
    body: 'Equip a few skills to keep Today focused. Explore the starter library or create your own. Each skill has practice levels, output milestones, and a home region.',
    takeaway: 'Unequipping or archiving a skill keeps its recorded history intact.',
  },
  {
    id: 'world', route: '/world', target: 'world-nav', eyebrow: '04 · SOMETHING TAKES ROOT',
    title: 'Watch effort become a place.',
    body: 'The six regions grow through both relevant practice and meaningful outcomes. A first landmark needs 60 minutes and one output. Later stages ask for more practice and finished work.',
    takeaway: 'There are no attendance penalties. Your world waits for you after an absence.',
  },
  {
    id: 'character', route: '/character', target: 'character-nav', eyebrow: '05 · A CHARACTER YOU RECOGNIZE',
    title: 'Wear a little of your journey.',
    body: 'Your character expresses the skills you practice. Explore attributes, choose an appearance, and equip cosmetics unlocked by world milestones. Levels describe your records in this game.',
    takeaway: 'Correcting a mistaken record recalculates related unlocks. Inactivity never does.',
  },
  {
    id: 'focus', route: '/focus', target: 'focus-entry', eyebrow: '06 · ONE THING AT A TIME',
    title: 'Give your next session some space.',
    body: 'Choose a skill, then use a countdown or stopwatch. You can pause, leave the screen, and return to your session. Review and confirm the effort before it becomes XP.',
    takeaway: 'The timer keeps its place. A completed session still needs your confirmation.',
  },
  {
    id: 'backup', route: '/settings?section=data', target: 'backup-export', eyebrow: '07 · KEEP WHAT YOU MAKE',
    title: 'Carry a copy of your world.',
    body: 'This core app saves to this browser on this device. Export a backup from Settings to keep a portable copy of your activities, projects, journal and unfinished drafts. Local snapshots help recover from mistakes.',
    takeaway: 'A saved export protects you when a device or its browser data is lost. Keep it somewhere private.',
  },
] as const;

/** The short introduction follows the daily loop; the longer guide stays deliberate. */
export const TOUR_STEPS: readonly TourStep[] = [
  { id: 'next-action', route: '/', target: 'next-action', eyebrow: '01 · YOUR NEXT ACTION',
    title: 'Begin with one useful next step.',
    body: 'Today keeps your pinned project and its next action close. Start focus when you are ready to work, or change the project when your attention belongs elsewhere.',
    takeaway: 'This introduction changes no records. Your projects and progress stay under your control.' },
  { id: 'capture', route: '/', target: 'log-activity', eyebrow: '02 · RECORD THE WORK',
    title: 'Keep the effort you actually spent.',
    body: 'Use Log activity after practice, reading, or work. Choose the skill and time; a second skill shares the same effort. Save once to update your records and receive one compact result.',
    takeaway: 'One credited minute earns one XP. Checkboxes and page counts do not create extra effort.' },
  { id: 'effect', route: '/world', target: 'world-nav', eyebrow: '03 · SEE ITS EFFECT',
    title: 'Find the mark your work leaves.',
    body: 'Choose a place in the atlas to inspect its current scene, exact next requirements and finished results. Restoration needs both relevant effort and real outputs; appearance previews grant nothing.',
    takeaway: 'Time away never removes progress. Corrections follow the evidence; your world has no attendance deadline.' },
] as const;
export const tourSteps = (mode: TourMode = 'intro'): readonly TourStep[] => mode === 'reference' ? REFERENCE_TOUR_STEPS : TOUR_STEPS;
export type TourStatus = 'not-started' | 'in-progress' | 'completed' | 'skipped';
export interface TourState { version: typeof TOUR_VERSION; mode?: TourMode; status: TourStatus; step: number; updatedAt: string }
export interface TourStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
export interface TourRect { left: number; top: number; width: number; height: number }
export interface TourViewport { width: number; height: number }
export const tourStorageKey = (accountId: string, mode: TourMode = 'intro') => `pros.tour.v${TOUR_VERSION}:${mode}:${encodeURIComponent(accountId)}`;
export const legacyTourStorageKey = (accountId: string) => `pros.tour.v1:${encodeURIComponent(accountId)}`;
export const initialTourState = (mode: TourMode = 'intro'): TourState => ({ version: TOUR_VERSION, mode, status: 'not-started', step: 0, updatedAt: '' });
export const clampTourStep = (step: number, mode: TourMode = 'intro') => Number.isFinite(step) ? Math.max(0, Math.min(tourSteps(mode).length - 1, Math.floor(step))) : 0;
const statuses: readonly string[] = ['not-started', 'in-progress', 'completed', 'skipped'];
function availableStorage(storage?: TourStorage | null): TourStorage | null {
  if (storage !== undefined) return storage;
  try { return typeof window === 'undefined' ? null : window.localStorage; } catch { return null; }
}
function parseState(raw: string | null | undefined, mode: TourMode, legacy = false): TourState | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return null;
    const v = value as { version?: number; mode?: string; status?: string; step?: number; updatedAt?: string };
    const count = legacy ? REFERENCE_TOUR_STEPS.length : tourSteps(mode).length;
    if (v.version !== (legacy ? 1 : TOUR_VERSION) || (!legacy && v.mode !== mode) || !statuses.includes(v.status || '') || !Number.isInteger(v.step) || (v.step ?? -1) < 0 || (v.step ?? Infinity) >= count || typeof v.updatedAt !== 'string') return null;
    // Legacy steps refer to the seven-stop reference, never a new three-step index.
    const mapped = mode === 'reference' ? v.step! : v.step === 0 ? 1 : v.step! < 3 ? 0 : 2;
    return { version: TOUR_VERSION, mode, status: v.status as TourStatus, step: legacy ? v.status === 'not-started' ? 0 : v.status === 'completed' ? tourSteps(mode).length - 1 : mapped : v.step!, updatedAt: v.updatedAt };
  } catch { return null; }
}
export function readTourState(accountId: string, storage?: TourStorage | null, mode: TourMode = 'intro'): TourState {
  try {
    const source = availableStorage(storage);
    const current = parseState(source?.getItem(tourStorageKey(accountId, mode)), mode);
    if (current) return current;
    if (mode === 'intro') {
      const reference = parseState(source?.getItem(tourStorageKey(accountId, 'reference')), 'reference');
      if (reference && ['completed','skipped'].includes(reference.status)) return { ...reference, mode, step: clampTourStep(reference.step,mode) };
    }
    const legacy = parseState(source?.getItem(legacyTourStorageKey(accountId)), mode, true);
    if (legacy) return legacy;
    return initialTourState(mode);
  } catch { return initialTourState(mode); }
}
export function writeTourState(accountId: string, state: TourState, storage?: TourStorage | null, mode: TourMode = state.mode || 'intro'): boolean {
  try {
    const target = availableStorage(storage);
    if (!target || state.version !== TOUR_VERSION || !statuses.includes(state.status) || state.mode && state.mode !== mode) return false;
    target.setItem(tourStorageKey(accountId,mode), JSON.stringify({ ...state, mode, step: clampTourStep(state.step,mode) })); return true;
  } catch { return false; }
}
export function startTour(previous: TourState, replay = false, now = new Date().toISOString(), mode: TourMode = previous.mode || 'intro'): TourState {
  return { version: TOUR_VERSION, mode, status: 'in-progress', step: !replay && previous.status === 'in-progress' && (!previous.mode || previous.mode === mode) ? clampTourStep(previous.step,mode) : 0, updatedAt: now };
}
export function moveTour(state: TourState, direction: -1 | 1, now = new Date().toISOString()): TourState { return { ...state, status: 'in-progress', step: clampTourStep(state.step + direction,state.mode), updatedAt: now }; }
export function finishTour(state: TourState, now = new Date().toISOString()): TourState { return { ...state, status: 'completed', step: tourSteps(state.mode).length - 1, updatedAt: now }; }
export function skipTour(state: TourState, now = new Date().toISOString()): TourState { return { ...state, status: 'skipped', step: clampTourStep(state.step,state.mode), updatedAt: now }; }

/** Return a route only while a configured stop is not ready.
 * Bare paths preserve a selected region/filter; configured query keys must match.
 * Query order and unrelated parameters cannot trigger redirect loops. */
export function tourNavigationTarget(route: string, pathname: string, search: string): string | null {
  const separator = route.indexOf('?');
  const path = separator < 0 ? route : route.slice(0,separator);
  if (pathname !== path) return route;
  if (separator < 0) return null;
  const configured = new URLSearchParams(route.slice(separator+1));
  const current = new URLSearchParams(search);
  const keys = [...new Set(configured.keys())];
  if (keys.every(key=>{
    const expected=configured.getAll(key), actual=current.getAll(key);
    return actual.length===expected.length && expected.every((value,index)=>value===actual[index]);
  })) return null;
  for (const key of keys) {
    current.delete(key);
    for (const value of configured.getAll(key)) current.append(key,value);
  }
  const query=current.toString();
  return `${path}${query?`?${query}`:''}`;
}

/** The highlight is clipped to the viewport so a small or off-screen target
 * cannot create a giant overlay or horizontal scrolling. */
export function clipTourRect(rect: TourRect, viewport: TourViewport, padding = 7): TourRect | null {
  if (![rect.left, rect.top, rect.width, rect.height, viewport.width, viewport.height].every(Number.isFinite) || rect.width <= 0 || rect.height <= 0) return null;
  const left = Math.max(8, rect.left - padding); const top = Math.max(8, rect.top - padding);
  const right = Math.min(viewport.width - 8, rect.left + rect.width + padding);
  const bottom = Math.min(viewport.height - 8, rect.top + rect.height + padding);
  return right > left && bottom > top ? { left, top, width: right - left, height: bottom - top } : null;
}
