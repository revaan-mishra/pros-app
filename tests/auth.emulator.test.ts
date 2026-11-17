import 'fake-indexeddb/auto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { applyActionCode, confirmPasswordReset, deleteUser, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { deleteApp } from 'firebase/app';
import type * as CloudAuth from '../src/cloud/firebase';

let service: typeof CloudAuth;
const projectId = 'demo-pros-rules';
const email = `pros-auth-${Date.now()}@example.test`;
beforeAll(async () => {
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099') throw new Error('Run with the local Authentication emulator on 127.0.0.1:9099. No production connections are permitted.');
  vi.stubEnv('VITE_FIREBASE_API_KEY', 'demo-key'); vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', `${projectId}.firebaseapp.com`);
  vi.stubEnv('VITE_FIREBASE_PROJECT_ID', projectId); vi.stubEnv('VITE_FIREBASE_APP_ID', 'demo-app'); vi.stubEnv('VITE_FIREBASE_EMULATORS', 'true');
  service = await import('../src/cloud/firebase');
  await service.firebaseServices();
});
afterAll(async () => {
  if (service) { const { auth } = await service.firebaseServices(); if (auth.currentUser) await deleteUser(auth.currentUser); await service.signOutAccount(); await deleteApp(auth.app); }
  vi.unstubAllEnvs();
});
async function actionCode(type: string): Promise<string> {
  const response = await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${projectId}/oobCodes`);
  if (!response.ok) throw new Error('Could not inspect emulator-only action codes.');
  const result = await response.json() as { oobCodes: { email: string; requestType: string; oobCode: string }[] };
  const code = result.oobCodes.filter(code => code.email === email && code.requestType === type).at(-1)?.oobCode;
  if (!code) throw new Error(`Missing emulator action code ${type}`); return code;
}
describe('email account lifecycle with real Authentication SDK', () => {
  it('registers, verifies, restores sign-in, resets a password, and reauthenticates without external emails', async () => {
    const identities: (string | null)[] = []; const stop = await service.watchAccount(user => identities.push(user?.uid || null));
    try {
      const result = await service.register(email, 'a-private-first-password');
      expect(result.user.emailVerified).toBe(false); expect(result.user.email).toBe(email);
      const { auth } = await service.firebaseServices();
      await applyActionCode(auth, await actionCode('VERIFY_EMAIL'));
      expect((await service.refreshAccount())?.emailVerified).toBe(true);
      const originalUid = auth.currentUser!.uid;
      await service.signOutAccount(); expect(auth.currentUser).toBeNull();
      await expect(service.signIn(email, 'incorrect-password')).rejects.toMatchObject({ code: expect.stringMatching(/^auth\/(invalid-credential|wrong-password)$/) });
      const restored = await service.signIn(email, 'a-private-first-password'); expect(restored.user.uid).toBe(originalUid); expect(restored.user.emailVerified).toBe(true);
      await service.resetPassword(email);
      await confirmPasswordReset(auth, await actionCode('PASSWORD_RESET'), 'a-private-replacement-password');
      await service.signOutAccount();
      const changed = await service.signIn(email, 'a-private-replacement-password'); expect(changed.user.uid).toBe(originalUid);
      await reauthenticateWithCredential(changed.user, EmailAuthProvider.credential(email, 'a-private-replacement-password'));
      await vi.waitFor(() => expect(identities).toContain(originalUid));
      expect(identities).toContain(null);
    } finally { stop(); }
  });
});
