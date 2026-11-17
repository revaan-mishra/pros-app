import { describe, expect, it } from 'vitest';
import { seedGame } from '../domain';
import { mergeSettingsPreferences, settingsChangedFields } from './settings-preferences';

describe('explicit settings edit reconciliation',()=>{
  it('merges independent preferences and keeps newer unrelated profile fields',()=>{
    const base=seedGame('empty','Before').profile;
    const edited={...base,displayName:'My new name'};
    const current={...base,revision:base.revision+2,theme:'light' as const,lastSkillId:'meditation',lastExportAt:'2026-11-17T04:00:00.000Z'};
    const original=structuredClone(current);
    const result=mergeSettingsPreferences(base,edited,current);
    expect(result.changedFields).toEqual(['displayName']);expect(result.conflicts).toEqual([]);
    expect(result.profile).toMatchObject({displayName:'My new name',theme:'light',lastSkillId:'meditation',lastExportAt:current.lastExportAt,revision:current.revision});
    expect(current).toEqual(original);expect(base.displayName).toBe('Before');
  });
  it('requires review when another copy changed the same edited field',()=>{
    const base=seedGame('empty','Before').profile;
    const edited={...base,timeZone:'Europe/London',displayName:'My name'};
    const current={...base,revision:8,timeZone:'America/New_York',theme:'light' as const};
    const result=mergeSettingsPreferences(base,edited,current);
    expect(result.conflicts).toEqual(['timeZone']);
    expect(result.profile.timeZone).toBe('Europe/London');expect(result.profile.theme).toBe('light');
    const reviewed=mergeSettingsPreferences(current,result.profile,current);
    expect(reviewed.conflicts).toEqual([]);expect(reviewed.changedFields).toEqual(['displayName','timeZone']);
  });
  it('does not create a conflict when both copies chose the same value or all edits were reverted',()=>{
    const base=seedGame('empty').profile;
    const edited={...base,timeZone:'Europe/London'};
    const current={...base,revision:9,timeZone:'Europe/London'};
    expect(mergeSettingsPreferences(base,edited,current).conflicts).toEqual([]);
    expect(settingsChangedFields(base,{...base})).toEqual([]);
    expect(mergeSettingsPreferences(base,base,current).profile).toEqual(current);
  });
  it('does not transfer stale equipment, experience, audio or metadata as preference edits',()=>{
    const base=seedGame('demo').profile;
    const current={...base,revision:12,equipment:{emblem:'',accessory:'',outfit:''},lastSkillId:'french',celebrationIds:['atelier-stage-1']};
    const result=mergeSettingsPreferences(base,{...base,motion:'reduced'},current);
    expect(result.conflicts).toEqual([]);expect(result.changedFields).toEqual(['motion']);
    expect(result.profile.equipment).toEqual(current.equipment);expect(result.profile.celebrationIds).toEqual(current.celebrationIds);expect(result.profile.revision).toBe(12);
    expect(()=>mergeSettingsPreferences(base,base,{...current,id:'other-profile'})).toThrow('different profile');
  });
});
