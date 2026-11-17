import { deleteAccountData } from '../storage';
import { firebaseServices } from './firebase';
import { firebaseUid } from './types';
export class LocalAccountCleanupError extends Error {
  constructor() { super('Your private account was removed. The saved copy on this device still needs cleanup. Retry device cleanup below.'); this.name = 'LocalAccountCleanupError'; }
}
export async function finishLocalAccountRemoval(accountId: string): Promise<void> {
  await deleteAccountData(accountId);
  try { if (localStorage.getItem('pros.activeProfile') === accountId) localStorage.removeItem('pros.activeProfile'); } catch { /* Local DB cleanup already completed. */ }
}

/** Reauthentication precedes irreversible cleanup. A durable marker freezes all writers. */
export async function deleteCloudAccount(accountId: string, password: string, progress: (message: string) => void = () => {}): Promise<void> {
  const uid = firebaseUid(accountId);
  const [{ auth, firestore }, sdk, authSDK] = await Promise.all([firebaseServices(), import('firebase/firestore'), import('firebase/auth')]);
  const user = auth.currentUser;
  if (!navigator.onLine) throw new Error('Connect to the internet to delete this account.');
  if (!user || user.uid !== uid || !user.email || !user.emailVerified) throw new Error('Sign in to this account and verify its email before deleting it.');
  await authSDK.reauthenticateWithCredential(user, authSDK.EmailAuthProvider.credential(user.email, password));
  const assertIdentity = () => { if (auth.currentUser?.uid !== uid) throw new Error('The signed-in account changed. Cleanup paused safely. Sign in again to resume.'); };
  assertIdentity(); progress('Preparing private data cleanup…');
  const stateRef = sdk.doc(firestore, 'users', uid, 'state', 'main');
  await sdk.runTransaction(firestore, async transaction => {
    assertIdentity(); const state = await transaction.get(stateRef); assertIdentity();
    if (!state.data()?.deleting) transaction.set(stateRef, state.exists() ? { ...state.data(), deleting: true } : { sequence: 0, commandId: 'deletion', deleting: true });
  });
  for (const name of ['records', 'commands']) {
    while (true) {
      assertIdentity();
      const page = await sdk.getDocsFromServer(sdk.query(sdk.collection(firestore, 'users', uid, name), sdk.limit(200)));
      assertIdentity(); if (page.empty) break;
      const batch = sdk.writeBatch(firestore); page.docs.forEach(record => batch.delete(record.ref));
      await batch.commit(); progress(`Removing private ${name}…`);
    }
  }
  assertIdentity();
  // Keep the deletion marker until Auth removal succeeds, so an interrupted final
  // step cannot reopen the namespace or upload still-cached pending records.
  progress('Removing your sign-in…');
  await authSDK.deleteUser(user);
  try { await finishLocalAccountRemoval(accountId); } catch { throw new LocalAccountCleanupError(); }
  // The harmless frozen state marker stays behind. An admin can remove it; the
  // deleted identity can no longer access it or any former private records.
}
