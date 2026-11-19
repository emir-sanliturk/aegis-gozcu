import { describe, expect, it } from 'vitest';
import { ApiRealEventSource } from '../src/data/real-event-source';
import { ApiRealDeviceSource } from '../src/data/real-device-source';
import { hashClientIpForAbuseControl, defaultIpPrivacyPolicy } from '../src/security/ip-privacy';
import { generateUuidV7, validateCanonicalEvent, verifyEventChain } from '../src/utils/eventSchema';
import { INITIAL_INCIDENTS } from '../src/data/telemetryData';

describe('Real data binding & IP privacy', () => {
  it('returns empty events when unauthenticated in pre-release state', async () => {
    const source = new ApiRealEventSource('https://api.aegis.example', async () => null);
    const page = await source.listEvents({ limit: 50 });
    expect(page.mode).toBe('real');
    expect(page.events).toEqual([]);
    expect(page.nextCursor).toBeNull();
  });

  it('returns empty paired devices when unauthenticated', async () => {
    const source = new ApiRealDeviceSource('https://api.aegis.example', async () => null);
    const snapshot = await source.listPairedDevices();
    expect(snapshot.mode).toBe('real');
    expect(snapshot.devices).toEqual([]);
  });

  it('hashes client IP with pepper instead of storing raw IP', async () => {
    expect(defaultIpPrivacyPolicy.storeRawIp).toBe(false);
    expect(defaultIpPrivacyPolicy.collectPreciseIp).toBe(false);
    expect(defaultIpPrivacyPolicy.hashIpForAbuseControl).toBe(true);
    expect(defaultIpPrivacyPolicy.proxyEgress).toBe(true);

    const rawIp = '203.0.113.42';
    const digest = await hashClientIpForAbuseControl(rawIp, 'test-pepper-2026');
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(digest).not.toContain(rawIp);
  });

  it('validates canonical 1.0.0 schema and append-only event chain', () => {
    const uuid = generateUuidV7();
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

    for (const incident of INITIAL_INCIDENTS) {
      expect(validateCanonicalEvent(incident)).toEqual([]);
    }
    const chain = verifyEventChain(INITIAL_INCIDENTS);
    expect(chain.valid).toBe(true);
    expect(chain.brokenEventIds).toEqual([]);
  });
});
