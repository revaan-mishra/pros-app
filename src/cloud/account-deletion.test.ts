import { beforeEach, describe, expect, it, vi } from 'vitest';
const fixture = vi.hoisted(() => ({
  auth: { currentUser: null as null | { uid: string; email: string; emailVerified: boolean } },
  state: undefined as undefined | Record<string, unknown>,
  rows: { records: ['r1', 'r2'], commands: ['c1'] } as Record<string, string[]>,
  events: [] as string[], authFailure: false, cleanupFailure: false, localFailure: false,
}));
vi.mock('../storage', () => ({ deleteAccountData: vi.fn(async (accountId: string) => { fixture.events.push(`local:${accountId}`); if (fixture.localFailure) throw new Error('Device storage unavailable'); }) }));
vi.mock('./firebase', () => ({ firebaseServices: async () => ({ auth: fixture.auth, firestore: {} }) }));
vi.mock('firebase/auth', () => ({
  EmailAuthProvider: { credential: (email: string, password: string) => ({ email, password }) },
  reauthenticateWithCredential: async () => { fixture.events.push('reauth'); if (fixture.authFailure) throw new Error('Wrong password'); },
  deleteUser: async () => { fixture.events.push('delete-auth'); fixture.auth.currentUser = null; },
}));
vi.mock('firebase/firestore', () => ({
  doc: (_store: unknown, ...path: string[]) => path.join('/'),
  runTransaction: async (_store: unknown, callback: (transaction: unknown) => Promise<void>) => callback({ get: async () => ({ exists: () => !!fixture.state, data: () => fixture.state }), set: (_reference: unknown, state: Record<string, unknown>) => { fixture.state = state; fixture.events.push('freeze'); } }),
  collection: (_store: unknown, ...path: string[]) => path[path.length - 1],
  limit: () => ({}), query: (reference: string) => reference,
  getDocsFromServer: async (collection: string) => ({ empty: !fixture.rows[collection].length, docs: fixture.rows[collection].map(id => ({ ref: { collection, id } })) }),
  writeBatch: () => { const removed: { collection: string; id: string }[] = []; return { delete: (ref: { collection: string; id: string }) => removed.push(ref), commit: async () => { if (fixture.cleanupFailure) throw new Error('Network interrupted'); for (const row of removed) { fixture.rows[row.collection] = fixture.rows[row.collection].filter(id => id !== row.id); fixture.events.push(`delete:${row.collection}:${row.id}`); } } }; },
}));
import { deleteCloudAccount, finishLocalAccountRemoval, LocalAccountCleanupError } from './account-deletion';
beforeEach(() => {
  vi.stubGlobal('navigator', { onLine: true }); fixture.auth.currentUser = { uid: 'alice', email: 'alice@example.test', emailVerified: true };
  fixture.state = { sequence: 4, commandId: 'previous', deleting: false }; fixture.rows = { records: ['r1', 'r2'], commands: ['c1'] };
  fixture.events = []; fixture.authFailure = false; fixture.cleanupFailure = false; fixture.localFailure = false;
});
describe('confirmed account removal and interrupted cleanup', () => {
  it('requires matching verified identity and reauthentication before freezing or deleting anything', async () => {
    await expect(deleteCloudAccount('firebase:bob', 'password')).rejects.toThrow('Sign in to this account');
    expect(fixture.events).toEqual([]);
    fixture.authFailure = true;
    await expect(deleteCloudAccount('firebase:alice', 'wrong')).rejects.toThrow('Wrong password');
    expect(fixture.events).toEqual(['reauth']); expect(fixture.state!.deleting).toBe(false);
  });
  it('leaves a durable frozen namespace and the local copy intact when cleanup is interrupted', async () => {
    fixture.cleanupFailure = true;
    await expect(deleteCloudAccount('firebase:alice', 'password')).rejects.toThrow('Network interrupted');
    expect(fixture.state).toEqual({ sequence: 4, commandId: 'previous', deleting: true });
    expect(fixture.events).toEqual(['reauth', 'freeze']); expect(fixture.auth.currentUser?.uid).toBe('alice');
    fixture.cleanupFailure = false;
    await deleteCloudAccount('firebase:alice', 'password');
    expect(fixture.events.slice(-2)).toEqual(['delete-auth', 'local:firebase:alice']);
  });
  it('purges private records and receipts before Auth and local removal, retaining only the freeze marker', async () => {
    await deleteCloudAccount('firebase:alice', 'password');
    expect(fixture.rows).toEqual({ records: [], commands: [] });
    expect(fixture.events).toEqual(['reauth', 'freeze', 'delete:records:r1', 'delete:records:r2', 'delete:commands:c1', 'delete-auth', 'local:firebase:alice']);
    expect(fixture.state).toEqual({ sequence: 4, commandId: 'previous', deleting: true });
  });
  it('allows device cleanup to retry after the online account was already removed', async () => {
    fixture.localFailure = true;
    await expect(deleteCloudAccount('firebase:alice', 'password')).rejects.toBeInstanceOf(LocalAccountCleanupError);
    expect(fixture.auth.currentUser).toBeNull(); expect(fixture.rows).toEqual({ records: [], commands: [] });
    fixture.localFailure = false; await finishLocalAccountRemoval('firebase:alice');
    expect(fixture.events.filter(event => event === 'delete-auth')).toHaveLength(1);
    expect(fixture.events.at(-1)).toBe('local:firebase:alice');
  });
});
