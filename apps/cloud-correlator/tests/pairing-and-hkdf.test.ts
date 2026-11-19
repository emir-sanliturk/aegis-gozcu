import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import { AEGIS_PINO_REDACT_CONFIG } from '../src/security/logger-redaction';
import {
  PAIRING_PROTOCOL_VERSION,
  buildPairingTranscript,
} from '../src/security/pairing-crypto';
import { createStoresFromEnv } from '../src/storage/factory';
import { JsonDeviceStore, JsonEventStore } from '../src/storage/json-store';
import {
  PgPoolSqlExecutor,
  redactConnectionString,
  runPostgresMigrations,
  type PoolLike,
} from '../src/storage/postgres-pool';
import type { SqlClient, SqlExecutor, SqlQueryResult } from '../src/storage/types';

function exportPublicDerBase64(key: crypto.KeyObject): string {
  return (key.export({ format: 'der', type: 'spki' }) as Buffer).toString('base64');
}

function buildSignedPairBody(overrides?: {
  deviceId?: string;
  nonce?: string;
  timestamp?: string;
  tamperSignature?: boolean;
}) {
  const ownerKeys = crypto.generateKeyPairSync('ed25519');
  const deviceSignKeys = crypto.generateKeyPairSync('ed25519');
  const deviceAgreeKeys = crypto.generateKeyPairSync('x25519');

  const deviceId = overrides?.deviceId ?? 'enc_dev_field_001';
  const nonce = overrides?.nonce ?? crypto.randomBytes(16).toString('hex');
  const timestamp = overrides?.timestamp ?? new Date().toISOString();

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

  const ownerSignature = crypto
    .sign(null, transcript, ownerKeys.privateKey)
    .toString('base64');
  const deviceSignature = crypto
    .sign(null, transcript, deviceSignKeys.privateKey)
    .toString('base64');

  return {
    deviceAgreePrivateKey: deviceAgreeKeys.privateKey,
    body: {
      protocol_version: PAIRING_PROTOCOL_VERSION,
      device_id: deviceId,
      platform: 'macos' as const,
      hostname: 'macbook-field-test',
      owner_signing_public_key: ownerSigningPublicKey,
      device_signing_public_key: deviceSigningPublicKey,
      device_agreement_public_key: deviceAgreementPublicKey,
      nonce,
      timestamp,
      owner_signature: overrides?.tamperSignature
        ? Buffer.from(crypto.randomBytes(64)).toString('base64')
        : ownerSignature,
      device_signature: deviceSignature,
    },
  };
}

