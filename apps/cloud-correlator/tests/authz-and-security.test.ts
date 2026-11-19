import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import { issueSignedBearerToken } from '../src/security/auth-session';
import {
  PAIRING_PROTOCOL_VERSION,
  buildPairingTranscript,
} from '../src/security/pairing-crypto';

async function pairDeviceForToken(
  app: Awaited<ReturnType<typeof buildApp>>,
  deviceId: string,
  authHeader: string
) {
  const ownerKeys = crypto.generateKeyPairSync('ed25519');
  const devSignKeys = crypto.generateKeyPairSync('ed25519');
  const devAgreeKeys = crypto.generateKeyPairSync('x25519');
  const nonce = crypto.randomBytes(16).toString('hex');
  const timestamp = new Date().toISOString();
  const ownerPub = (ownerKeys.publicKey.export({ format: 'der', type: 'spki' }) as Buffer).toString('base64');
  const devSignPub = (devSignKeys.publicKey.export({ format: 'der', type: 'spki' }) as Buffer).toString('base64');
  const devAgreePub = (devAgreeKeys.publicKey.export({ format: 'der', type: 'spki' }) as Buffer).toString('base64');
  const transcript = buildPairingTranscript({
    protocol_version: PAIRING_PROTOCOL_VERSION,
    device_id: deviceId,
    owner_signing_public_key: ownerPub,
    device_signing_public_key: devSignPub,
    device_agreement_public_key: devAgreePub,
    nonce,
    timestamp,
  });

  return app.inject({
    method: 'POST',
    url: '/v1/devices/pair',
    headers: { authorization: authHeader },
    payload: {
      protocol_version: PAIRING_PROTOCOL_VERSION,
      device_id: deviceId,
      platform: 'macos',
      hostname: 'alice-workstation',
      owner_signing_public_key: ownerPub,
      device_signing_public_key: devSignPub,
      device_agreement_public_key: devAgreePub,
      nonce,
      timestamp,
      owner_signature: crypto.sign(null, transcript, ownerKeys.privateKey).toString('base64'),
      device_signature: crypto.sign(null, transcript, devSignKeys.privateKey).toString('base64'),
    },
  });
}

