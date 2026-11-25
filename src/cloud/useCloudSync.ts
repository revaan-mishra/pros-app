import { useEffect, useSyncExternalStore } from 'react';
import { liveQuery } from 'dexie';
import type { User } from 'firebase/auth';
import { db } from '../storage';
import { cloudConfigured, friendlyCloudError, watchAccount } from './firebase';
import { createFirestoreAdapter } from './firestore-adapter';
import { synchronizeOnce, unresolvedConflicts } from './local-sync';
import { firebaseUid } from './types';
import { guardedCloudAdapter, SyncInterrupted, type SyncStopReason } from './sync-gate';

export type CloudSyncPhase = 'local' | 'connecting' | 'syncing' | 'synced' | 'offline' | 'sign-in' | 'verify-email' | 'paused' | 'conflict' | 'error';
export interface CloudSyncState { phase: CloudSyncPhase; pending: number; message: string; lastSyncedAt?: string }
const states = new Map<string, CloudSyncState>();
const subscribers = new Map<string, Set<() => void>>();
const controls = new Map<string, { retry: () => void; pause: (value: boolean) => void }>();
const leases = new Map<string, { count: number; dispose: () => void }>();
function isCloud(accountId: string) { return accountId.startsWith('firebase:'); }
function initial(accountId: string): CloudSyncState { return isCloud(accountId) ? { phase: 'connecting', pending: 0, message: 'Checking private synchronization…' } : { phase: 'local', pending: 0, message: 'Saved on this device' }; }
function stateFor(accountId: string) { if (!states.has(accountId)) states.set(accountId, initial(accountId)); return states.get(accountId)!; }
function update(accountId: string, patch: Partial<CloudSyncState>) { states.set(accountId, { ...stateFor(accountId), ...patch }); subscribers.get(accountId)?.forEach(listener => listener()); }
export function cloudReadiness(accountId: string, user: Pick<User, 'uid' | 'emailVerified'> | null, online: boolean, paused: boolean): Exclude<SyncStopReason,'closed'> | null {
  if (paused) return 'paused';
  if (!online) return 'offline';
  if (!user || user.uid !== firebaseUid(accountId)) return 'sign-in';
  if (!user.emailVerified) return 'verify-email';
  return null;
}
const phaseMessages: Partial<Record<CloudSyncPhase, string>> = {
  paused: 'Synchronization paused · work stays on this device', offline: 'Saved on this device · waiting for a connection',
  'sign-in': 'Saved on this device · sign in to this account to sync', 'verify-email': 'Verify your email to enable private synchronization',
};

