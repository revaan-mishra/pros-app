import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({
  user: { uid: 'new-owner', email: 'owner@example.test', emailVerified: false },
  auth: { currentUser: null as null | { uid: string; email: string; emailVerified: boolean } },
  creationFailure: null as null | { code: string }, mailFailure: null as null | { code: string },
  creates: 0, deliveries: 0,
  returnUrl: undefined as string | undefined,
}));
vi.mock('firebase/app', () => ({ getApps: () => [], initializeApp: () => ({ name: '[DEFAULT]' }) }));
vi.mock('firebase/firestore', () => ({ initializeFirestore: () => ({}), memoryLocalCache: () => ({}) }));
vi.mock('firebase/auth', () => ({
  getAuth: () => fixture.auth,
  createUserWithEmailAndPassword: async (_auth: unknown, _email: string, _password: string) => {
    fixture.creates++;
    if (fixture.creationFailure) throw fixture.creationFailure;
    fixture.auth.currentUser = fixture.user;
    return { user: fixture.user, providerId: null, operationType: 'signIn' };
  },
  sendEmailVerification: async (_user: unknown, settings?: { url: string }) => {
    fixture.deliveries++;
    fixture.returnUrl = settings?.url;
    if (fixture.mailFailure) throw fixture.mailFailure;
  },
}));
let service: typeof import('./firebase');
beforeAll(async () => {
  vi.stubEnv('VITE_FIREBASE_API_KEY', 'test-key'); vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', 'demo.example.test');
  vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'demo-pros-errors'); vi.stubEnv('VITE_FIREBASE_APP_ID', 'test-app');
  vi.stubEnv('VITE_FIREBASE_EMULATORS', 'false');
  service = await import('./firebase');
});
beforeEach(() => { fixture.auth.currentUser = null; fixture.creationFailure = null; fixture.mailFailure = null; fixture.creates = 0; fixture.deliveries = 0; });
afterAll(() => vi.unstubAllEnvs());

describe('account entry errors and partial registration', () => {
  it('does not call a failed first signup offline or claim a saved world will synchronize', () => {
    const error = { code: 'auth/network-request-failed' };
    expect(service.friendlyCloudError(error, 'register')).toBe('Couldn’t reach the account service. Account creation was not confirmed. Check your connection and try again.');
    expect(service.friendlyCloudError(error, 'register')).not.toMatch(/offline|saved|sync/i);
    expect(service.friendlyCloudError(error)).toContain('local work is preserved');
  });
  it('distinguishes reset, sign-in and verification delivery failures', () => {
    const error = { code: 'auth/network-request-failed' };
    expect(service.friendlyCloudError(error, 'reset-password')).toContain('password reset');
    expect(service.friendlyCloudError(error, 'sign-in')).toContain('account service');
    expect(service.friendlyCloudError(error, 'verification')).toContain('Resend link');
    for (const context of ['account', 'register', 'sign-in', 'reset-password', 'verification'] as const) {
      expect(service.friendlyCloudError(error, context)).not.toMatch(/local work|saved records|sync after/i);
    }
  });
  it('does not claim identity creation failed after only email delivery fails', async () => {
    fixture.mailFailure = { code: 'auth/network-request-failed' };
    const result = await service.register('owner@example.test', 'not-a-real-password');
    expect(result.user.uid).toBe('new-owner'); expect(result.verification.status).toBe('pending');
    if (result.verification.status === 'pending') expect(result.verification.message).toContain('Your account was created');
    expect(fixture.auth.currentUser).toBe(fixture.user);
    expect(fixture.creates).toBe(1); expect(fixture.deliveries).toBe(1);
  });
  it('separates a verification delivery quota from the registered identity', async () => {
    fixture.mailFailure = { code: 'auth/too-many-requests' };
    const result = await service.register('owner@example.test', 'not-a-real-password');
    expect(result.verification.status).toBe('pending');
    if (result.verification.status === 'pending') expect(result.verification.message).toContain('Wait a little');
    expect(fixture.creates).toBe(1);
  });
  it('preserves actual creation failure and does not attempt verification', async () => {
    fixture.creationFailure = { code: 'auth/network-request-failed' };
    await expect(service.register('owner@example.test', 'not-a-real-password')).rejects.toMatchObject(fixture.creationFailure);
    expect(fixture.auth.currentUser).toBeNull(); expect(fixture.deliveries).toBe(0);
  });
  it('reports successful registration only after the email request succeeds', async () => {
    const result = await service.register('owner@example.test', 'not-a-real-password');
    expect(result.verification).toEqual({ status: 'sent' }); expect(result.user).toBe(fixture.user);
  });
  it('returns users to the Firebase Hosting origin after verifying', async () => {
    vi.stubGlobal('location', { origin: 'https://demo-pros-errors.web.app' });
    try {
      await service.register('owner@example.test', 'not-a-real-password');
      expect(fixture.returnUrl).toBe('https://demo-pros-errors.web.app/');
      vi.stubGlobal('location', { origin: 'http://127.0.0.1:4173' });
      await service.verifyEmail();
      expect(fixture.returnUrl).toBeUndefined();
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('does not reuse sync-specific quota/access language in first account entry', () => {
    expect(service.friendlyCloudError({ code: 'permission-denied' }, 'account')).toContain('waiting for private access');
    expect(service.friendlyCloudError({ code: 'resource-exhausted' }, 'register')).not.toMatch(/local work|synchronization/);
    expect(service.friendlyCloudError({ code: 'auth/unknown-future-code' }, 'account')).not.toContain('auth/');
  });
});
