import type { Affinity, AttributeId, Allocation, RegionId } from '../types';
import { validateCloudRecord } from './local-sync';
import type { CloudRecord } from './types';

export const CLOUD_WIRE_VERSION = 2;
const ATTRIBUTES: AttributeId[] = ['strength', 'intelligence', 'wisdom', 'discipline', 'creativity', 'charisma'];
export type WireCloudRecord = Omit<CloudRecord, 'data'> & { wireVersion: 2; data: Record<string, unknown> };
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
function encodeAffinities(items: Affinity[]): string { return items.map(item => `${item.attribute}:${wireDecimal(item.percent)}`).join('|'); }
function decodeAffinities(input: unknown): Affinity[] {
  if (typeof input !== 'string' || input.length > 2300) throw invalid();
  const rows = input.split('|'); if (rows.length < 1 || rows.length > 6) throw invalid();
  const result = rows.map(row => { const fields = row.split(':'); if (fields.length !== 2 || !ATTRIBUTES.includes(fields[0] as AttributeId)) throw invalid(); return { attribute: fields[0] as AttributeId, percent: percent(fields[1]) }; });
  if (new Set(result.map(item => item.attribute)).size !== result.length || Math.abs(result.reduce((sum, item) => sum + item.percent, 0) - 100) >= 0.001) throw invalid();
  return result;
}
function encodeAllocations(items: Allocation[]): string { return items.map(item => `${item.skillId}~${item.regionId}~${wireDecimal(item.percent)}~${encodeAffinities(item.affinities)}`).join(';'); }
function decodeAllocations(input: unknown): Allocation[] {
  if (typeof input !== 'string' || input.length > 23000) throw invalid();
  const rows = input.split(';'); if (rows.length < 1 || rows.length > 8) throw invalid();
  return rows.map(row => { const fields = row.split('~'); if (fields.length !== 4) throw invalid(); return { skillId: fields[0], regionId: fields[1] as RegionId, percent: percent(fields[2]), affinities: decodeAffinities(fields[3]) }; });
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
  if (wireVersion !== CLOUD_WIRE_VERSION) throw new Error('This synchronized record needs a newer version of PROS. Your saved work is preserved.');
  const data = { ...object(canonical.data) };
  if (canonical.kind === 'skills') data.affinities = decodeAffinities(data.affinities);
  if (canonical.kind === 'activities') data.allocations = decodeAllocations(data.allocations);
  return validateCloudRecord({ ...canonical, data } as unknown as CloudRecord);
}
