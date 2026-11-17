import Dexie, { type Table } from 'dexie';
import type { CloudRecord, SyncConflict, SyncMetadata } from './cloud/types';
import { z } from 'zod';
import { experienceSchema } from './experience/preferences';
import { audioPreferencesSchema } from './audio-preferences';
import { projectGame } from './domain';
import { backupDraftSchema, draftJSON, mergePresentationDraft } from './draft-data';
import type {
  Backup, BackupDraft, Command, ConsumedDraft, EntityKind, GameData, GameEntity, Mutation, StoredRecord,
} from './types';

export const SCHEMA_VERSION = 1;
export const RULES_VERSION = 1;
export const EXPORT_VERSION = 2;
const SNAPSHOT_LIMIT = 7;
const MAX_BACKUP_BYTES = 25 * 1024 * 1024;
export const ENTITY_KINDS: EntityKind[] = [
  'profile', 'skills', 'activities', 'quests', 'projects', 'outputs', 'books', 'journals', 'focusSessions',
];

const identifier = z.string().min(1).max(160).regex(/^[A-Za-z0-9_.:@-]+$/);
const text = (max: number, min = 0) => z.string().min(min).max(max);
const instant = z.string().datetime({ offset: true });
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Invalid calendar date');
const timeZone = text(100, 1).refine(value => {
  try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; }
}, 'Invalid time zone');
const attribute = z.enum(['strength', 'intelligence', 'wisdom', 'discipline', 'creativity', 'charisma']);
const region = z.enum(['observatory', 'foundry', 'atelier', 'training', 'citadel', 'sanctuary']);
const base = {
  id: identifier, revision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  createdAt: instant, updatedAt: instant, deleted: z.boolean().optional(),
};
const affinities = z.array(z.object({ attribute, percent: z.number().min(0).max(100) }).strict())
  .min(1).max(6).refine(items => Math.abs(items.reduce((sum, item) => sum + item.percent, 0) - 100) < 0.001,
    'Affinity percentages must total 100')
  .refine(items => new Set(items.map(item => item.attribute)).size === items.length, 'Duplicate attribute');
