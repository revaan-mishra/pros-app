import { describe, expect, it } from 'vitest';
import { cloudReadiness } from './useCloudSync';
describe('cloud identity and connectivity gate', () => {
  it('never uploads the active namespace through a different signed-in account', () => {
    expect(cloudReadiness('firebase:alice', { uid: 'bob', emailVerified: true }, true, false)).toBe('sign-in');
    expect(cloudReadiness('firebase:alice', null, true, false)).toBe('sign-in');
    expect(cloudReadiness('firebase:alice', { uid: 'alice', emailVerified: false }, true, false)).toBe('verify-email');
    expect(cloudReadiness('firebase:alice', { uid: 'alice', emailVerified: true }, true, false)).toBeNull();
  });
  it('retains offline and explicit pause states ahead of authentication retries', () => {
    expect(cloudReadiness('firebase:alice', null, false, false)).toBe('offline');
    expect(cloudReadiness('firebase:alice', { uid: 'alice', emailVerified: true }, true, true)).toBe('paused');
  });
});
