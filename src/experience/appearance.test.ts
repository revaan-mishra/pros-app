import { describe, expect, it } from 'vitest';
import { createElement, Fragment } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Avatar } from '../components/Avatar';
import { COSMETICS } from '../catalog';
import { projectGame, seedGame } from '../domain';
import { cosmeticRequirement, equipCosmetic, previewAppearance, starterAppearance, wardrobeEffortMinutes, pickerColor } from './appearance';

describe('wardrobe previews and canonical equipment', () => {
  it('previews every locked piece on the actual rig without mutating records or progression', () => {
    const data = seedGame('empty'); const original = structuredClone(data); const eligible = projectGame(data).eligibleCosmetics;
    for (const item of COSMETICS) {
      const preview = previewAppearance(data.profile, eligible, item.id);
      expect(preview.profile.equipment[item.slot]).toBe(item.id);
      expect(preview.renderEligible).toContain(item.id);
      expect(() => equipCosmetic(data.profile, eligible, item.id)).toThrow('not currently unlocked');
    }
    expect(data).toEqual(original); expect(projectGame(data).xp).toBe(0); expect(eligible).toEqual([]);
  });
  it('equips and unequips one eligible slot while preserving the other identities', () => {
    const profile = seedGame('empty').profile; const before = structuredClone(profile);
    const next = equipCosmetic(profile, ['foundry-accessory'], 'foundry-accessory');
    expect(next.equipment.accessory).toBe('foundry-accessory');
    expect(next.equipment.outfit).toBe(profile.equipment.outfit); expect(profile).toEqual(before);
    expect(equipCosmetic(next, ['foundry-accessory'], 'foundry-accessory').equipment.accessory).toBe('');
    expect(() => equipCosmetic(next, [], 'foundry-accessory')).toThrow();
  });
  it('uses exact effort/output/project gates and leaves starter appearance available', () => {
    for (const item of COSMETICS) expect(cosmeticRequirement(item)).toEqual({minutes:[0,60,240,720][item.stage],outputs:item.stage,completedProject:item.stage===3});
    const profile=seedGame('demo').profile; const old=structuredClone(profile);
    expect(starterAppearance(profile).equipment).toEqual({emblem:'',accessory:'',outfit:''}); expect(profile).toEqual(old);
    expect(previewAppearance(profile, [], 'unknown').item).toBeUndefined();
  });
});


describe('portrait rendering safeguards', () => {
  it('keeps fractional effort visibly below an unmet target', () => {
    expect(wardrobeEffortMinutes(719.999 * 60)).toBe('719.99');
    expect(wardrobeEffortMinutes(59.999 * 60)).toBe('59.99');
    expect(wardrobeEffortMinutes(720 * 60)).toBe('720');
    expect(pickerColor('#a3c792')).toBe('#a3c792');
    expect(pickerColor('#abc')).toBe('#aabbcc');
    expect(pickerColor('#abc8')).toBe('#aabbcc');
    expect(pickerColor('#a3c79280')).toBe('#a3c792');
  });
  it('uses unique gradient/title identifiers for simultaneous current and preview portraits', () => {
    const profile=seedGame('empty').profile;
    const html=renderToStaticMarkup(createElement(Fragment,null,createElement(Avatar,{profile,eligibleCosmetics:[]}),createElement(Avatar,{profile,eligibleCosmetics:[]})));
    const ids=[...html.matchAll(/ id="([^"]+)"/g)].map(m=>m[1]);
    expect(ids.length).toBeGreaterThan(6); expect(new Set(ids).size).toBe(ids.length);
    for(const [,reference] of html.matchAll(/url\(#([^\)]+)\)/g)) expect(ids).toContain(reference);
  });
  it('falls back for invalid equipment and malformed colors while retaining a valid custom color', () => {
    const profile=seedGame('empty').profile;
    const invalid={...profile,avatarColor:'#abcde',equipment:{emblem:'unknown-emblem',accessory:'observatory-accessory',outfit:'foundry-outfit'}};
    const html=renderToStaticMarkup(createElement(Avatar,{profile:invalid,eligibleCosmetics:[]}));
    expect(html).toContain('data-outfit="starter"'); expect(html).toContain('data-accessory="none"');
    expect(html).toContain('#5e9a86'); expect(html).not.toContain('#abcde');
    expect(renderToStaticMarkup(createElement(Avatar,{profile:{...profile,avatarColor:'#abc'},eligibleCosmetics:[]}))).toContain('stop-color="#abc"');
  });
});