const allocation = z.object({ skillId: identifier, percent: z.number().min(0).max(100), regionId: region, affinities }).strict();
const entitySchemas = {
  profile: z.object({
    ...base, displayName: text(80), avatarColor: text(40, 1), avatarStyle: z.enum(['wanderer', 'scholar', 'maker']),
    equipment: z.object({ emblem: text(160), accessory: text(160), outfit: text(160) }).strict(),
    timeZone, onboardingStep: z.number().int().min(0).max(100), onboardingComplete: z.boolean(),
    lastSkillId: text(160), motion: z.enum(['system', 'reduced', 'full']), sound: z.boolean(),
    theme: z.enum(['dark', 'light', 'system']), lastOpenedAt: instant, lastExportAt: instant.optional(),
    celebrationIds: z.array(identifier).max(10000),
    experience: experienceSchema.optional(),
    audio: audioPreferencesSchema.optional(),
  }).strict().refine(value => !value.deleted, 'A profile cannot be deleted'),
  skills: z.object({
    ...base, name: text(120, 1), description: text(10000), category: text(100, 1), regionId: region,
    affinities, icon: text(80, 1), equipped: z.boolean(), archived: z.boolean(), custom: z.boolean().optional(),
  }).strict(),
  activities: z.object({
    ...base, title: text(200, 1), seconds: z.number().int().min(0).max(86400),
    allocations: z.array(allocation).min(1).max(8)
      .refine(items => Math.abs(items.reduce((sum, item) => sum + item.percent, 0) - 100) < 0.001, 'Allocation percentages must total 100')
      .refine(items => new Set(items.map(item => item.skillId)).size === items.length, 'Duplicate skill allocation'),
    occurredAt: instant, localDate: dateOnly, timeZone, note: text(50000), source: z.enum(['manual', 'focus', 'reading']),
    questId: identifier.optional(), projectId: identifier.optional(), focusSessionId: identifier.optional(),
    bookId: identifier.optional(), startedAt: instant.optional(), endedAt: instant.optional(),
  }).strict(),
  quests: z.object({
    ...base, title: text(200, 1), skillId: identifier, projectId: identifier.optional(), objectiveId: identifier.optional(), parentId: identifier.optional(),
    dueDate: dateOnly.optional(), status: z.enum(['pending', 'completed', 'skipped']), archived: z.boolean(),
    priority: z.boolean(), recurrence: z.enum(['none', 'daily', 'weekdays', 'weekly']),
    occurrenceOf: identifier.optional(), completedAt: instant.optional(), note: text(50000),
    skippedAt: instant.optional(), originalDueDate: dateOnly.optional(),
    scheduleHistory: z.array(z.object({ id: identifier, at: instant, from: dateOnly.optional(), to: dateOnly.optional() }).strict()).max(1000).optional(),
  }).strict(),
  projects: z.object({
    ...base, title: text(200, 1), description: text(50000), outputCriterion: text(10000),
    skillId: identifier, regionId: region, status: z.enum(['draft', 'active', 'paused', 'completed']),
    archived: z.boolean(), targetDate: dateOnly.optional(), effortTargetSeconds: z.number().int().min(0).max(31536000),
    objectives: z.array(z.object({ id: identifier, title: text(500, 1), required: z.boolean(), completed: z.boolean() }).strict()).max(100).refine(items => new Set(items.map(o => o.id)).size === items.length, 'Duplicate objective IDs'),
    completedAt: instant.optional(),
  }).strict(),
  outputs: z.object({
    ...base, title: text(200, 1), description: text(50000), skillId: identifier, regionId: region,
    projectId: identifier.optional(), bookId: identifier.optional(), confirmedAt: instant,
  }).strict(),
  books: z.object({
    ...base, title: text(200, 1), author: text(200), status: z.enum(['wishlist', 'reading', 'paused', 'completed']),
    pages: z.number().int().min(0).max(100000), totalPages: z.number().int().min(0).max(100000),
    skillId: identifier, notes: text(50000), archived: z.boolean(),
  }).strict().refine(value => value.totalPages === 0 || value.pages <= value.totalPages, 'Pages read exceed total pages'),
  journals: z.object({
    ...base, title: text(200), body: text(100000), date: dateOnly,
    activityId: identifier.optional(), projectId: identifier.optional(), bookId: identifier.optional(), milestoneId: identifier.optional(),
  }).strict(),
  focusSessions: z.object({
    ...base, skillId: identifier, questId: identifier.optional(), projectId: identifier.optional(),
    targetSeconds: z.number().int().min(1).max(86400).nullable(),
    status: z.enum(['running', 'paused', 'review', 'completed', 'discarded']),
    segments: z.array(z.object({ start: z.number().finite().min(0), end: z.number().finite().min(0).optional() }).strict()
      .refine(value => value.end === undefined || value.end >= value.start, 'A segment ends before it starts')).max(2000),
    confirmedSeconds: z.number().int().min(0).max(86400).optional(),
    continuationNote: text(2000).optional(),
    continuationQuestId: identifier.optional(),
  }).strict().refine(value => value.segments.filter(segment => segment.end === undefined).length <= 1, 'Multiple running segments'),
};
const gameSchema = z.object({
  profile: entitySchemas.profile,
  skills: z.array(entitySchemas.skills).max(10000), activities: z.array(entitySchemas.activities).max(100000),
  quests: z.array(entitySchemas.quests).max(100000), projects: z.array(entitySchemas.projects).max(10000),
  outputs: z.array(entitySchemas.outputs).max(100000), books: z.array(entitySchemas.books).max(10000),
  journals: z.array(entitySchemas.journals).max(100000), focusSessions: z.array(entitySchemas.focusSessions).max(100000),
}).strict();
const mutationSchema = z.object({
  kind: z.enum(ENTITY_KINDS as [EntityKind, ...EntityKind[]]), entity: z.unknown(),
  expectedRevision: z.number().int().min(0).optional(),
}).strict();
const commandSchema = z.object({
  id: identifier, accountId: text(200, 1), mutations: z.array(mutationSchema).min(1).max(2000),
  createdAt: instant, status: z.enum(['pending', 'synced', 'conflict', 'failed']),
  schemaVersion: z.literal(SCHEMA_VERSION), rulesVersion: z.literal(RULES_VERSION), error: text(2000).optional(),
}).strict();
const backupSchema = z.object({
  format: z.literal('pros-backup'), version: z.union([z.literal(1), z.literal(EXPORT_VERSION)]), rulesVersion: z.literal(RULES_VERSION),
  exportedAt: instant, accountId: text(200, 1), data: gameSchema, pendingCommands: z.array(commandSchema).max(20000),
  drafts: z.array(backupDraftSchema).max(2000).optional(),
}).strict().refine(value => value.version !== EXPORT_VERSION || value.drafts !== undefined, 'Version 2 backups must include drafts');

interface UndoEntry { kind: EntityKind; entityId: string; before: GameEntity | null; afterRevision: number }
interface UndoRecord { accountId: string; commandId: string; entries: UndoEntry[]; undoneAt?: string }
export interface SnapshotSummary { id: string; accountId: string; createdAt: string; recordCount: number }
interface SnapshotRecord extends SnapshotSummary { data: GameData; drafts?: BackupDraft[] }
interface DraftRecord { key: string; accountId: string; name: string; value: unknown; updatedAt: string }

