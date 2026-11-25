import type { Affinity, AttributeId, Allocation, RegionId } from '../types';
import { validateCloudRecord } from './local-sync';
import { encodeComposition, decodeComposition } from './affinity-composition';
import type { CloudRecord } from './types';

export const CLOUD_WIRE_VERSION = 3;
const ATTRIBUTES: AttributeId[] = ['strength', 'intelligence', 'wisdom', 'discipline', 'creativity', 'charisma'];
export type WireCloudRecord = Omit<CloudRecord, 'data'> & { wireVersion: 3; data: Record<string, unknown> };
const invalid = () => new Error('A synchronized record could not be read safely. Your saved work is preserved.');
function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid(); return value as Record<string, unknown>; }
/** Expand scientific notation without arithmetic rounding. Decoding the bounded
 * decimal recovers the exact original canonical JavaScript number. */
export function wireDecimal(value: number): string {
  if (!Number.isFinite(value) || value < 0 || value > 100) throw invalid();
  const text = String(value); if (!text.includes('e')) return text;
  const [coefficient, exponent] = text.split('e'), pieces = coefficient.split('.');
  const digits = pieces.join(''), point = pieces[0].length + Number(exponent);
  return point <= 0 ? `0.${'0'.repeat(-point)}${digits}` : point >= digits.length ? digits + '0'.repeat(point - digits.length) : `${digits.slice(0, point)}.${digits.slice(point)}`;
}
function percent(text: string): number { if (!/^(?:0|[1-9][0-9]?|100)(?:\.[0-9]{1,330})?$/.test(text)) throw invalid(); const value = Number(text); if (!Number.isFinite(value) || value < 0 || value > 100) throw invalid(); return value; }
// A rank selects one of all 720 permutations of the six fixed attributes.
// Taking its first N entries represents every unique ordered subset without
// making Security Rules parse/check 48 repeated attribute names per activity.
const FACTORIAL = [1, 1, 2, 6, 24, 120, 720];
function rankOrder(items: Affinity[]): number {
  const order = [...items.map(item => item.attribute), ...ATTRIBUTES.filter(attribute => !items.some(item => item.attribute === attribute))];
  const available = [...ATTRIBUTES]; let rank = 0;
  for (let index = 0; index < 6; index++) { const position = available.indexOf(order[index]); if (position < 0) throw invalid(); rank += position * FACTORIAL[5-index]; available.splice(position, 1); }
  return rank;
}
function unrankOrder(rank: number): AttributeId[] {
  if (!Number.isInteger(rank) || rank < 0 || rank >= 720) throw invalid();
  const available = [...ATTRIBUTES], result: AttributeId[] = [];
  for (let index=5;index>=0;index--) { const position=Math.floor(rank/FACTORIAL[index]); result.push(available.splice(position,1)[0]);rank%=FACTORIAL[index]; }
  return result;
}
function encodeAffinities(items: Affinity[]): string {
  const encoded=encodeComposition(items.map(item=>wireDecimal(item.percent)));
  return `${rankOrder(items)}:${items.length}:${encoded.total}:${encoded.rank}`;
}
function decodeAffinities(input: unknown): Affinity[] {
  if(typeof input!=='string'||input.length>2300)throw invalid();
  const fields=input.split(':');if(fields.length!==4||!/^(?:0|[1-9][0-9]{0,2})$/.test(fields[0])||!/[1-6]/.test(fields[1])||fields[1].length!==1)throw invalid();
  const order=unrankOrder(Number(fields[0])),weights=decodeComposition(fields[2],fields[3],Number(fields[1]));
  return weights.map((percent,index)=>({attribute:order[index],percent}));
}
function decodeLegacyAffinities(input: unknown): Affinity[] {
  if(typeof input!=='string'||input.length>2300)throw invalid();
  const rows=input.split('|');if(rows.length<1||rows.length>6)throw invalid();
  const result=rows.map(row=>{const fields=row.split(':');if(fields.length!==2||!ATTRIBUTES.includes(fields[0] as AttributeId))throw invalid();return {attribute:fields[0] as AttributeId,percent:percent(fields[1])};});
  if(new Set(result.map(item=>item.attribute)).size!==result.length||Math.abs(result.reduce((sum,item)=>sum+item.percent,0)-100)>=0.001)throw invalid();return result;
}
function encodeAllocations(items: Allocation[]): string {
  return `${items.map(item=>wireDecimal(item.percent)).join('|')}#${items.map(item=>`${item.skillId}~${item.regionId}~${encodeAffinities(item.affinities)}`).join(';')}`;
}
function decodeAllocations(input: unknown, legacy=false): Allocation[] {
  if(typeof input!=='string'||input.length>23000)throw invalid();
  if(legacy){const rows=input.split(';');if(rows.length<1||rows.length>8)throw invalid();return rows.map(row=>{const fields=row.split('~');if(fields.length!==4)throw invalid();return {skillId:fields[0],regionId:fields[1] as RegionId,percent:percent(fields[2]),affinities:decodeLegacyAffinities(fields[3])};});}
  const parts=input.split('#');if(parts.length!==2)throw invalid();const weights=parts[0].split('|'),rows=parts[1].split(';');
  if(rows.length<1||rows.length>8||weights.length!==rows.length)throw invalid();
  return rows.map((row,index)=>{const fields=row.split('~');if(fields.length!==3)throw invalid();return {skillId:fields[0],regionId:fields[1] as RegionId,percent:percent(weights[index]),affinities:decodeAffinities(fields[2])};});
}
/** Only the Firestore wire representation changes. Command fingerprints, local
 * canonical records, XP affinity snapshots, exports and original order do not. */
export function encodeCloudRecord(input: CloudRecord): WireCloudRecord {
  const canonical = validateCloudRecord(input); const data = { ...canonical.data } as unknown as Record<string, unknown>;
  if (canonical.kind === 'skills') data.affinities = encodeAffinities(data.affinities as Affinity[]);
  if (canonical.kind === 'activities') data.allocations = encodeAllocations(data.allocations as Allocation[]);
  return { ...canonical, wireVersion: CLOUD_WIRE_VERSION, data };
}
export function decodeCloudRecord(input: unknown): CloudRecord {
  const value = object(input);
  if (Object.keys(value).some(key => !['kind', 'entityId', 'data', 'revision', 'sequence', 'commandId', 'wireVersion'].includes(key))) throw invalid();
  const { wireVersion, ...canonical } = value;
  // Earlier installations wrote canonical arrays without an envelope version.
  if (wireVersion === undefined) return validateCloudRecord(canonical as unknown as CloudRecord);
  if (wireVersion !== CLOUD_WIRE_VERSION && wireVersion !== 2) throw new Error('This synchronized record needs a newer version of PROS. Your saved work is preserved.');
  const data = { ...object(canonical.data) };
  if (canonical.kind === 'skills') data.affinities = wireVersion===2?decodeLegacyAffinities(data.affinities):decodeAffinities(data.affinities);
  if (canonical.kind === 'activities') data.allocations = decodeAllocations(data.allocations,wireVersion===2);
  return validateCloudRecord({ ...canonical, data } as unknown as CloudRecord);
}
