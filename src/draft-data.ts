import { z } from 'zod';
import type { DraftJSON } from './types';
import { REGIONS } from './catalog';

const forbidden = /^(?:__proto__|constructor|prototype|password|passwd|credential[s]?|secret|api[-_]?key|access[-_]?token|refresh[-_]?token|id[-_]?token|authorization|auth|token[s]?)$/i;
/** Draft exports contain JSON work, never SDK/authentication objects. */
export function draftJSON(input: unknown): DraftJSON {
  let count = 0;
  function check(value: unknown, depth = 0): void {
    if (++count > 30000 || depth > 12) throw new Error('Draft is too complex to back up.');
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
    if (typeof value === 'number' && Number.isFinite(value)) return;
    if (Array.isArray(value)) { for (const item of value) check(item, depth + 1); return; }
    if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
      for (const [key, item] of Object.entries(value)) {
        if (forbidden.test(key)) throw new Error('Authentication or unsafe fields cannot be included in a work draft.');
        check(item, depth + 1);
      }
      return;
    }
    throw new Error('A work draft must contain JSON data.');
  }
  // Undefined optional form fields are omitted consistently with JSON exports.
  let value: unknown;
  try { value = JSON.parse(JSON.stringify(input)); } catch { throw new Error('A work draft must contain JSON data.'); }
  check(value);
  if (new TextEncoder().encode(JSON.stringify(value)).length > 1024 * 1024) throw new Error('A single work draft exceeds the 1 MiB limit.');
  return value as DraftJSON;
}
export const backupDraftSchema = z.object({
  name: z.string().min(1).max(160).regex(/^[A-Za-z0-9_.:@-]+$/),
  value: z.unknown().transform(value => draftJSON(value)), updatedAt: z.string().datetime({ offset: true }),
}).strict();

export function mergePresentationDraft(name: string, local: unknown, incoming: DraftJSON): DraftJSON | null {
  if (name !== 'landmark-presentations-v1') return null;
  const a = local as { version?: unknown; seenIds?: unknown[] } | null;
  const b = incoming as { version?: unknown; seenIds?: unknown[] } | null;
  if (a?.version !== 1 || b?.version !== 1 || !Array.isArray(a.seenIds) || !Array.isArray(b.seenIds)) return null;
  const seen = new Set([...a.seenIds,...b.seenIds]);
  return { version: 1, seenIds: REGIONS.flatMap(r=>[1,2,3].map(stage=>`${r.id}:${stage}`)).filter(id=>seen.has(id)) };
}
