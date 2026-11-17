import 'fake-indexeddb/auto';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { REGIONS } from './catalog';
import { claimLandmarks, newlyReachedLandmarks } from './discoveries';
import { projectGame, seedGame } from './domain';
import { db, loadDraft, saveDraft } from './storage';
import type { Projection, RegionId } from './types';

function projection(stages: Partial<Record<RegionId, number>> = {}): Projection {
  const result = projectGame(seedGame('empty', 'Tester'));
  for (const region of REGIONS) result.regions[region.id].stage = stages[region.id] ?? 0;
  return result;
}

beforeEach(async () => {
  if (!db.isOpen()) await db.open();
  await db.drafts.clear();
});
afterEach(() => vi.restoreAllMocks());
afterAll(() => db.close());

describe('world landmark presentation', () => {
  it('includes every crossed stage in campaign order, without changing either projection', () => {
    const before = projection({ foundry: 1, atelier: 3 });
    const after = projection({ observatory: 3, foundry: 3, atelier: 2, sanctuary: 1 });
    const originalBefore = structuredClone(before); const originalAfter = structuredClone(after);
    expect(newlyReachedLandmarks(before, after).map(landmark => landmark.id)).toEqual([
      'observatory:1', 'observatory:2', 'observatory:3', 'foundry:2', 'foundry:3', 'sanctuary:1',
    ]);
    expect(before).toEqual(originalBefore); expect(after).toEqual(originalAfter);
    expect(newlyReachedLandmarks(after, after)).toEqual([]);
  });

  it('claims three stages once and never repeats them after correction and re-crossing', async () => {
    const empty = projection(); const complete = projection({ atelier: 3 });
    const candidates = newlyReachedLandmarks(empty, complete);
    expect((await claimLandmarks('local:alice', candidates)).map(landmark => landmark.stage)).toEqual([1, 2, 3]);
    expect(await claimLandmarks('local:alice', candidates)).toEqual([]);
    const corrected = projection({ atelier: 1 });
    expect(newlyReachedLandmarks(complete, corrected)).toEqual([]);
    expect(await claimLandmarks('local:alice', newlyReachedLandmarks(corrected, complete))).toEqual([]);
    expect(await loadDraft('local:alice', 'landmark-presentations-v1')).toEqual({
      version: 1, seenIds: ['atelier:1', 'atelier:2', 'atelier:3'],
    });
  });

  it('isolates identical landmark claims by account', async () => {
    const candidates = newlyReachedLandmarks(projection(), projection({ training: 1 }));
    expect(await claimLandmarks('local:alice', candidates)).toEqual(candidates);
    expect(await claimLandmarks('local:bob', candidates)).toEqual(candidates);
    expect(await claimLandmarks('local:alice', candidates)).toEqual([]);
  });

  it('serializes overlapping concurrent claims and repeated deliveries atomically', async () => {
    const candidates = newlyReachedLandmarks(projection(), projection({ foundry: 3 }));
    const deliveries = Array.from({ length: 30 }, (_, index) => claimLandmarks('local:alice', index % 2 ? candidates.slice(1) : candidates));
    const received = (await Promise.all(deliveries)).flat();
    expect(received.map(landmark => landmark.id).sort()).toEqual(['foundry:1', 'foundry:2', 'foundry:3']);
    expect(new Set(received.map(landmark => landmark.id)).size).toBe(received.length);
  });

  it('keeps only valid campaign IDs and rejects inconsistent or duplicate candidates', async () => {
    await saveDraft('local:alice', 'landmark-presentations-v1', {
      version: 1, seenIds: ['atelier:1', 'atelier:1', 'unknown:1', 'atelier:4', null, ...Array(100).fill('nope')],
    });
    const candidates = newlyReachedLandmarks(projection(), projection({ atelier: 3 }));
    const claimed = await claimLandmarks('local:alice', [
      ...candidates, ...candidates, { id: 'foundry:3', regionId: 'atelier', stage: 3 },
    ]);
    expect(claimed.map(landmark => landmark.id)).toEqual(['atelier:2', 'atelier:3']);
    expect(await loadDraft('local:alice', 'landmark-presentations-v1')).toEqual({
      version: 1, seenIds: ['atelier:1', 'atelier:2', 'atelier:3'],
    });
    const all = projection(Object.fromEntries(REGIONS.map(region => [region.id, 3])));
    await claimLandmarks('local:alice', newlyReachedLandmarks(projection(), all));
    expect((await loadDraft<{ seenIds: string[] }>('local:alice', 'landmark-presentations-v1'))?.seenIds).toHaveLength(18);
  });

  it('leaves claims retryable when storage fails without surfacing a save error', async () => {
    const candidates = newlyReachedLandmarks(projection(), projection({ sanctuary: 1 }));
    const failure = vi.spyOn(db.drafts, 'put').mockRejectedValueOnce(new Error('Quota exceeded'));
    await expect(claimLandmarks('local:alice', candidates)).resolves.toEqual([]);
    expect(await loadDraft('local:alice', 'landmark-presentations-v1')).toBeNull();
    failure.mockRestore();
    expect(await claimLandmarks('local:alice', candidates)).toEqual(candidates);
    expect(await claimLandmarks('invalid-account', candidates)).toEqual([]);
  });
});