describe('Authorization, Ownership Isolation (401/403), CSRF & Brute-Force Hardening', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('rejects dev-test-token and arbitrary bearer tokens in production (401), accepting only verified HMAC tokens', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-prod-auth-'));
    try {
      process.env.NODE_ENV = 'production';
      const secret = '0123456789abcdef0123456789abcdef0123456789abcdef';
      process.env.AEGIS_SESSION_SECRET = secret;
      process.env.AEGIS_SQLITE_PATH = path.join(tmpDir, 'prod.sqlite');

      const app = await buildApp({
        allowedOrigins: ['https://aegis.example.com'],
        sessionSecret: secret,
      });

      const forgedRes = await app.inject({
        method: 'GET',
        url: '/v1/devices',
        headers: { authorization: 'Bearer development-token' },
      });
      expect(forgedRes.statusCode).toBe(401);

      const devTokenInProd = await app.inject({
        method: 'GET',
        url: '/v1/devices',
        headers: { authorization: 'Bearer dev-test-token' },
      });
      expect(devTokenInProd.statusCode).toBe(401);

      const validSignedToken = issueSignedBearerToken('user-prod-alice', secret);
      const validRes = await app.inject({
        method: 'GET',
        url: '/v1/devices',
        headers: { authorization: `Bearer ${validSignedToken}` },
      });
      expect(validRes.statusCode).toBe(200);

      await app.close();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('enforces multi-user ownership isolation returning 403 when user B accesses user A device or share', async () => {
    const secret = 'abcdef0123456789abcdef0123456789abcdef0123456789';
    const app = await buildApp({ sessionSecret: secret });

    const aliceToken = issueSignedBearerToken('user-alice', secret);
    const bobToken = issueSignedBearerToken('user-bob', secret);

    const pairRes = await pairDeviceForToken(app, 'enc_dev_alice_01', `Bearer ${aliceToken}`);
    expect(pairRes.statusCode).toBe(201);

    const bobDevices = await app.inject({
      method: 'GET',
      url: '/v1/devices',
      headers: { authorization: `Bearer ${bobToken}` },
    });
    expect(bobDevices.statusCode).toBe(200);
    expect(bobDevices.json().devices).toEqual([]);

    const bobCommand = await app.inject({
      method: 'POST',
      url: '/v1/commands',
      headers: { authorization: `Bearer ${bobToken}` },
      payload: {
        command: 'lock_session',
        target_device_id: 'enc_dev_alice_01',
        explicit_user_confirmation: true,
      },
    });
    expect(bobCommand.statusCode).toBe(403);
    expect(bobCommand.json().error).toBe('forbidden_device_access');

    const aliceShare = await app.inject({
      method: 'POST',
      url: '/v1/shares',
      headers: { authorization: `Bearer ${aliceToken}` },
      payload: {
        device_id: 'enc_dev_alice_01',
        expires_at: '2026-12-20T12:00:00Z',
        explicit_user_confirmation: true,
      },
    });
    expect(aliceShare.statusCode).toBe(201);
    const shareId = aliceShare.json().share_id as string;

    const bobRevoke = await app.inject({
      method: 'DELETE',
      url: `/v1/shares/${shareId}`,
      headers: { authorization: `Bearer ${bobToken}` },
      payload: { explicit_user_confirmation: true },
    });
    expect(bobRevoke.statusCode).toBe(403);
    expect(bobRevoke.json().error).toBe('forbidden_share_access');

    await app.close();
  });

  it('enforces CSRF header verification on cookie mutations, forbids csrf_token in URL query, and revokes logged-out sessions', async () => {
    const secret = 'fedcba9876543210fedcba9876543210fedcba9876543210';
    const app = await buildApp({ sessionSecret: secret });

    const sessionRes = await app.inject({
      method: 'POST',
      url: '/v1/auth/session',
    });
    expect(sessionRes.statusCode).toBe(201);
    const cookieHeader = String(sessionRes.headers['set-cookie']).split(';')[0];
    const { csrf_token } = sessionRes.json() as { csrf_token: string };
    expect(csrf_token.length).toBeGreaterThan(16);

    const queryCsrf = await app.inject({
      method: 'GET',
      url: `/v1/devices?csrf_token=${csrf_token}`,
      headers: { cookie: cookieHeader },
    });
    expect(queryCsrf.statusCode).toBe(400);
    expect(queryCsrf.json().error).toBe('csrf_token_in_query_forbidden');

    const missingCsrfMutation = await app.inject({
      method: 'POST',
      url: '/v1/commands',
      headers: { cookie: cookieHeader },
      payload: {
        command: 'lock_session',
        target_device_id: 'enc_dev_cookie_01',
        explicit_user_confirmation: true,
      },
    });
    expect(missingCsrfMutation.statusCode).toBe(403);
    expect(missingCsrfMutation.json().error).toBe('csrf_validation_failed');

    const pairRes = await pairDeviceForToken(
      app,
      'enc_dev_cookie_01',
      `Bearer ${issueSignedBearerToken('usr-owner-default', secret)}`
    );
    expect(pairRes.statusCode).toBe(201);

    const validCookieCommand = await app.inject({
      method: 'POST',
      url: '/v1/commands',
      headers: {
        cookie: cookieHeader,
        'x-requested-with': csrf_token,
      },
      payload: {
        command: 'lock_session',
        target_device_id: 'enc_dev_cookie_01',
        explicit_user_confirmation: true,
      },
    });
    expect(validCookieCommand.statusCode).toBe(202);

    const logoutRes = await app.inject({
      method: 'POST',
      url: '/v1/auth/logout',
      headers: { cookie: cookieHeader },
    });
    expect(logoutRes.statusCode).toBe(204);

    const replayedAfterLogout = await app.inject({
      method: 'GET',
      url: '/v1/devices',
      headers: { cookie: cookieHeader },
    });
    expect(replayedAfterLogout.statusCode).toBe(401);

    await app.close();
  });

  it('blocks repeated failed auth attempts with 429 auth_rate_limited', async () => {
    const app = await buildApp();
    for (let i = 0; i < 9; i += 1) {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/devices',
        headers: { 'x-forwarded-for': '198.51.100.77' },
      });
      expect(res.statusCode).toBe(401);
    }

    const blockedRes = await app.inject({
      method: 'GET',
      url: '/v1/devices',
      headers: { 'x-forwarded-for': '198.51.100.77' },
    });
    expect(blockedRes.statusCode).toBe(429);
    expect(blockedRes.json().error).toBe('auth_rate_limited');
    await app.close();
  });

  it('requires explicit_user_confirmation=true (428) and rejects disallowed command actions (400)', async () => {
    const secret = '1234567890abcdef1234567890abcdef1234567890abcdef';
    const app = await buildApp({ sessionSecret: secret });
    const ownerToken = issueSignedBearerToken('user-cmd-test', secret);
    await pairDeviceForToken(app, 'enc_dev_cmd_01', `Bearer ${ownerToken}`);

    const cmd428 = await app.inject({
      method: 'POST',
      url: '/v1/commands',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        command: 'lock_session',
        target_device_id: 'enc_dev_cmd_01',
        explicit_user_confirmation: false,
      },
    });
    expect(cmd428.statusCode).toBe(428);
    expect(cmd428.json().error).toBe('explicit_user_confirmation_required');

    const cmd400 = await app.inject({
      method: 'POST',
      url: '/v1/commands',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        command: 'request_diagnostics',
        target_device_id: 'enc_dev_cmd_01',
        explicit_user_confirmation: true,
      },
    });
    expect(cmd400.statusCode).toBe(400);
    expect(cmd400.json().error).toBe('invalid_command_payload');

    const share428 = await app.inject({
      method: 'POST',
      url: '/v1/shares',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        device_id: 'enc_dev_cmd_01',
        expires_at: '2026-12-20T12:00:00Z',
        explicit_user_confirmation: false,
      },
    });
    expect(share428.statusCode).toBe(428);
    expect(share428.json().error).toBe('explicit_user_confirmation_required');

    await app.close();
  });
});
