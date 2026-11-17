import type { Auth, User } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
export const cloudConfigured = Object.values(config).every(value => typeof value === 'string' && value.length > 0);
export const cloudRequired = import.meta.env.VITE_REQUIRE_CLOUD === 'true';
export interface FirebaseServices { auth: Auth; firestore: Firestore }
let services: Promise<FirebaseServices> | undefined;
export function firebaseServices(): Promise<FirebaseServices> {
  if (!cloudConfigured) return Promise.reject(new Error('Account services are not available in this installation. Your saved records are unchanged.'));
  services ||= (async () => {
    const [appSDK, authSDK, storeSDK] = await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore')]);
    const app = appSDK.getApps().some(app => app.name === '[DEFAULT]') ? appSDK.getApp() : appSDK.initializeApp(config);
    const auth = authSDK.getAuth(app);
    // Only Dexie's explicit queue writes offline. Firestore has no persistent mutation queue.
    const firestore = storeSDK.initializeFirestore(app, { localCache: storeSDK.memoryLocalCache() });
    if (import.meta.env.DEV && import.meta.env.VITE_FIREBASE_EMULATORS === 'true') {
      authSDK.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      storeSDK.connectFirestoreEmulator(firestore, '127.0.0.1', 8080);
    }
    return { auth, firestore };
  })();
  return services;
}
export async function watchAccount(listener: (user: User | null) => void) {
  const [{ auth }, { onIdTokenChanged }] = await Promise.all([firebaseServices(), import('firebase/auth')]);
  return onIdTokenChanged(auth, listener);
}
export async function signIn(email: string, password: string) {
  const [{ auth }, sdk] = await Promise.all([firebaseServices(), import('firebase/auth')]);
  return sdk.signInWithEmailAndPassword(auth, email.trim(), password);
}
export async function register(email: string, password: string) {
  if (password.length < 8) throw new Error('Choose a password with at least eight characters.');
  const [{ auth }, sdk] = await Promise.all([firebaseServices(), import('firebase/auth')]);
  const result = await sdk.createUserWithEmailAndPassword(auth, email.trim(), password);
  await sdk.sendEmailVerification(result.user);
  return result;
}
export async function resetPassword(email: string) {
  const [{ auth }, sdk] = await Promise.all([firebaseServices(), import('firebase/auth')]);
  await sdk.sendPasswordResetEmail(auth, email.trim());
}
export async function verifyEmail() {
  const [{ auth }, sdk] = await Promise.all([firebaseServices(), import('firebase/auth')]);
  if (!auth.currentUser) throw new Error('Sign in to send a verification email.');
  await sdk.sendEmailVerification(auth.currentUser);
}
export async function refreshAccount() {
  const [{ auth }, sdk] = await Promise.all([firebaseServices(), import('firebase/auth')]);
  if (!auth.currentUser) return null;
  await sdk.reload(auth.currentUser); await sdk.getIdToken(auth.currentUser, true);
  return auth.currentUser;
}
export async function signOutAccount() {
  const [{ auth }, sdk] = await Promise.all([firebaseServices(), import('firebase/auth')]);
  await sdk.signOut(auth);
}
export function friendlyCloudError(error: unknown): string {
  const code = (error as { code?: string })?.code || '';
  if (code.includes('invalid-email')) return 'Enter a complete email address.';
  if (code.includes('user-disabled')) return 'This sign-in has been paused. Contact the project owner through your invitation channel.';
  if (/operation-not-allowed|configuration-not-found/.test(code)) return 'Account services are unavailable right now. Your saved work is preserved.';
  if (/expired-action-code|invalid-action-code/.test(code)) return 'This link has expired or was already used. Request a fresh link and try again.';
  if (code.includes('requires-recent-login')) return 'Sign in again to confirm this change. Your saved records are preserved.';
  if (code.includes('password-does-not-meet-requirements')) return 'Choose a stronger password that meets the account’s password requirements.';
  if (/unauthorized-domain|invalid-continue-uri|unauthorized-continue-uri/.test(code)) return 'Account links are not available at this address. Open the app from your invitation link.';
  if (/invalid-credential|wrong-password|user-not-found/.test(code)) return 'Email or password was not recognized. Try again or reset your password.';
  if (code.includes('email-already-in-use')) return 'An account already uses that email. Sign in or reset your password.';
  if (code.includes('weak-password')) return 'Choose a longer password, with at least eight characters.';
  if (code.includes('invalid-email')) return 'Enter a valid email address.';
  if (code.includes('operation-not-allowed')) return 'Email sign-in is not available right now. Your saved records are unchanged.';
  if (/user-token-expired|invalid-user-token|requires-recent-login/.test(code)) return 'Sign in again to this account. Your saved records and pending work are preserved.';
  if (code.includes('too-many-requests')) return 'Too many attempts. Your saved work is safe; try again later.';
  if (/network-request-failed|unavailable/.test(code)) return 'You are offline or the service is unavailable. Local work is preserved and will sync after reconnection.';
  if (/permission-denied/.test(code)) return 'Sync is not authorized. Verify your email and confirm that this account is enabled for the beta.';
  if (/resource-exhausted/.test(code)) return 'The free service quota is currently full. Local work is preserved; synchronization will retry later.';
  return error instanceof Error ? error.message : 'The account service could not finish. Your local work is preserved.';
}