export class ProsDatabase extends Dexie {
  records!: Table<StoredRecord, string>;
  commands!: Table<Command, [string, string]>;
  undos!: Table<UndoRecord, [string, string]>;
  snapshots!: Table<SnapshotRecord, string>;
  drafts!: Table<DraftRecord, string>;
  cloudRecords!: Table<CloudRecord & { key: string; accountId: string }, string>;
  syncMetadata!: Table<SyncMetadata, string>;
  syncConflicts!: Table<SyncConflict, string>;
  constructor(name = 'pros-local-v1') {
    super(name);
    this.version(1).stores({
      records: '&key,accountId,[accountId+kind]',
      commands: '[accountId+id],accountId,[accountId+status],createdAt',
      undos: '[accountId+commandId],accountId', snapshots: '&id,accountId,[accountId+createdAt]',
      drafts: '&key,accountId',
    });
    this.version(2).stores({ cloudRecords: '&key,accountId', syncMetadata: '&accountId', syncConflicts: '&key,accountId' });
  }
}
export const db = new ProsDatabase();
const copy = <T>(value: T): T => structuredClone(value);
const now = () => new Date().toISOString();
const uid = () => globalThis.crypto.randomUUID();
function assertAccount(accountId: string): void {
  if (!/^(demo|local:[A-Za-z0-9_-]{1,128}|firebase:[A-Za-z0-9_-]{1,128})$/.test(accountId)) {
    throw new Error('Invalid account namespace. Use demo, local:<id>, or firebase:<uid>.');
  }
}
export function recordKey(accountId: string, kind: EntityKind, id: string): string {
  return `${accountId}\u0000${kind}\u0000${kind === 'profile' ? 'singleton' : id}`;
}
export function mutationKey(kind: EntityKind, id: string): string { return kind === 'profile' ? 'profile' : `${kind}:${id}`; }
export function parseEntity(kind: EntityKind, input: unknown): GameEntity {
  return entitySchemas[kind].parse(input) as GameEntity;
}
export function validateGame(input: unknown): GameData {
  const result = gameSchema.parse(input) as GameData;
  for (const kind of ENTITY_KINDS) {
    if (kind === 'profile') continue;
    const values = result[kind];
    if (new Set(values.map(value => value.id)).size !== values.length) throw new Error(`Duplicate ${kind} IDs in backup.`);
  }
  const skills = new Set(result.skills.map(value => value.id));
  for (const kind of ['quests', 'projects', 'outputs', 'books', 'focusSessions'] as const) {
    for (const value of result[kind]) if (!skills.has(value.skillId)) throw new Error(`${kind}:${value.id} references an unknown skill.`);
  }
  for (const activity of result.activities) {
    for (const value of activity.allocations) if (!skills.has(value.skillId)) throw new Error(`Activity ${activity.id} references an unknown skill.`);
  }
  const quests = new Map(result.quests.map(q => [q.id,q])); const checked = new Set<string>();
  for (const quest of result.quests) {
    const path = new Set<string>(); let current: typeof quest | undefined = quest;
    while (current && !current.deleted && !checked.has(current.id)) {
      if (path.has(current.id)) throw new Error('Quest hierarchy contains a cycle.');
      path.add(current.id); current = current.parentId ? quests.get(current.parentId) : undefined;
    }
    for (const id of path) checked.add(id);
  }
  return result;
}
export function gameMutations(data: GameData): Mutation[] {
  return ENTITY_KINDS.flatMap(kind => (kind === 'profile' ? [data.profile] : data[kind]).map(entity => ({ kind, entity })));
}
function comparable(entity: GameEntity): string {
  const { revision: _revision, createdAt: _created, updatedAt: _updated, ...rest } = entity;
  return JSON.stringify(rest, Object.keys(rest).sort());
}
function identical(a: unknown, b: unknown): boolean {
  function stable(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, val]) => [key, stable(val)]));
    return value;
  }
  return JSON.stringify(stable(a)) === JSON.stringify(stable(b));
}
function sameContents(a: GameEntity, b: GameEntity): boolean {
  const { revision: _ar, createdAt: _ac, updatedAt: _au, ...aa } = a;
  const { revision: _br, createdAt: _bc, updatedAt: _bu, ...bb } = b;
  return identical(aa, bb);
}

export class StorageConflictError extends Error {
  readonly conflicts: string[];
  constructor(message: string, conflicts: string[]) { super(message); this.name = 'StorageConflictError'; this.conflicts = conflicts; }
}
export class DraftConflictError extends Error {
  constructor(readonly current: { value: unknown; updatedAt: string } | null) { super('Another copy of this draft changed. Review both versions before replacing either.'); this.name='DraftConflictError'; }
}

