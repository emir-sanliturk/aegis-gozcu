import crypto from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import {
  PAIRING_PROTOCOL_VERSION,
  buildPairingTranscript,
} from '../src/security/pairing-crypto';

async function pairOwnedDevice(
  app: Awaited<ReturnType<typeof buildApp>>,
  deviceId: string,
  authHeader = 'Bearer dev-test-token'
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

  const res = await app.inject({
    method: 'POST',
    url: '/v1/devices/pair',
    headers: { authorization: authHeader },
    payload: {
      protocol_version: PAIRING_PROTOCOL_VERSION,
      device_id: deviceId,
      platform: 'windows',
      hostname: 'ofis-is-istasyonu',
      owner_signing_public_key: ownerPub,
      device_signing_public_key: devSignPub,
      device_agreement_public_key: devAgreePub,
      nonce,
      timestamp,
      owner_signature: crypto.sign(null, transcript, ownerKeys.privateKey).toString('base64'),
      device_signature: crypto.sign(null, transcript, devSignKeys.privateKey).toString('base64'),
    },
  });
  expect(res.statusCode).toBe(201);
}

describe('Cloud Correlator health & protected routes', () => {
  const originalReady = process.env.AEGIS_READY;
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.AEGIS_READY = originalReady;
    process.env.NODE_ENV = originalEnv;
  });

  it('serves /healthz 200 and /readyz 503 when not ready, 200 when ready', async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.AEGIS_READY;

    const app = await buildApp();
    const healthRes = await app.inject({ method: 'GET', url: '/healthz' });
    expect(healthRes.statusCode).toBe(200);
    expect(healthRes.json()).toEqual({ status: 'ok' });

    const notReadyRes = await app.inject({ method: 'GET', url: '/readyz' });
    expect(notReadyRes.statusCode).toBe(503);
    expect(notReadyRes.json()).toEqual({ status: 'not_ready' });

    process.env.AEGIS_READY = 'true';
    const readyRes = await app.inject({ method: 'GET', url: '/readyz' });
    expect(readyRes.statusCode).toBe(200);
    expect(readyRes.json()).toEqual({ status: 'ready' });
    await app.close();
  });

  it('requires authorization, explicit confirmation (428), and strict lock_session validation (400/202) on /v1/commands', async () => {
    const app = await buildApp();

    const unauth = await app.inject({ method: 'GET', url: '/v1/events' });
    expect(unauth.statusCode).toBe(401);

    const authDevices = await app.inject({
      method: 'GET',
      url: '/v1/devices',
      headers: { authorization: 'Bearer dev-test-token' },
    });
    expect(authDevices.statusCode).toBe(200);
    expect(authDevices.json()).toEqual({
      mode: 'real',
      devices: [],
      empty_state: 'Eşleşmiş cihaz yok',
    });

    const authEvents = await app.inject({
      method: 'GET',
      url: '/v1/events',
      headers: { authorization: 'Bearer dev-test-token' },
    });
    expect(authEvents.statusCode).toBe(200);
    expect(authEvents.json()).toEqual({
      mode: 'real',
      events: [],
      empty_state: 'Gerçek olay kaydı yok',
      nextCursor: null,
    });

    await pairOwnedDevice(app, 'enc_dev_9f4a21c8');

    const badCommand = await app.inject({
      method: 'POST',
      url: '/v1/commands',
      headers: { authorization: 'Bearer dev-test-token' },
      payload: {
        target_device_id: 'enc_dev_9f4a21c8',
        action: 'lock_session',
        explicit_user_confirmation: false,
        event_id: '019339a2-7b40-7f12-9a10-8e4c1b204108',
      },
    });
    expect(badCommand.statusCode).toBe(428);
    expect(badCommand.json().error).toBe('explicit_user_confirmation_required');

    const unsupportedCommand = await app.inject({
      method: 'POST',
      url: '/v1/commands',
      headers: { authorization: 'Bearer dev-test-token' },
      payload: {
        command: 'request_diagnostics',
        target_device_id: 'enc_dev_9f4a21c8',
        explicit_user_confirmation: true,
      },
    });
    expect(unsupportedCommand.statusCode).toBe(400);
    expect(unsupportedCommand.json().error).toBe('invalid_command_payload');

    const unknownFieldCommand = await app.inject({
      method: 'POST',
      url: '/v1/commands',
      headers: { authorization: 'Bearer dev-test-token' },
      payload: {
        command: 'lock_session',
        target_device_id: 'enc_dev_9f4a21c8',
        explicit_user_confirmation: true,
        unexpected_field: 'reject-me',
      },
    });
    expect(unknownFieldCommand.statusCode).toBe(400);

    const okCommand = await app.inject({
      method: 'POST',
      url: '/v1/commands',
      headers: { authorization: 'Bearer dev-test-token' },
      payload: {
        target_device_id: 'enc_dev_9f4a21c8',
        action: 'lock_session',
        explicit_user_confirmation: true,
        event_id: '019339a2-7b40-7f12-9a10-8e4c1b204108',
      },
    });
    expect(okCommand.statusCode).toBe(202);
    expect(okCommand.json().status).toBe('queued_for_device');

    const simpleLockCommand = await app.inject({
      method: 'POST',
      url: '/v1/commands',
      headers: { authorization: 'Bearer dev-test-token' },
      payload: {
        command: 'lock_session',
        target_device_id: 'enc_dev_9f4a21c8',
        explicit_user_confirmation: true,
      },
    });
    expect(simpleLockCommand.statusCode).toBe(202);
    expect(simpleLockCommand.json().status).toBe('queued_for_device');
    await app.close();
  });

  it('supports persistent real shares with confirmation gating on POST/DELETE and blocks reuse after revocation', async () => {
    const app = await buildApp();
    const authHeaders = { authorization: 'Bearer dev-test-token' };

    const emptyShares = await app.inject({
      method: 'GET',
      url: '/v1/shares',
      headers: authHeaders,
    });
    expect(emptyShares.statusCode).toBe(200);
    expect(emptyShares.json()).toEqual({
      mode: 'real',
      shares: [],
      empty_state: 'Aktif paylaşım yok',
    });

    await pairOwnedDevice(app, 'enc_dev_9f4a21c8');

    const unconfirmedShare = await app.inject({
      method: 'POST',
      url: '/v1/shares',
      headers: authHeaders,
      payload: {
        device_id: 'enc_dev_9f4a21c8',
        expires_at: '2026-12-18T12:00:00Z',
        explicit_user_confirmation: false,
      },
    });
    expect(unconfirmedShare.statusCode).toBe(428);
    expect(unconfirmedShare.json().error).toBe('explicit_user_confirmation_required');

    const createdShare = await app.inject({
      method: 'POST',
      url: '/v1/shares',
      headers: authHeaders,
      payload: {
        device_id: 'enc_dev_9f4a21c8',
        expires_at: '2026-12-18T12:00:00Z',
        explicit_user_confirmation: true,
      },
    });
    expect(createdShare.statusCode).toBe(201);
    const createdBody = createdShare.json();
    expect(createdBody.active).toBe(true);
    expect(createdBody.share_id).toMatch(/^shr-/);

    const unconfirmedRevoke = await app.inject({
      method: 'DELETE',
      url: `/v1/shares/${createdBody.share_id}`,
      headers: authHeaders,
    });
    expect(unconfirmedRevoke.statusCode).toBe(428);
    expect(unconfirmedRevoke.json().error).toBe('explicit_user_confirmation_required');

    const revokedShare = await app.inject({
      method: 'DELETE',
      url: `/v1/shares/${createdBody.share_id}`,
      headers: authHeaders,
      payload: { explicit_user_confirmation: true },
    });
    expect(revokedShare.statusCode).toBe(200);
    expect(revokedShare.json().active).toBe(false);

    const reRevoke = await app.inject({
      method: 'DELETE',
      url: `/v1/shares/${createdBody.share_id}`,
      headers: authHeaders,
      payload: { explicit_user_confirmation: true },
    });
    expect(reRevoke.statusCode).toBe(409);
    expect(reRevoke.json().error).toBe('share_already_revoked');

    const listAfterRevoke = await app.inject({
      method: 'GET',
      url: '/v1/shares',
      headers: authHeaders,
    });
    expect(listAfterRevoke.statusCode).toBe(200);
    expect(listAfterRevoke.json()).toEqual({
      mode: 'real',
      shares: [],
      empty_state: 'Aktif paylaşım yok',
    });

    await app.close();
  });
});
