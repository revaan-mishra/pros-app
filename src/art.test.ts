import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { seedGame } from './domain';
import { Avatar } from './components/Avatar';
import { getAutoTimeOfDay, RegionArt, WorldArt } from './components/WorldArt';

/** These checks exercise display contracts that could silently regress while
 * the deterministic progression engine continues to pass. */
describe('the world follows the confirmed profile clock', () => {
  it.each([
    ['2026-11-12T23:29:00Z', 'night'],
    ['2026-11-12T23:30:00Z', 'dawn'],
    ['2026-11-13T03:29:00Z', 'dawn'],
    ['2026-11-13T03:30:00Z', 'day'],
    ['2026-11-13T11:30:00Z', 'twilight'],
    ['2026-11-13T15:30:00Z', 'night'],
  ] as const)('uses Asia/Kolkata at %s as %s rather than the execution clock', (instant, expected) => {
    expect(getAutoTimeOfDay('Asia/Kolkata', new Date(instant))).toBe(expected);
  });
  it('uses the supplied time zone across a daylight-saving transition', () => {
    expect(getAutoTimeOfDay('America/New_York', new Date('2026-03-08T09:30:00Z'))).toBe('dawn');
    expect(getAutoTimeOfDay('America/New_York', new Date('2026-11-01T09:30:00Z'))).toBe('night');
    expect(getAutoTimeOfDay('UTC', new Date('2026-11-01T09:30:00Z'))).toBe('day');
  });
});

describe('illustrations preserve working controls and corrected eligibility', () => {
  it('does not manufacture inert buttons when a map is decorative', () => {
    const markup = renderToStaticMarkup(createElement(WorldArt, { stages: {}, compact: true }));
    expect(markup).not.toContain('<button');
    expect(markup).not.toContain('world-art-legend');
  });
  it('keeps six accessible region controls and six non-tabbed visual hit areas', () => {
    const markup = renderToStaticMarkup(createElement(WorldArt, { stages: {}, onRegionClick: () => {} }));
    expect((markup.match(/aria-pressed=/g) || []).length).toBe(6);
    expect((markup.match(/tabindex="-1" aria-hidden="true"/g) || []).length).toBe(6);
  });
  it('shows correction-safe starter gear even when the familiar and aura are enabled', () => {
    const profile = seedGame('empty').profile;
    profile.equipment = { outfit: 'foundry-outfit', emblem: 'foundry-emblem', accessory: 'foundry-accessory' };
    const markup = renderToStaticMarkup(createElement(Avatar, { profile, eligibleCosmetics: [], companion: true, dominantAttribute: 'intelligence' }));
    expect(markup).toContain('data-outfit="starter"');
    expect(markup).toContain('data-emblem="none"');
    expect(markup).toContain('data-accessory="none"');
  });
  it('reveals keepsakes from eligible region stages rather than unrelated attributes', () => {
    const before = renderToStaticMarkup(createElement(RegionArt, { regionId: 'foundry', stage: 1 }));
    const restored = renderToStaticMarkup(createElement(RegionArt, { regionId: 'foundry', stage: 2 }));
    expect(before).not.toContain('world-relic-pulse');
    expect(restored).toContain('world-relic-pulse');
  });
});
