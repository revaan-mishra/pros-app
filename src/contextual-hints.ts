import type { TourStorage } from './tour';

// Failed local storage still respects a dismissal for this running app session.
const dismissedInMemory = new Set<string>();
export const hintStorageKey = (accountId: string, id: string) => `pros.hint.v1:${encodeURIComponent(accountId)}:${encodeURIComponent(id)}`;
function storageOrNull(storage?: TourStorage | null) {
  if (storage !== undefined) return storage;
  try { return typeof window === 'undefined' ? null : window.localStorage; } catch { return null; }
}
export function hintDismissed(accountId: string, id: string, storage?: TourStorage | null): boolean {
  const key = hintStorageKey(accountId,id);
  if (dismissedInMemory.has(key)) return true;
  try { return storageOrNull(storage)?.getItem(key) === 'dismissed'; } catch { return false; }
}
export function dismissHint(accountId: string, id: string, storage?: TourStorage | null): boolean {
  const key = hintStorageKey(accountId,id); dismissedInMemory.add(key);
  try { const source=storageOrNull(storage);if(!source)return false;source.setItem(key,'dismissed');return true; } catch { return false; }
}