export async function loadGame(accountId: string): Promise<GameData | null> {
  assertAccount(accountId);
  const records = await db.records.where('accountId').equals(accountId).toArray();
  const profile = records.find(record => record.kind === 'profile');
  if (!profile) return null;
  const data: Record<string, unknown> = { profile: copy(profile.data) };
  for (const kind of ENTITY_KINDS) if (kind !== 'profile') data[kind] = records.filter(record => record.kind === kind).map(record => copy(record.data));
  return data as unknown as GameData;
}

export async function snapshotWithinTransaction(accountId: string, data: GameData): Promise<SnapshotSummary> {
  const snapshot: SnapshotRecord = {
    id: uid(), accountId, createdAt: now(), data: copy(data),
    recordCount: gameMutations(data).length, drafts: await listDrafts(accountId),
  };
  await db.snapshots.add(snapshot);
  const rows = await db.snapshots.where('accountId').equals(accountId).sortBy('createdAt');
  if (rows.length > SNAPSHOT_LIMIT) await db.snapshots.bulkDelete(rows.slice(0, rows.length - SNAPSHOT_LIMIT).map(row => row.id));
  const { data: _data, drafts: _drafts, ...summary } = snapshot;
  return summary;
}

export async function initializeGame(accountId: string, data: GameData): Promise<void> {
  assertAccount(accountId);
  const valid = validateGame(data);
  await db.transaction('rw', db.records, db.snapshots, db.drafts, async () => {
    if (await db.records.where('accountId').equals(accountId).count()) return;
    await db.records.bulkAdd(gameMutations(valid).map(({ kind, entity }) => ({
      key: recordKey(accountId, kind, entity.id), accountId, kind, entityId: entity.id,
      revision: entity.revision, data: copy(entity),
    })));
    await snapshotWithinTransaction(accountId, valid);
  });
}

async function commitWithinTransaction(accountId: string, mutations: Mutation[], commandId: string, cleanupEquipment = true): Promise<Command> {
  const existing = await db.commands.get([accountId, commandId]);
  // The stable command ID is the idempotency boundary, including a lost acknowledgement.
  if (existing) return copy(existing);
  if (!mutations.length || mutations.length > 2000) throw new Error('A command needs 1–2000 mutations.');
  const seen = new Set<string>();
  const normalized: Mutation[] = [];
  const undo: UndoEntry[] = [];
  const stamp = now();
  // First use of the new preferences creates a recovery point before any writes.
  if (mutations.some(m => m.kind === 'profile' && (('experience' in m.entity && m.entity.experience) || ('audio' in m.entity && m.entity.audio)))) {
    const before = await loadGame(accountId);
    if (before && mutations.some(m => m.kind === 'profile' && (('experience' in m.entity && m.entity.experience && !before.profile.experience) || ('audio' in m.entity && m.entity.audio && !before.profile.audio)))) await snapshotWithinTransaction(accountId, before);
  }
  for (const mutation of mutations) {
    if (!ENTITY_KINDS.includes(mutation.kind)) throw new Error('Unknown entity collection.');
    const parsed = parseEntity(mutation.kind, mutation.entity);
    const key = recordKey(accountId, mutation.kind, parsed.id);
    if (seen.has(key)) throw new Error('One command cannot change the same record twice.');
    seen.add(key);
    const current = await db.records.get(key);
    const expected = mutation.expectedRevision ?? parsed.revision;
    if (current && expected !== current.revision) throw new StorageConflictError('This record changed. Reload it before saving.', [mutationKey(mutation.kind, parsed.id)]);
    if (!current && mutation.expectedRevision !== undefined && mutation.expectedRevision !== 0) throw new StorageConflictError('The record no longer exists.', [mutationKey(mutation.kind, parsed.id)]);
    const entity = parseEntity(mutation.kind, {
      ...parsed, revision: (current?.revision ?? 0) + 1,
      createdAt: current?.data.createdAt ?? parsed.createdAt, updatedAt: stamp,
    });
    if (mutation.kind === 'profile' && current && current.entityId !== entity.id) throw new Error('Profile ID cannot change.');
    normalized.push({ kind: mutation.kind, entity, expectedRevision: current?.revision ?? 0 });
    undo.push({ kind: mutation.kind, entityId: entity.id, before: current ? copy(current.data) : null, afterRevision: entity.revision });
    await db.records.put({ key, accountId, kind: mutation.kind, entityId: entity.id, revision: entity.revision, data: copy(entity) });
  }
  // Validate after all writes, within the same transaction: invalid references roll everything back.
  const next = validateGame(await loadGame(accountId));
  if (normalized.some(m => m.kind === 'focusSessions' && (m.entity as import('./types').FocusSession).status === 'running' && undo.some(u => u.entityId === m.entity.id && !u.before)) && next.focusSessions.filter(s => !s.deleted && ['running', 'paused', 'review'].includes(s.status)).length > 1) {
    throw new Error('A focus session is already open. Return to it before starting another.');
  }
  // Cosmetic cleanup belongs to the same command/Undo as the correction that caused it.
  const eligible = projectGame(next).eligibleCosmetics;
  const equipment = { ...next.profile.equipment };
  let changed = false;
  for (const slot of ['emblem', 'accessory', 'outfit'] as const) {
    if (equipment[slot] && !equipment[slot].startsWith('starter-') && !eligible.includes(equipment[slot])) { equipment[slot] = ''; changed = true; }
  }
  if (changed && cleanupEquipment) {
    const index = normalized.findIndex(m => m.kind === 'profile');
    const revision = next.profile.revision + (index < 0 ? 1 : 0);
    const entity = parseEntity('profile', { ...next.profile, equipment, revision, updatedAt: stamp });
    if (index >= 0) normalized[index] = { ...normalized[index], entity };
    else {
      normalized.push({ kind: 'profile', entity, expectedRevision: next.profile.revision });
      undo.push({ kind: 'profile', entityId: entity.id, before: copy(next.profile), afterRevision: revision });
    }
    await db.records.put({ key: recordKey(accountId, 'profile', entity.id), accountId, kind: 'profile', entityId: entity.id, revision, data: copy(entity) });
  }
  const command: Command = { id: commandId, accountId, mutations: normalized, createdAt: stamp, status: 'pending', schemaVersion: SCHEMA_VERSION, rulesVersion: RULES_VERSION };
  await db.commands.add(command);
  await db.undos.add({ accountId, commandId, entries: undo });
  return copy(command);
}

