import { describe, expect, it } from 'vitest';
import { seedGame } from '../domain';
import type { Activity, Affinity } from '../types';
import { decodeCloudRecord, encodeCloudRecord, wireDecimal } from './wire-codec';
import type { CloudRecord } from './types';
const six: Affinity[] = [{ attribute: 'charisma', percent: 0 }, { attribute: 'creativity', percent: 12.5 }, { attribute: 'discipline', percent: 37.5 }, { attribute: 'wisdom', percent: 0 }, { attribute: 'intelligence', percent: 25 }, { attribute: 'strength', percent: 25 }];
function skillRecord(): CloudRecord { const skill = { ...seedGame('empty').skills[0], revision: 1, affinities: six }; return { kind: 'skills', entityId: skill.id, revision: 1, sequence: 1, commandId: 'first', data: skill }; }
function activityRecord(count: number): CloudRecord { const game = seedGame('empty'), stamp = new Date().toISOString(); const activity: Activity = { id: 'practice', revision: 1, createdAt: stamp, updatedAt: stamp, title: 'Practice', occurredAt: stamp, localDate: stamp.slice(0, 10), timeZone: 'UTC', source: 'manual', seconds: 3600, note: '', allocations: game.skills.slice(0, count).map((skill, index) => ({ skillId: skill.id, percent: 100 / count, regionId: skill.regionId, affinities: index % 2 ? six.toReversed() : six })) }; return { kind: 'activities', entityId: activity.id, revision: 1, sequence: 2, commandId: 'practice-command', data: activity }; }
describe('versioned private cloud affinity representation', () => {
  it('preserves exact original order, fractional weights, and zero entries without changing canonical input', () => { const record = skillRecord(), original = structuredClone(record); const wire = encodeCloudRecord(record); expect(wire.wireVersion).toBe(3); expect(decodeCloudRecord(wire)).toEqual(original); expect(record).toEqual(original); expect(decodeCloudRecord(wire)).not.toHaveProperty('wireVersion'); });
  it.each([2, 8])('round-trips all six historical affinities across %i skill allocations', count => { const record = activityRecord(count); expect(decodeCloudRecord(encodeCloudRecord(record))).toEqual(record); });
  it('accepts legacy cloud arrays without a version while rejecting unsupported future envelopes', () => { const legacy=skillRecord();expect(decodeCloudRecord(legacy)).toEqual(legacy); expect(() => decodeCloudRecord({ ...encodeCloudRecord(skillRecord()), wireVersion: 4 })).toThrow('newer version'); });
  it('rejects duplicate or unknown attributes, invalid totals, nonfinite weights and unbounded strings', () => {
    const wire = encodeCloudRecord(skillRecord());
    for (const affinities of ['720:1:100:0','-1:1:100:0','0:2:99:0','0:2:NaN:0','0:2:100:NaN','0:7:100:0','0:1:100.0005:0','0:2:1e2:0','0:2:100:'+'9'.repeat(1701)]) expect(() => decodeCloudRecord({ ...wire, data: { ...wire.data, affinities } })).toThrow();
    expect(() => decodeCloudRecord({ ...wire, token: 'unexpected' })).toThrow();
  });
  it('expands tiny scientific-notation percentages without losing their original numeric values', () => {
    for (const value of [5e-324, 1e-100, 2.34e-7, 0, 12.5, 100]) { const encoded = wireDecimal(value); expect(encoded).not.toContain('e'); expect(Number(encoded)).toBe(value); }
    const record = skillRecord(); record.data = { ...record.data, affinities: [{ attribute: 'strength', percent: 5e-324 }, { attribute: 'wisdom', percent: 100 }] } as typeof record.data;
    expect(decodeCloudRecord(encodeCloudRecord(record))).toEqual(record);
  });
  it('round-trips every six-attribute permutation without changing its order',()=>{
    const attrs=six.map(item=>item.attribute);
    const permutations=(values:typeof attrs):typeof attrs[]=>values.length?values.flatMap((value,index)=>permutations(values.filter((_,i)=>i!==index)).map(tail=>[value,...tail])):[[]];
    const seen=new Set<string>();
    for(const order of permutations(attrs)){
      const record=skillRecord();record.data={...record.data,affinities:order.map((attribute,index)=>({attribute,percent:index===5?20:16}))} as typeof record.data;
      const encoded=encodeCloudRecord(record);seen.add((encoded.data.affinities as string).split(':')[0]);expect(decodeCloudRecord(encoded)).toEqual(record);
    }
    expect(seen.size).toBe(720);
  });
  it('keeps unversioned arrays and version-two ordered strings readable',()=>{
    const record=skillRecord();const legacy={...record,wireVersion:2,data:{...record.data,affinities:six.map(item=>`${item.attribute}:${item.percent}`).join('|')}};
    expect(decodeCloudRecord(legacy)).toEqual(record);
    const activity=activityRecord(2);const source=activity.data as Activity;
    const old={...activity,wireVersion:2,data:{...source,allocations:source.allocations.map(item=>`${item.skillId}~${item.regionId}~${item.percent}~${item.affinities.map(affinity=>`${affinity.attribute}:${affinity.percent}`).join('|')}`).join(';')}};
    expect(decodeCloudRecord(old)).toEqual(activity);
  });

});