function attach(accountId: string): () => void {
  if (!isCloud(accountId)) return () => {};
  const existing = leases.get(accountId); if (existing) { existing.count++; return () => detach(accountId); }
  let disposed = false, running = false, requested = false, ready = false, user: User | null = null;
  let paused = false; try { paused = localStorage.getItem(`pros.sync-paused:${accountId}`) === 'true'; } catch { /* Device preference only. */ }
  let timer: ReturnType<typeof setTimeout> | undefined, authUnsubscribe: (() => void) | undefined;
  const schedule = (delay = 250) => { if (disposed) return; requested = true; if (running) return; clearTimeout(timer); timer = setTimeout(() => { void cycle(); }, delay); };
  async function cycle() {
    if (disposed || running || !ready) return;
    requested = false;
    const blocked = cloudReadiness(accountId, user, navigator.onLine, paused);
    if (blocked) { update(accountId, { phase: blocked, message: phaseMessages[blocked]! }); return; }
    running = true; update(accountId, { phase: 'syncing', message: 'Synchronizing private records…' });
    try {
      const adapter = await createFirestoreAdapter(accountId);
      if (disposed || paused || cloudReadiness(accountId, user, navigator.onLine, false)) return;
      const gated=guardedCloudAdapter(adapter,()=>disposed?'closed':cloudReadiness(accountId,user,navigator.onLine,paused));
      const result = await synchronizeOnce(accountId, gated);
      if (disposed) return;
      const metadata = await db.syncMetadata.get(accountId);
      if (disposed) return;
      const blockedAfter = cloudReadiness(accountId, user, navigator.onLine, paused);
      if (blockedAfter) update(accountId, { phase: blockedAfter, message: phaseMessages[blockedAfter]! });
      else update(accountId, { phase: result === 'conflict' ? 'conflict' : 'synced', message: result === 'conflict' ? 'Both versions are preserved · review competing edits in Settings' : 'Private progress synchronized', lastSyncedAt: metadata?.lastSyncedAt });
    } catch (error) {
      if (!disposed && error instanceof SyncInterrupted && error.reason!=='closed') {update(accountId,{phase:error.reason,message:phaseMessages[error.reason]!});}
      else if (!disposed) { const message = friendlyCloudError(error); update(accountId, { phase: navigator.onLine ? 'error' : 'offline', message }); await db.syncMetadata.update(accountId, { error: message }).catch(() => {}); }
    } finally { running = false; if (requested && !disposed) schedule(500); }
  }
  controls.set(accountId, { retry: () => schedule(0), pause: value => { paused = value; try { localStorage.setItem(`pros.sync-paused:${accountId}`, String(value)); } catch { /* Still effective for this launch. */ } update(accountId, { phase: value ? 'paused' : 'connecting', message: value ? phaseMessages.paused! : 'Checking private synchronization…' }); schedule(0); } });
  const queueSubscription = liveQuery(async () => {
    const commands = await db.commands.where('accountId').equals(accountId).toArray();
    return commands.filter(command => command.status === 'pending' || command.status === 'conflict').length;
  }).subscribe({ next: pending => { if (!disposed) { update(accountId, { pending }); schedule(); } }, error: error => { if (!disposed) update(accountId, { phase: 'error', message: friendlyCloudError(error) }); } });
  if (cloudConfigured) void watchAccount(next => { user = next; ready = true; schedule(0); }).then(unsubscribe => { if (disposed) unsubscribe(); else authUnsubscribe = unsubscribe; }).catch(error => { if (!disposed) update(accountId, { phase: 'error', message: friendlyCloudError(error) }); });
  else update(accountId, { phase: 'error', message: 'Private synchronization is not available in this installation. Your saved records remain available.' });
  const onOnline = () => schedule(0);
  const onVisible = () => { if (document.visibilityState === 'visible') schedule(); };
  window.addEventListener('online', onOnline); window.addEventListener('offline', onOnline); document.addEventListener('visibilitychange', onVisible);
  const periodic = setInterval(() => { if (document.visibilityState === 'visible') schedule(); }, 60_000);
  leases.set(accountId, { count: 1, dispose() { disposed = true; clearTimeout(timer); clearInterval(periodic); authUnsubscribe?.(); queueSubscription.unsubscribe(); window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOnline); document.removeEventListener('visibilitychange', onVisible); controls.delete(accountId); } });
  return () => detach(accountId);
}
function detach(accountId: string) { const lease = leases.get(accountId); if (lease && --lease.count <= 0) { lease.dispose(); leases.delete(accountId); } }
export const retryCloudSync = (accountId: string) => controls.get(accountId)?.retry();
export const pauseCloudSync = (accountId: string, paused: boolean) => controls.get(accountId)?.pause(paused);
/** Read-only subscribers do not start another writer. Mount useCloudSync once in Shell. */
export function useCloudStatus(accountId: string): CloudSyncState {
  return useSyncExternalStore(listener => { const set = subscribers.get(accountId) || new Set(); set.add(listener); subscribers.set(accountId, set); return () => { set.delete(listener); if (!set.size) subscribers.delete(accountId); }; }, () => stateFor(accountId), () => stateFor(accountId));
}
export function useCloudSync(accountId: string): CloudSyncState {
  useEffect(() => attach(accountId), [accountId]);
  return useCloudStatus(accountId);
}
/** Re-check after an explicit resolution; an unfinished resolution never auto-dismisses. */
export async function refreshCloudConflicts(accountId: string) { const conflicts = await unresolvedConflicts(accountId); if (!conflicts.length) retryCloudSync(accountId); return conflicts; }