export async function commitMutations(accountId: string, mutations: Mutation[], commandId: string = uid(), consumedDraft?: ConsumedDraft): Promise<Command> {
  assertAccount(accountId); identifier.parse(commandId);
  const name = typeof consumedDraft === 'string' ? consumedDraft : consumedDraft?.name;
  if (name) identifier.parse(name);
  return db.transaction('rw', db.records, db.commands, db.undos, db.snapshots, db.drafts, async () => {
    const replay = await db.commands.get([accountId,commandId]);
    if (consumedDraft && typeof consumedDraft !== 'string' && !replay) {
      const draft = await loadDraftRecord(accountId,consumedDraft.name);
      if (!draft || !identical(draft.value,draftJSON(consumedDraft.value))) throw new DraftConflictError(draft);
    }
    const command = await commitWithinTransaction(accountId, mutations, commandId);
    if (name) await clearDraft(accountId, name, commandId, typeof consumedDraft === 'object' ? consumedDraft.value : undefined);
    return command;
  });
}

export async function undoCommand(accountId: string, commandId: string): Promise<void> {
  assertAccount(accountId);
  await db.transaction('rw', db.records, db.commands, db.undos, db.snapshots, db.drafts, async () => {
    const undo = await db.undos.get([accountId, commandId]);
    if (!undo) throw new Error('This action is not available to undo on this device.');
    if (undo.undoneAt) return;
    const mutations: Mutation[] = [];
    for (const entry of undo.entries) {
      const current = await db.records.get(recordKey(accountId, entry.kind, entry.entityId));
      if (!current || current.revision !== entry.afterRevision) throw new StorageConflictError('A record changed after this action. Undo would overwrite newer work.', [mutationKey(entry.kind, entry.entityId)]);
      const entity = entry.before ? { ...entry.before, revision: current.revision } : { ...current.data, deleted: true };
      mutations.push({ kind: entry.kind, entity, expectedRevision: current.revision });
    }
    await commitWithinTransaction(accountId, mutations, `undo:${commandId}`);
    await db.undos.update([accountId, commandId], { undoneAt: now() });
  });
}

export async function listCommands(accountId: string): Promise<Command[]> {
  assertAccount(accountId);
  return (await db.commands.where('accountId').equals(accountId).sortBy('createdAt')).map(copy);
}

