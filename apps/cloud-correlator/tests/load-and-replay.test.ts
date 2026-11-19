import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import {
  PAIRING_PROTOCOL_VERSION,
  buildEventSigningPayload,
  buildPairingTranscript,
} from '../src/security/pairing-crypto';
import { SqliteDeviceStore, SqliteEventStore } from '../src/storage/sqlite-store';

function exportPublicDerBase64(key: crypto.KeyObject): string {
  return (key.export({ format: 'der', type: 'spki' }) as Buffer).toString('base64');
}

function makeUuid(index: number): string {
  const hex = index.toString(16).padStart(12, '0');
  return `019339a2-7b40-7f12-9a10-${hex}`;
}

async function pairTestDevice(app: Awaited<ReturnType<typeof buildApp>>, deviceId: string) {
  const ownerKeys = crypto.generateKeyPairSync('ed25519');
  const deviceSignKeys = crypto.generateKeyPairSync('ed25519');
  const deviceAgreeKeys = crypto.generateKeyPairSync('x25519');

  const nonce = crypto.randomBytes(16).toString('hex');
  const timestamp = new Date().toISOString();

  const ownerSigningPublicKey = exportPublicDerBase64(ownerKeys.publicKey);
  const deviceSigningPublicKey = exportPublicDerBase64(deviceSignKeys.publicKey);
  const deviceAgreementPublicKey = exportPublicDerBase64(deviceAgreeKeys.publicKey);

  const transcript = buildPairingTranscript({
    protocol_version: PAIRING_PROTOCOL_VERSION,
    device_id: deviceId,
    owner_signing_public_key: ownerSigningPublicKey,
    device_signing_public_key: deviceSigningPublicKey,
    device_agreement_public_key: deviceAgreementPublicKey,
    nonce,
    timestamp,
  });

  const pairRes = await app.inject({
    method: 'POST',
    url: '/v1/devices/pair',
    headers: { authorization: 'Bearer owner-load-token' },
    payload: {
      protocol_version: PAIRING_PROTOCOL_VERSION,
      device_id: deviceId,
      platform: 'windows',
      hostname: 'win11-field-node',
      owner_signing_public_key: ownerSigningPublicKey,
      device_signing_public_key: deviceSigningPublicKey,
      device_agreement_public_key: deviceAgreementPublicKey,
      nonce,
      timestamp,
      owner_signature: crypto.sign(null, transcript, ownerKeys.privateKey).toString('base64'),
      device_signature: crypto.sign(null, transcript, deviceSignKeys.privateKey).toString('base64'),
    },
  });

  expect(pairRes.statusCode).toBe(201);
  return { deviceSignKeys };
}

function createSignedEvent(
  deviceId: string,
  devicePrivateKey: crypto.KeyObject,
  index: number,
  prevEventHash: string | null
) {
  const eventId = makeUuid(index);
  const timestamp = new Date().toISOString();
  const ciphertext = Buffer.from(`enc-payload-${index}-opaque-aesgcm`).toString('base64');
  const nonce = crypto.randomBytes(12).toString('base64');
  const authTag = crypto.randomBytes(16).toString('base64');

  const signingPayload = buildEventSigningPayload({
    schema_version: '1.0.0',
    event_id: eventId,
    device_id: deviceId,
    timestamp,
    ciphertext,
    nonce,
    auth_tag: authTag,
    prev_event_hash: prevEventHash,
  });

  const signature = crypto.sign(null, signingPayload, devicePrivateKey).toString('base64');

  return {
    schema_version: '1.0.0' as const,
    event_id: eventId,
    device_id: deviceId,
    timestamp,
    ciphertext,
    nonce,
    auth_tag: authTag,
    signature,
    prev_event_hash: prevEventHash,
  };
}

