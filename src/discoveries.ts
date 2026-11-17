import { REGIONS } from './catalog';
import { db, loadDraft, saveDraft } from './storage';
import type { Projection, RegionId } from './types';

export interface Landmark { id: string; regionId: RegionId; stage: number }

const LEDGER_NAME = 'landmark-presentations-v1';
const LANDMARKS: Landmark[] = REGIONS.flatMap(region => [1, 2, 3].map(stage => ({
  id: `${region.id}:${stage}`, regionId: region.id, stage,
})));
const VALID_IDS = new Set(LANDMARKS.map(landmark => landmark.id));
interface PresentationLedger { version: 1; seenIds: string[] }

function stage(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(3, Math.floor(value))) : 0;
}

/** Eligibility remains derived from records; this only describes newly crossed stages. */
export function newlyReachedLandmarks(before: Projection, after: Projection): Landmark[] {
  return LANDMARKS.filter(landmark => landmark.stage > stage(before.regions[landmark.regionId].stage)
    && landmark.stage <= stage(after.regions[landmark.regionId].stage)).map(landmark => ({ ...landmark }));
}

function seenIds(value: unknown): Set<string> {
  if (!value || typeof value !== 'object') return new Set();
  const ledger = value as Partial<PresentationLedger>;
  if (ledger.version !== 1 || !Array.isArray(ledger.seenIds)) return new Set();
  return new Set(ledger.seenIds.filter(id => typeof id === 'string' && VALID_IDS.has(id)));
}

/** Atomically claim presentation only, independently of canonical data and undo revisions. */
export async function claimLandmarks(accountId: string, candidates: readonly Landmark[]): Promise<Landmark[]> {
  const candidateIds = new Set(candidates.filter(candidate => candidate
    && VALID_IDS.has(candidate.id)
    && candidate.id === `${candidate.regionId}:${candidate.stage}`).map(candidate => candidate.id));
  if (!candidateIds.size) return [];
  try {
    return await db.transaction('rw', db.drafts, async () => {
      const seen = seenIds(await loadDraft(accountId, LEDGER_NAME));
      const claimed = LANDMARKS.filter(landmark => candidateIds.has(landmark.id) && !seen.has(landmark.id));
      if (!claimed.length) return [];
      for (const landmark of claimed) seen.add(landmark.id);
      // A finite campaign makes this ledger permanently bounded to eighteen IDs.
      await saveDraft(accountId, LEDGER_NAME, {
        version: 1, seenIds: LANDMARKS.filter(landmark => seen.has(landmark.id)).map(landmark => landmark.id),
      } satisfies PresentationLedger);
      return claimed.map(landmark => ({ ...landmark }));
    });
  } catch {
    // Presentation must never turn an acknowledged activity save into an error.
    return [];
  }
}