export function validateBackup(input: unknown): Backup {
  // Validation also ensures exports contain no unknown auth/session fields.
  let serialized: string;
  try { serialized = JSON.stringify(input); } catch { throw new Error('Backup must contain JSON data.'); }
  if (!serialized || new TextEncoder().encode(serialized).length > MAX_BACKUP_BYTES) throw new Error('Backup is empty or exceeds the 25 MiB safety limit.');
  const parsed = backupSchema.parse(input) as unknown as Backup;
  assertAccount(parsed.accountId);
  parsed.data = validateGame(parsed.data);
  const commandIds = new Set<string>();
  for (const command of parsed.pendingCommands) {
    if (command.accountId !== parsed.accountId) throw new Error('Backup contains commands belonging to another account.');
    if (commandIds.has(command.id)) throw new Error('Backup contains duplicate command IDs.');
    commandIds.add(command.id);
    for (const mutation of command.mutations) parseEntity(mutation.kind, mutation.entity);
  }
  if (new Set((parsed.drafts || []).map(d => d.name)).size !== (parsed.drafts || []).length) throw new Error('Backup contains duplicate draft names.');
  return copy(parsed);
}

export async function exportBackup(accountId: string): Promise<Backup> {
  assertAccount(accountId);
  return db.transaction('r', db.records, db.commands, db.drafts, async () => {
    const data = await loadGame(accountId);
    if (!data) throw new Error('No profile exists for this account.');
    const pendingCommands = (await listCommands(accountId)).filter(command => command.status !== 'synced');
    return validateBackup({ format: 'pros-backup', version: EXPORT_VERSION, rulesVersion: RULES_VERSION, exportedAt: now(), accountId, data, pendingCommands, drafts: await listDrafts(accountId) });
  });
}

export interface ImportConflict { key: string; kind: EntityKind; id: string; localRevision: number; backupRevision: number }
export interface ImportPreview { newRecords: number; unchangedRecords: number; conflicts: ImportConflict[]; sourceAccountId: string; targetAccountId: string; reviewToken: string; newDrafts: number; unchangedDrafts: number; mergedDrafts: number; draftConflicts: { key: string; name: string; localUpdatedAt: string; backupUpdatedAt: string }[] }
export type ImportResolutions = Record<string, 'keep-local' | 'use-backup'>;

// A compact change detector for the versions shown in the import review. This
// is not a security credential; ownership is still enforced by account paths.
function importReviewToken(state: unknown): string {
  const serialized = JSON.stringify(state);
  let first = 2166136261, second = 0x9e3779b9;
  for (let index = 0; index < serialized.length; index++) {
    const code = serialized.charCodeAt(index);
    first = Math.imul(first ^ code, 16777619);
    second = Math.imul(second ^ code, 2246822519);
  }
  return `${(first >>> 0).toString(16).padStart(8, '0')}${(second >>> 0).toString(16).padStart(8, '0')}`;
}

async function previewWithinTransaction(accountId: string, backup: Backup): Promise<ImportPreview> {
  const result: ImportPreview = { newRecords: 0, unchangedRecords: 0, conflicts: [], sourceAccountId: backup.accountId, targetAccountId: accountId, reviewToken: '', newDrafts: 0, unchangedDrafts: 0, mergedDrafts: 0, draftConflicts: [] };
  const recordVersions: unknown[] = [], draftVersions: unknown[] = [];
  for (const { kind, entity } of gameMutations(backup.data)) {
    const local = await db.records.get(recordKey(accountId, kind, entity.id));
    // Include absent records so a concurrent insertion also invalidates review.
    recordVersions.push([mutationKey(kind, entity.id), local?.entityId ?? null, local?.revision ?? null]);
    if (!local) result.newRecords++;
    else if (sameContents(local.data, kind === 'profile' ? { ...entity, id: local.entityId } : entity)) result.unchangedRecords++;
    else result.conflicts.push({ key: mutationKey(kind, entity.id), kind, id: entity.id, localRevision: local.revision, backupRevision: entity.revision });
  }
  for (const draft of backup.drafts || []) {
    const local = await db.drafts.get(`${accountId}\u0000${draft.name}`);
    // A timestamp alone can collide for edits made within the same millisecond.
    draftVersions.push([draft.name, local?.updatedAt ?? null, local?.value ?? null]);
    const merged = mergePresentationDraft(draft.name,local?.value,draft.value);
    if (local && merged) { if (identical(local.value,merged)) result.unchangedDrafts++; else result.mergedDrafts++; continue; }
    if (!local) result.newDrafts++;
    else if (identical(local.value, draft.value)) result.unchangedDrafts++;
    else result.draftConflicts.push({ key: `draft:${draft.name}`, name: draft.name, localUpdatedAt: local.updatedAt, backupUpdatedAt: draft.updatedAt });
  }
  result.reviewToken = importReviewToken([accountId, backup.accountId, recordVersions, draftVersions]);
  return result;
}

export async function previewImport(accountId: string, input: Backup): Promise<ImportPreview> {
  assertAccount(accountId); const backup = validateBackup(input);
  return db.transaction('r', db.records, db.drafts, () => previewWithinTransaction(accountId, backup));
}