describe('Field Verification: 1,000-Event Append-Only Load, Replay, Signature & Rate-Limit', () => {
  it('ingests 1,000 Ed25519-signed chained encrypted events into transactional SQLite and rejects replay, tampering, and bad signatures', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-load-1000-'));
    const sqlitePath = path.join(tmpDir, 'events.sqlite');
    const db = new DatabaseSync(sqlitePath);
    const deviceStore = new SqliteDeviceStore(db);
    const eventStore = new SqliteEventStore(db);

    const app = await buildApp({
      deviceStore,
      eventStore,
      rateLimitRules: [{ prefix: '/v1/events', limitPerMinute: 5000 }],
    });

    try {
      const deviceId = 'enc_dev_load_1000';
      const { deviceSignKeys } = await pairTestDevice(app, deviceId);

      let prevHash: string | null = null;
      let firstEnvelope!: ReturnType<typeof createSignedEvent>;

      for (let i = 1; i <= 1000; i += 1) {
        const envelope = createSignedEvent(
          deviceId,
          deviceSignKeys.privateKey,
          i,
          prevHash
        );
        if (i === 1) {
          firstEnvelope = envelope;
        }

        const res = await app.inject({
          method: 'POST',
          url: '/v1/events/ingest',
          headers: { authorization: 'Bearer device-load-token' },
          payload: envelope,
        });

        expect(res.statusCode).toBe(202);
        const body = res.json() as {
          accepted: boolean;
          event_hash: string;
          seq: number;
          server_decrypted: boolean;
        };
        expect(body.accepted).toBe(true);
        expect(body.seq).toBe(i);
        expect(body.server_decrypted).toBe(false);
        prevHash = body.event_hash;
      }

      expect(await eventStore.countEvents()).toBe(1000);

      // 1. Replay attack with same (device_id, nonce) -> rejected
      const replayEnvelope = {
        ...createSignedEvent(deviceId, deviceSignKeys.privateKey, 1001, prevHash),
        nonce: firstEnvelope.nonce,
      };
      // Re-sign so it reaches transactional store replay check rather than failing signature check
      const replaySigPayload = buildEventSigningPayload(replayEnvelope);
      replayEnvelope.signature = crypto
        .sign(null, replaySigPayload, deviceSignKeys.privateKey)
        .toString('base64');

      const replayRes = await app.inject({
        method: 'POST',
        url: '/v1/events/ingest',
        headers: { authorization: 'Bearer device-load-token' },
        payload: replayEnvelope,
      });
      expect(replayRes.statusCode).toBe(409);
      expect(replayRes.json().error).toBe('nonce_replay_detected');

      // 2. Chain break (wrong prev_event_hash) -> rejected with expected_prev_event_hash
      const brokenChainEnvelope = createSignedEvent(
        deviceId,
        deviceSignKeys.privateKey,
        1002,
        'f'.repeat(64)
      );
      const chainBreakRes = await app.inject({
        method: 'POST',
        url: '/v1/events/ingest',
        headers: { authorization: 'Bearer device-load-token' },
        payload: brokenChainEnvelope,
      });
      expect(chainBreakRes.statusCode).toBe(409);
      expect(chainBreakRes.json().error).toBe('event_chain_mismatch');
      expect(chainBreakRes.json().expected_prev_event_hash).toBe(prevHash);

      // 3. Invalid Ed25519 signature -> rejected with 401
      const badSigEnvelope = createSignedEvent(
        deviceId,
        deviceSignKeys.privateKey,
        1003,
        prevHash
      );
      badSigEnvelope.signature = Buffer.from(crypto.randomBytes(64)).toString('base64');
      const badSigRes = await app.inject({
        method: 'POST',
        url: '/v1/events/ingest',
        headers: { authorization: 'Bearer device-load-token' },
        payload: badSigEnvelope,
      });
      expect(badSigRes.statusCode).toBe(401);
      expect(badSigRes.json().error).toBe('invalid_event_signature');

      // 4. Unpaired device -> rejected with 403
      const unknownDeviceEnvelope = createSignedEvent(
        'enc_dev_unpaired_99',
        deviceSignKeys.privateKey,
        1004,
        prevHash
      );
      const unpairedRes = await app.inject({
        method: 'POST',
        url: '/v1/events/ingest',
        headers: { authorization: 'Bearer device-load-token' },
        payload: unknownDeviceEnvelope,
      });
      expect(unpairedRes.statusCode).toBe(403);
      expect(unpairedRes.json().error).toBe('device_not_paired');

      // 5. Duplicate event_id (with fresh nonce) -> rejected with 409 duplicate_event_id
      const dupIdEnvelope = {
        ...createSignedEvent(deviceId, deviceSignKeys.privateKey, 1005, prevHash),
        event_id: firstEnvelope.event_id,
      };
      dupIdEnvelope.signature = crypto
        .sign(null, buildEventSigningPayload(dupIdEnvelope), deviceSignKeys.privateKey)
        .toString('base64');
      const dupIdRes = await app.inject({
        method: 'POST',
        url: '/v1/events/ingest',
        headers: { authorization: 'Bearer device-load-token' },
        payload: dupIdEnvelope,
      });
      expect(dupIdRes.statusCode).toBe(409);
      expect(dupIdRes.json().error).toBe('duplicate_event_id');

      // 6. Revoked device -> rejected with 403 device_not_paired
      expect(await deviceStore.updateDeviceStatus(deviceId, 'revoked')).toBe(true);
      const revokedEnvelope = createSignedEvent(
        deviceId,
        deviceSignKeys.privateKey,
        1006,
        prevHash
      );
      const revokedRes = await app.inject({
        method: 'POST',
        url: '/v1/events/ingest',
        headers: { authorization: 'Bearer device-load-token' },
        payload: revokedEnvelope,
      });
      expect(revokedRes.statusCode).toBe(403);
      expect(revokedRes.json().error).toBe('device_not_paired');

      // 7. GET /v1/events returns sanitized metadata without raw ciphertext/nonce/auth_tag
      const listRes = await app.inject({
        method: 'GET',
        url: '/v1/events?limit=5',
        headers: { authorization: 'Bearer device-load-token' },
      });
      expect(listRes.statusCode).toBe(200);
      const listed = listRes.json() as {
        events: Array<Record<string, unknown>>;
      };
      expect(listed.events).toHaveLength(5);
      expect(listed.events[0].ciphertext).toBeUndefined();
      expect(listed.events[0].auth_tag).toBeUndefined();
      expect(listed.events[0].nonce).toBeUndefined();
      expect(listed.events[0].server_decrypted).toBe(false);
    } finally {
      await app.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('enforces default WAF sliding-window rate limits on /v1/auth/session and /v1/events', async () => {
    const app = await buildApp();
    try {
      for (let i = 0; i < 5; i += 1) {
        const res = await app.inject({
          method: 'POST',
          url: '/v1/auth/session',
          headers: { 'x-forwarded-for': '203.0.113.10' },
        });
        expect(res.statusCode).toBe(201);
      }

      const sixthAuth = await app.inject({
        method: 'POST',
        url: '/v1/auth/session',
        headers: { 'x-forwarded-for': '203.0.113.10' },
      });
      expect(sixthAuth.statusCode).toBe(429);
      expect(sixthAuth.json().error).toBe('rate_limited');

      for (let i = 0; i < 120; i += 1) {
        const res = await app.inject({
          method: 'GET',
          url: '/v1/events',
          headers: {
            authorization: 'Bearer rate-test-token',
            'x-forwarded-for': '203.0.113.20',
          },
        });
        expect(res.statusCode).toBe(200);
      }

      const overLimitEvent = await app.inject({
        method: 'GET',
        url: '/v1/events',
        headers: {
          authorization: 'Bearer rate-test-token',
          'x-forwarded-for': '203.0.113.20',
        },
      });
      expect(overLimitEvent.statusCode).toBe(429);
      expect(overLimitEvent.json().error).toBe('rate_limited');
    } finally {
      await app.close();
    }
  });
});
