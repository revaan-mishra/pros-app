import type { Command, EntityKind, GameEntity } from '../types';

export interface CloudRecord {
  kind: EntityKind; entityId: string; data: GameEntity; revision: number;
  sequence: number; commandId: string;
}
export interface CloudReceipt { id: string; fingerprint: string; sequence: number; keys: string[]; status: 'accepted' }
export interface CloudPage { records: CloudRecord[]; cursor: number }
export type CloudResult = { status: 'accepted'; receipt: CloudReceipt; records: CloudRecord[] } |
  { status: 'conflicted'; conflicts: { kind: EntityKind; entityId: string; remote: CloudRecord | null }[] };
export interface CloudAdapter {
  pull(cursor: number): Promise<CloudPage>;
  push(command: Command): Promise<CloudResult>;
}
export interface SyncMetadata {
  accountId: string; cursor: number; accessGranted?: boolean; lastSyncedAt?: string; error?: string;
}
export interface SyncConflict {
  key: string; accountId: string; commandId: string; kind: EntityKind; entityId: string;
  local: GameEntity; remote: CloudRecord | null; createdAt: string; resolvedAt?: string;
}
export const cloudKey = (kind: EntityKind, id: string) => kind === 'profile' ? 'profile' : `${kind}:${id}`;
export function firebaseUid(accountId: string): string {
  if (!/^firebase:[A-Za-z0-9_-]{1,128}$/.test(accountId)) throw new Error('Cloud sync requires its original Firebase account.');
  return accountId.slice(9);
}
export const CLOUD_BATCH_SIZE = 40;