// Recovery can contain more records than a normal UI command. Chunk the outbox
// receipts, but stay inside the caller's transaction so the recovery is atomic.
async function commitRecoveryMutations(accountId: string, mutations: Mutation[]): Promise<void> {
  const size = accountId.startsWith('firebase:') ? 40 : 2000;
  for (let offset = 0; offset < mutations.length; offset += size) {
    await commitWithinTransaction(accountId, mutations.slice(offset, offset + size), uid(), offset + size >= mutations.length);
  }
}

export async function importBackup(accountId: string, input: Backup, resolutions: ImportResolutions = {}, expectedPreview?: ImportPreview): Promise<void> {
  assertAccount(accountId); const backup = validateBackup(input);
  await db.transaction('rw', db.records, db.commands, db.undos, db.snapshots, db.drafts, async () => {
    const preview = await previewWithinTransaction(accountId, backup);
    if (expectedPreview && (expectedPreview.targetAccountId !== accountId || expectedPreview.sourceAccountId !== backup.accountId || expectedPreview.reviewToken !== preview.reviewToken)) {
      throw new StorageConflictError('Saved records or drafts changed after this preview. Review the backup again before importing. No records were changed.', ['import-preview']);
    }
    const unresolved = preview.conflicts.filter(conflict => !resolutions[conflict.key]);
    const unresolvedDrafts = preview.draftConflicts.filter(conflict => !resolutions[conflict.key]);
    if (unresolved.length || unresolvedDrafts.length) throw new StorageConflictError('Import needs a choice for each conflicting record or draft. No records were changed.', [...unresolved.map(c => c.key), ...unresolvedDrafts.map(c => c.key)]);
    const existing = await loadGame(accountId);
    if (existing) await snapshotWithinTransaction(accountId, existing);
    const mutations: Mutation[] = [];
    for (const { kind, entity: incoming } of gameMutations(backup.data)) {
      const local = await db.records.get(recordKey(accountId, kind, incoming.id));
      const entity = kind === 'profile' && local ? { ...incoming, id: local.entityId } : incoming;
      if (local && (sameContents(local.data, entity) || resolutions[mutationKey(kind, incoming.id)] === 'keep-local')) continue;
      mutations.push({ kind, entity: { ...entity, revision: local?.revision ?? 0 }, expectedRevision: local?.revision ?? 0 });
    }
    await commitRecoveryMutations(accountId, mutations);
    const imported = await loadGame(accountId);
    for (const draft of backup.drafts || []) {
      const local = await db.drafts.get(`${accountId}\u0000${draft.name}`);
      if (local && resolutions[`draft:${draft.name}`] === 'keep-local') continue;
      const value = mergePresentationDraft(draft.name,local?.value,draft.value) || rebaseImportedDraft(draft, backup.data, imported!);
      await db.drafts.put({ key: `${accountId}\u0000${draft.name}`, accountId, ...draft, value });
    }
    // Source-device command receipts are not replayed into the target account: the
    // imported records already contain their results. A fresh target command is queued.
  });
}

export async function saveSnapshot(accountId: string): Promise<SnapshotSummary> {
  assertAccount(accountId);
  return db.transaction('rw', db.records, db.snapshots, db.drafts, async () => {
    const data = await loadGame(accountId);
    if (!data) throw new Error('No profile exists for this account.');
    return snapshotWithinTransaction(accountId, data);
  });
}
export async function listSnapshots(accountId: string): Promise<SnapshotSummary[]> {
  assertAccount(accountId);
  return (await db.snapshots.where('accountId').equals(accountId).sortBy('createdAt')).reverse().map(({ data: _data, drafts: _drafts, ...summary }) => summary);
}
export async function restoreSnapshot(accountId: string, snapshotId: string): Promise<void> {
  assertAccount(accountId);
  await db.transaction('rw', db.records, db.commands, db.undos, db.snapshots, db.drafts, async () => {
    const snapshot = await db.snapshots.get(snapshotId);
    if (!snapshot || snapshot.accountId !== accountId) throw new Error('Snapshot does not belong to this account.');
    const target = validateGame(snapshot.data);
    const current = await loadGame(accountId);
    if (current) await snapshotWithinTransaction(accountId, current);
    const wanted = new Set(gameMutations(target).map(({ kind, entity }) => recordKey(accountId, kind, entity.id)));
    const mutations: Mutation[] = [];
    for (const { kind, entity } of gameMutations(target)) {
      const local = await db.records.get(recordKey(accountId, kind, entity.id));
      if (local && sameContents(local.data, entity)) continue;
      mutations.push({ kind, entity: { ...entity, revision: local?.revision ?? 0 }, expectedRevision: local?.revision ?? 0 });
    }
    for (const local of await db.records.where('accountId').equals(accountId).toArray()) {
      if (!wanted.has(local.key) && !local.data.deleted) mutations.push({ kind: local.kind, entity: { ...local.data, deleted: true }, expectedRevision: local.revision });
    }
    await commitRecoveryMutations(accountId, mutations);
    if (snapshot.drafts) {
      const restored = (await loadGame(accountId))!;
      const presentation = await db.drafts.get(`${accountId}\u0000landmark-presentations-v1`);
      await db.drafts.where('accountId').equals(accountId).delete();
      for (const draft of snapshot.drafts) await db.drafts.put({ key: `${accountId}\u0000${draft.name}`, accountId, ...draft, value: mergePresentationDraft(draft.name,presentation?.value,draft.value) || rebaseImportedDraft(draft, target, restored) });
      if (presentation && !snapshot.drafts.some(d=>d.name==='landmark-presentations-v1')) await db.drafts.put(presentation);
    }
  });
}