describe('Field Verification: Pairing, HKDF-SHA256, Storage Guards, and Redaction', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('verifies mutual Ed25519 signatures bound to nonce/timestamp/protocol_version and derives matching HKDF-SHA256 key id', async () => {
    const app = await buildApp();
    const { body, deviceAgreePrivateKey } = buildSignedPairBody();

    const pairRes = await app.inject({
      method: 'POST',
      url: '/v1/devices/pair',
      headers: { authorization: 'Bearer owner-test-token' },
      payload: body,
    });

    expect(pairRes.statusCode).toBe(201);
    const json = pairRes.json() as {
      paired: boolean;
      device_id: string;
      protocol_version: string;
      server_agreement_public_key: string;
      hkdf_session_key_id: string;
      status: string;
    };

    expect(json.paired).toBe(true);
    expect(json.device_id).toBe(body.device_id);
    expect(json.protocol_version).toBe('1.0.0');

    // Client computes X25519 + HKDF-SHA256 independently and confirms matching key ID
    const serverPubKey = crypto.createPublicKey({
      key: Buffer.from(json.server_agreement_public_key, 'base64'),
      format: 'der',
      type: 'spki',
    });
    const clientSharedSecret = crypto.diffieHellman({
      privateKey: deviceAgreePrivateKey,
      publicKey: serverPubKey,
    });
    const clientDerived = Buffer.from(
      crypto.hkdfSync(
        'sha256',
        clientSharedSecret,
        Buffer.from(body.nonce, 'utf8'),
        Buffer.from(`aegis-nobet:session:v1:${body.device_id}`, 'utf8'),
        32
      )
    );
    const expectedKeyId = crypto
      .createHash('sha256')
      .update(clientDerived)
      .digest('hex')
      .slice(0, 16);
    clientSharedSecret.fill(0);
    clientDerived.fill(0);

    expect(json.hkdf_session_key_id).toBe(expectedKeyId);

    // Paired device is returned by GET /v1/devices without exposing keys
    const listRes = await app.inject({
      method: 'GET',
      url: '/v1/devices',
      headers: { authorization: 'Bearer owner-test-token' },
    });
    expect(listRes.statusCode).toBe(200);
    const listJson = listRes.json() as {
      mode: string;
      devices: Array<Record<string, unknown>>;
    };
    expect(listJson.mode).toBe('real');
    expect(listJson.devices).toHaveLength(1);
    expect(listJson.devices[0].device_id).toBe(body.device_id);
    expect(listJson.devices[0].owner_signing_public_key).toBeUndefined();
    expect(listJson.devices[0].device_signing_public_key).toBeUndefined();

    // Replaying exact same pairing request is rejected with 409 pairing_nonce_replay
    const replayRes = await app.inject({
      method: 'POST',
      url: '/v1/devices/pair',
      headers: { authorization: 'Bearer owner-test-token' },
      payload: body,
    });
    expect(replayRes.statusCode).toBe(409);
    expect(replayRes.json().error).toBe('pairing_nonce_replay');

    await app.close();
  });

  it('rejects stale/future pairing timestamps and forged transcript signatures', async () => {
    const app = await buildApp();

    const staleTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const stalePair = buildSignedPairBody({ timestamp: staleTime });
    const staleRes = await app.inject({
      method: 'POST',
      url: '/v1/devices/pair',
      headers: { authorization: 'Bearer owner-test-token' },
      payload: stalePair.body,
    });
    expect(staleRes.statusCode).toBe(401);
    expect(staleRes.json().error).toBe('pairing_timestamp_out_of_window');

    const futureTime = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const futurePair = buildSignedPairBody({ timestamp: futureTime });
    const futureRes = await app.inject({
      method: 'POST',
      url: '/v1/devices/pair',
      headers: { authorization: 'Bearer owner-test-token' },
      payload: futurePair.body,
    });
    expect(futureRes.statusCode).toBe(401);
    expect(futureRes.json().error).toBe('pairing_timestamp_out_of_window');

    const tamperedPair = buildSignedPairBody({ tamperSignature: true });
    const tamperedRes = await app.inject({
      method: 'POST',
      url: '/v1/devices/pair',
      headers: { authorization: 'Bearer owner-test-token' },
      payload: tamperedPair.body,
    });
    expect(tamperedRes.statusCode).toBe(401);
    expect(tamperedRes.json().error).toBe('invalid_owner_signature');

    // Non-X25519 agreement key (Ed25519 key passed as agreement key) must be rejected cleanly
    const ownerSignKeys = crypto.generateKeyPairSync('ed25519');
    const devSignKeys = crypto.generateKeyPairSync('ed25519');
    const badAgreeEdKey = crypto.generateKeyPairSync('ed25519');
    const badNonce = crypto.randomBytes(16).toString('hex');
    const badTs = new Date().toISOString();
    const badOwnerPub = exportPublicDerBase64(ownerSignKeys.publicKey);
    const badDevPub = exportPublicDerBase64(devSignKeys.publicKey);
    const badAgreePub = exportPublicDerBase64(badAgreeEdKey.publicKey);
    const badTranscript = buildPairingTranscript({
      protocol_version: PAIRING_PROTOCOL_VERSION,
      device_id: 'enc_dev_bad_agree',
      owner_signing_public_key: badOwnerPub,
      device_signing_public_key: badDevPub,
      device_agreement_public_key: badAgreePub,
      nonce: badNonce,
      timestamp: badTs,
    });
    const badAgreeRes = await app.inject({
      method: 'POST',
      url: '/v1/devices/pair',
      headers: { authorization: 'Bearer owner-test-token' },
      payload: {
        protocol_version: PAIRING_PROTOCOL_VERSION,
        device_id: 'enc_dev_bad_agree',
        platform: 'windows',
        hostname: 'win-bad-agree',
        owner_signing_public_key: badOwnerPub,
        device_signing_public_key: badDevPub,
        device_agreement_public_key: badAgreePub,
        nonce: badNonce,
        timestamp: badTs,
        owner_signature: crypto.sign(null, badTranscript, ownerSignKeys.privateKey).toString('base64'),
        device_signature: crypto.sign(null, badTranscript, devSignKeys.privateKey).toString('base64'),
      },
    });
    expect(badAgreeRes.statusCode).toBe(401);
    expect(badAgreeRes.json().error).toBe('invalid_x25519_agreement_key');

    await app.close();
  });

  it('rejects duplicate device_id pairing with 409 device_already_paired', async () => {
    const app = await buildApp();
    const first = buildSignedPairBody({ deviceId: 'enc_dev_dup_001' });
    const res1 = await app.inject({
      method: 'POST',
      url: '/v1/devices/pair',
      headers: { authorization: 'Bearer owner-test-token' },
      payload: first.body,
    });
    expect(res1.statusCode).toBe(201);

    const second = buildSignedPairBody({ deviceId: 'enc_dev_dup_001' });
    const res2 = await app.inject({
      method: 'POST',
      url: '/v1/devices/pair',
      headers: { authorization: 'Bearer owner-test-token' },
      payload: second.body,
    });
    expect(res2.statusCode).toBe(409);
    expect(res2.json().error).toBe('device_already_paired');
    await app.close();
  });

  it('forbids JsonDeviceStore, JsonEventStore, and JSON env paths in NODE_ENV=production', () => {
    process.env.NODE_ENV = 'production';
    expect(() => new JsonDeviceStore('/tmp/dev.json')).toThrow(
      'json_store_disallowed_in_production'
    );
    expect(() => new JsonEventStore('/tmp/ev.json')).toThrow(
      'json_store_disallowed_in_production'
    );

    process.env.AEGIS_DEVICE_STORE = '/tmp/dev.json';
    expect(() => createStoresFromEnv()).toThrow(
      'json_store_env_forbidden_in_production'
    );

    delete process.env.AEGIS_DEVICE_STORE;
    delete process.env.AEGIS_EVENT_STORE;
    delete process.env.AEGIS_SQLITE_PATH;
    expect(() => createStoresFromEnv()).toThrow(
      'persistent_storage_required_in_production'
    );

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-prod-sqlite-'));
    try {
      process.env.AEGIS_SQLITE_PATH = path.join(tmpDir, 'aegis.sqlite');
      const bundle = createStoresFromEnv();
      expect(bundle.backend).toBe('sqlite');
      void bundle.deviceStore.close();
      void bundle.eventStore.close();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('supports PostgreSQL SqlExecutor adapter transaction & chain queries cleanly', async () => {
    const queries: string[] = [];
    const mockClient: SqlClient = {
      async query<T = Record<string, unknown>>(
        sql: string
      ): Promise<SqlQueryResult<T>> {
        queries.push(sql);
        if (sql.includes('INSERT INTO pairing_nonces')) {
          return { rows: [{ nonce: 'n1' } as unknown as T], rowCount: 1 };
        }
        if (sql.includes('SELECT event_hash FROM events')) {
          return { rows: [], rowCount: 0 };
        }
        if (sql.includes('INSERT INTO events')) {
          return {
            rows: [{ seq: 1 } as unknown as T],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      },
    };

    const mockExecutor: SqlExecutor = {
      query: mockClient.query,
      async transaction<T>(fn: (c: SqlClient) => Promise<T>): Promise<T> {
        return fn(mockClient);
      },
    };

    const bundle = createStoresFromEnv({ postgresExecutor: mockExecutor });
    expect(bundle.backend).toBe('postgres');
    expect(await bundle.deviceStore.consumePairingNonce('n1')).toBe(true);
    const res = await bundle.eventStore.appendEvent({
      schema_version: '1.0.0',
      event_id: '019339a2-7b40-7f12-9a10-8e4c1b204108',
      device_id: 'enc_dev_pg_01',
      timestamp: new Date().toISOString(),
      ciphertext: 'cipher1234567890abcdef',
      nonce: 'nonce1234567890ab',
      auth_tag: 'tag1234567890abcd',
      signature: 'sig1234567890',
      prev_event_hash: null,
      event_hash: 'a'.repeat(64),
    });
    expect(res.ok).toBe(true);
    expect(queries.some((q) => q.includes('FOR UPDATE'))).toBe(true);
  });

  it('redacts database credentials and executes explicit BEGIN/COMMIT/ROLLBACK pool transactions & migrations', async () => {
    const redacted = redactConnectionString('postgres://aegis_user:SuperSecretPass!@db.internal:5432/aegis');
    expect(redacted).not.toContain('SuperSecretPass');
    expect(redacted).not.toContain('aegis_user');
    expect(redacted).toContain('db.internal:5432/aegis');

    const executed: string[] = [];
    const mockPool: PoolLike = {
      async query<T = Record<string, unknown>>(sql: string) {
        executed.push(sql);
        return { rows: [] as T[], rowCount: 0 };
      },
      async connect() {
        return {
          async query<T = Record<string, unknown>>(sql: string) {
            executed.push(sql);
            return { rows: [] as T[], rowCount: 0 };
          },
          release() {
            executed.push('RELEASE');
          },
        };
      },
      async end() {
        executed.push('END');
      },
    };

    const poolExec = new PgPoolSqlExecutor(mockPool);
    const applied = await runPostgresMigrations(poolExec);
    expect(applied).toContain('001_init.sql');
    expect(applied).toContain('002_users_shares_commands.sql');
    expect(executed[0]).toBe('BEGIN');
    expect(executed.some((s) => s.includes('CREATE TABLE IF NOT EXISTS events'))).toBe(true);
    expect(executed).toContain('COMMIT');
    expect(executed).toContain('RELEASE');

    await expect(
      poolExec.transaction(async () => {
        throw new Error('forced_rollback');
      })
    ).rejects.toThrow('forced_rollback');
    expect(executed).toContain('ROLLBACK');
    await poolExec.close();
  });

  it('configures Pino redaction for all keys, signatures, nonces, ciphertexts, and shared secrets', () => {
    const paths = AEGIS_PINO_REDACT_CONFIG.paths;
    for (const requiredPath of [
      '*.ciphertext',
      '*.nonce',
      '*.signature',
      '*.shared_secret',
      '*.derived_key',
      '*.session_key',
      '*.owner_signature',
      '*.device_signature',
      '*.private_key',
      '*.public_key',
    ]) {
      expect(paths).toContain(requiredPath);
    }
  });
});