function rebaseImportedDraft(draft: BackupDraft, source: GameData, target: GameData): BackupDraft['value'] {
  if (!draft.value || typeof draft.value !== 'object' || Array.isArray(draft.value)) return draft.value;
  const value = { ...draft.value };
  const kinds: Record<string, Exclude<EntityKind, 'profile'>> = { activity: 'activities', project: 'projects', quest: 'quests', schedule: 'quests', book: 'books', output: 'outputs', journal: 'journals', continuation: 'focusSessions' };
  const kind = kinds[draft.name.split(/[:-]/)[0]];
  if (!kind || typeof value.recordId !== 'string' || typeof value.baseRevision !== 'number') return value;
  const original = source[kind].find(e => e.id === value.recordId);
  const current = target[kind].find(e => e.id === value.recordId);
  if (current) {
    // Revisions are local to an installation. A stale source revision can equal
    // a fresh target revision by coincidence; never treat that as edit consent.
    value.baseRevision = original && original.revision === value.baseRevision && sameContents(original, current)
      ? current.revision : -1; // Draft-only sentinel; the form requires explicit review.
  }
  return value;
}
export async function listDrafts(accountId: string): Promise<BackupDraft[]> {
  assertAccount(accountId);
  return (await db.drafts.where('accountId').equals(accountId).sortBy('updatedAt')).reverse().map(({ name, value, updatedAt }) => backupDraftSchema.parse({ name, value, updatedAt }) as BackupDraft);
}
export async function loadDraftRecord(accountId: string, name: string): Promise<{value:unknown;updatedAt:string}|null> {
  assertAccount(accountId); identifier.parse(name); const current=await db.drafts.get(`${accountId}\u0000${name}`);
  return current ? {value:copy(current.value),updatedAt:current.updatedAt} : null;
}
export async function saveDraft(accountId: string, name: string, value: unknown, expected?: {value:unknown}|null): Promise<void> {
  assertAccount(accountId); identifier.parse(name);
  const valid=draftJSON(value);
  await db.transaction('rw',db.drafts,async()=>{
    const current=await loadDraftRecord(accountId,name);
    if (expected !== undefined && (expected === null ? current !== null : !current || !identical(current.value,expected.value))) throw new DraftConflictError(current);
    await db.drafts.put({ key: `${accountId}\u0000${name}`, accountId, name, value: valid, updatedAt: now() });
  });
}
export async function loadDraft<T = unknown>(accountId: string, name: string): Promise<T | null> {
  assertAccount(accountId); identifier.parse(name);
  const record = await db.drafts.get(`${accountId}\u0000${name}`);
  return record ? copy(record.value) as T : null;
}
export async function clearDraft(accountId: string, name: string, expectedCommandId?: string, expectedValue?: unknown): Promise<void> {
  assertAccount(accountId); identifier.parse(name);
  await db.transaction('rw', db.drafts, async () => {
    const key = `${accountId}\u0000${name}`;
    if (expectedCommandId || expectedValue !== undefined) {
      const current = await db.drafts.get(key);
      if (!current || (expectedCommandId && (!current.value || typeof current.value !== 'object' || (current.value as { commandId?: string }).commandId !== expectedCommandId)) || (expectedValue !== undefined && !identical(current.value,draftJSON(expectedValue)))) return;
    }
    await db.drafts.delete(key);
  });
}
export async function deleteAccountData(accountId: string): Promise<void> {
  assertAccount(accountId);
  await db.transaction('rw', [db.records, db.commands, db.undos, db.snapshots, db.drafts, db.cloudRecords, db.syncMetadata, db.syncConflicts], async () => {
    for (const table of [db.records, db.commands, db.undos, db.snapshots, db.drafts, db.cloudRecords, db.syncMetadata, db.syncConflicts]) await table.where('accountId').equals(accountId).delete();
  });
}
