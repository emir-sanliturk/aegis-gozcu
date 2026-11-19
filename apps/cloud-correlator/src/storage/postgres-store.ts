import type {
  AppendEventResult,
  AuditLogEntry,
  AuditStore,
  CommandStore,
  DeviceStore,
  EventStore,
  ShareStore,
  SqlExecutor,
  StoredCommand,
  StoredDevice,
  StoredEventEnvelope,
  StoredShare,
} from './types';

export const POSTGRES_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  role TEXT NOT NULL DEFAULT 'owner',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO users (user_id, role, status)
VALUES ('usr-owner-default', 'owner', 'active')
ON CONFLICT (user_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS devices (
  device_id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL DEFAULT 'usr-owner-default' REFERENCES users(user_id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  hostname TEXT NOT NULL,
  owner_signing_public_key TEXT NOT NULL,
  device_signing_public_key TEXT NOT NULL,
  device_agreement_public_key TEXT NOT NULL,
  hkdf_session_key_id TEXT NOT NULL,
  protocol_version TEXT NOT NULL,
  paired_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS pairing_nonces (
  nonce TEXT PRIMARY KEY,
  seen_at_ms BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  seq BIGSERIAL PRIMARY KEY,
  owner_user_id TEXT NOT NULL DEFAULT 'usr-owner-default' REFERENCES users(user_id) ON DELETE CASCADE,
  schema_version TEXT NOT NULL,
  event_id UUID UNIQUE NOT NULL,
  device_id TEXT NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ NOT NULL,
  ciphertext TEXT NOT NULL,
  nonce TEXT NOT NULL,
  auth_tag TEXT NOT NULL,
  signature TEXT NOT NULL,
  prev_event_hash CHAR(64),
  event_hash CHAR(64) UNIQUE NOT NULL,
  UNIQUE(device_id, nonce)
);

CREATE TABLE IF NOT EXISTS shares (
  share_id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  device_id TEXT NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  access_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commands (
  command_id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  target_device_id TEXT NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('lock_session')),
  event_id UUID REFERENCES events(event_id) ON DELETE SET NULL,
  explicit_user_confirmation BOOLEAN NOT NULL CHECK (explicit_user_confirmation = TRUE),
  status TEXT NOT NULL DEFAULT 'queued_for_device',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_user_id TEXT,
  action TEXT NOT NULL,
  target_id TEXT,
  outcome TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  ip_hash CHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

async function ensurePgUser(sql: SqlExecutor, userId: string): Promise<void> {
  await sql.query(
    "INSERT INTO users (user_id, role, status) VALUES ($1, 'owner', 'active') ON CONFLICT (user_id) DO NOTHING",
    [userId]
  );
}

export class PostgresDeviceStore implements DeviceStore {
  constructor(private readonly sql: SqlExecutor) {}

  async initSchema(): Promise<void> {
    await this.sql.query(POSTGRES_SCHEMA_SQL);
  }

  async consumePairingNonce(nonce: string, seenAtMs = Date.now()): Promise<boolean> {
    const res = await this.sql.query(
      'INSERT INTO pairing_nonces (nonce, seen_at_ms) VALUES ($1, $2) ON CONFLICT (nonce) DO NOTHING',
      [nonce, seenAtMs]
    );
    return res.rowCount === 1;
  }

  async upsertDevice(device: StoredDevice): Promise<void> {
    const ownerUserId = device.owner_user_id ?? 'usr-owner-default';
    await ensurePgUser(this.sql, ownerUserId);
    await this.sql.query(
      `INSERT INTO devices (
        device_id, owner_user_id, platform, hostname,
        owner_signing_public_key, device_signing_public_key,
        device_agreement_public_key, hkdf_session_key_id,
        protocol_version, paired_at, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (device_id) DO UPDATE SET
        owner_user_id = EXCLUDED.owner_user_id,
        platform = EXCLUDED.platform,
        hostname = EXCLUDED.hostname,
        owner_signing_public_key = EXCLUDED.owner_signing_public_key,
        device_signing_public_key = EXCLUDED.device_signing_public_key,
        device_agreement_public_key = EXCLUDED.device_agreement_public_key,
        hkdf_session_key_id = EXCLUDED.hkdf_session_key_id,
        protocol_version = EXCLUDED.protocol_version,
        paired_at = EXCLUDED.paired_at,
        status = EXCLUDED.status`,
      [
        device.device_id,
        ownerUserId,
        device.platform,
        device.hostname,
        device.owner_signing_public_key,
        device.device_signing_public_key,
        device.device_agreement_public_key,
        device.hkdf_session_key_id,
        device.protocol_version,
        device.paired_at,
        device.status,
      ]
    );
  }

  async findDevice(deviceId: string): Promise<StoredDevice | null> {
    const res = await this.sql.query<StoredDevice>(
      'SELECT * FROM devices WHERE device_id = $1 LIMIT 1',
      [deviceId]
    );
    return res.rows[0] ?? null;
  }

  async listDevices(ownerUserId?: string): Promise<StoredDevice[]> {
    if (ownerUserId) {
      const res = await this.sql.query<StoredDevice>(
        'SELECT * FROM devices WHERE owner_user_id = $1 ORDER BY paired_at DESC',
        [ownerUserId]
      );
      return res.rows;
    }
    const res = await this.sql.query<StoredDevice>(
      'SELECT * FROM devices ORDER BY paired_at DESC'
    );
    return res.rows;
  }

  async updateDeviceStatus(
    deviceId: string,
    status: StoredDevice['status']
  ): Promise<boolean> {
    const res = await this.sql.query(
      'UPDATE devices SET status = $1 WHERE device_id = $2',
      [status, deviceId]
    );
    return res.rowCount > 0;
  }

  async close(): Promise<void> {
    await this.sql.close?.();
  }
}

export class PostgresEventStore implements EventStore {
  constructor(private readonly sql: SqlExecutor) {}

  async initSchema(): Promise<void> {
    await this.sql.query(POSTGRES_SCHEMA_SQL);
  }

  async last(): Promise<StoredEventEnvelope | null> {
    const res = await this.sql.query<StoredEventEnvelope>(
      'SELECT * FROM events ORDER BY seq DESC LIMIT 1'
    );
    return res.rows[0] ?? null;
  }

  async appendEvent(
    event: Omit<StoredEventEnvelope, 'seq'>
  ): Promise<AppendEventResult> {
    const ownerUserId = event.owner_user_id ?? 'usr-owner-default';
    return this.sql.transaction(async (client) => {
      const lastRes = await client.query<{ event_hash: string }>(
        'SELECT event_hash FROM events ORDER BY seq DESC LIMIT 1 FOR UPDATE'
      );
      const expectedPrev = lastRes.rows[0]?.event_hash ?? null;

      if (expectedPrev !== event.prev_event_hash) {
        return {
          ok: false,
          reason: 'event_chain_mismatch',
          expected_prev_event_hash: expectedPrev,
        };
      }

      const nonceCheck = await client.query(
        'SELECT 1 FROM events WHERE device_id = $1 AND nonce = $2 LIMIT 1',
        [event.device_id, event.nonce]
      );
      if (nonceCheck.rows.length > 0) {
        return {
          ok: false,
          reason: 'nonce_replay_detected',
          expected_prev_event_hash: expectedPrev,
        };
      }

      const idCheck = await client.query(
        'SELECT 1 FROM events WHERE event_id = $1 LIMIT 1',
        [event.event_id]
      );
      if (idCheck.rows.length > 0) {
        return {
          ok: false,
          reason: 'duplicate_event_id',
          expected_prev_event_hash: expectedPrev,
        };
      }

      const insertRes = await client.query<{ seq: number }>(
        `INSERT INTO events (
          owner_user_id, schema_version, event_id, device_id, timestamp,
          ciphertext, nonce, auth_tag, signature,
          prev_event_hash, event_hash
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING seq`,
        [
          ownerUserId,
          event.schema_version,
          event.event_id,
          event.device_id,
          event.timestamp,
          event.ciphertext,
          event.nonce,
          event.auth_tag,
          event.signature,
          event.prev_event_hash,
          event.event_hash,
        ]
      );

      return {
        ok: true,
        event: {
          ...event,
          owner_user_id: ownerUserId,
          seq: Number(insertRes.rows[0]?.seq ?? 0),
        },
      };
    });
  }

  async listEvents(options?: {
    deviceId?: string;
    ownerUserId?: string;
    limit?: number;
  }): Promise<StoredEventEnvelope[]> {
    const limit = Math.min(Math.max(options?.limit ?? 50, 1), 200);
    if (options?.deviceId && options?.ownerUserId) {
      const res = await this.sql.query<StoredEventEnvelope>(
        'SELECT * FROM events WHERE device_id = $1 AND owner_user_id = $2 ORDER BY seq DESC LIMIT $3',
        [options.deviceId, options.ownerUserId, limit]
      );
      return res.rows;
    }
    if (options?.deviceId) {
      const res = await this.sql.query<StoredEventEnvelope>(
        'SELECT * FROM events WHERE device_id = $1 ORDER BY seq DESC LIMIT $2',
        [options.deviceId, limit]
      );
      return res.rows;
    }
    if (options?.ownerUserId) {
      const res = await this.sql.query<StoredEventEnvelope>(
        'SELECT * FROM events WHERE owner_user_id = $1 ORDER BY seq DESC LIMIT $2',
        [options.ownerUserId, limit]
      );
      return res.rows;
    }
    const res = await this.sql.query<StoredEventEnvelope>(
      'SELECT * FROM events ORDER BY seq DESC LIMIT $1',
      [limit]
    );
    return res.rows;
  }

  async countEvents(): Promise<number> {
    const res = await this.sql.query<{ cnt: string | number }>(
      'SELECT COUNT(*) AS cnt FROM events'
    );
    return Number(res.rows[0]?.cnt ?? 0);
  }

  async close(): Promise<void> {
    await this.sql.close?.();
  }
}

export class PostgresShareStore implements ShareStore {
  constructor(private readonly sql: SqlExecutor) {}

  async createShare(share: StoredShare): Promise<StoredShare> {
    await ensurePgUser(this.sql, share.owner_user_id);
    const updatedAt = share.updated_at ?? share.created_at;
    await this.sql.query(
      `INSERT INTO shares (
        share_id, owner_user_id, device_id, active, status,
        expires_at, revoked_at, access_count, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        share.share_id,
        share.owner_user_id,
        share.device_id,
        share.active,
        share.status,
        share.expires_at,
        share.revoked_at,
        share.access_count,
        share.created_at,
        updatedAt,
      ]
    );
    return { ...share, updated_at: updatedAt };
  }

  async findShare(shareId: string): Promise<StoredShare | null> {
    const res = await this.sql.query<StoredShare>(
      'SELECT * FROM shares WHERE share_id = $1 LIMIT 1',
      [shareId]
    );
    return res.rows[0] ?? null;
  }

  async listActiveShares(ownerUserId: string, nowIso = new Date().toISOString()): Promise<StoredShare[]> {
    await this.sql.query(
      "UPDATE shares SET active = FALSE, status = 'expired', updated_at = $1 WHERE active = TRUE AND status = 'active' AND expires_at <= $1",
      [nowIso]
    );
    const res = await this.sql.query<StoredShare>(
      "SELECT * FROM shares WHERE owner_user_id = $1 AND active = TRUE AND status = 'active' AND expires_at > $2 ORDER BY created_at DESC",
      [ownerUserId, nowIso]
    );
    return res.rows;
  }

  async revokeShare(
    shareId: string,
    ownerUserId: string,
    revokedAt: string
  ): Promise<
    | { ok: true; share: StoredShare }
    | { ok: false; reason: 'not_found' | 'forbidden' | 'already_revoked' }
  > {
    const existing = await this.findShare(shareId);
    if (!existing) return { ok: false, reason: 'not_found' };
    if (existing.owner_user_id !== ownerUserId) return { ok: false, reason: 'forbidden' };
    if (existing.status === 'revoked' || !existing.active) {
      return { ok: false, reason: 'already_revoked' };
    }

    await this.sql.query(
      "UPDATE shares SET active = FALSE, status = 'revoked', revoked_at = $1, updated_at = $1 WHERE share_id = $2 AND owner_user_id = $3",
      [revokedAt, shareId, ownerUserId]
    );
    const updated = await this.findShare(shareId);
    return {
      ok: true,
      share: updated ?? {
        ...existing,
        active: false,
        status: 'revoked',
        revoked_at: revokedAt,
        updated_at: revokedAt,
      },
    };
  }

  async close(): Promise<void> {}
}

export class PostgresCommandStore implements CommandStore {
  constructor(private readonly sql: SqlExecutor) {}

  async createCommand(command: StoredCommand): Promise<StoredCommand> {
    await ensurePgUser(this.sql, command.owner_user_id);
    const updatedAt = command.updated_at ?? command.created_at;
    await this.sql.query(
      `INSERT INTO commands (
        command_id, owner_user_id, target_device_id, action,
        event_id, explicit_user_confirmation, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        command.command_id,
        command.owner_user_id,
        command.target_device_id,
        command.action,
        command.event_id,
        true,
        command.status,
        command.created_at,
        updatedAt,
      ]
    );
    return { ...command, updated_at: updatedAt };
  }

  async listCommands(ownerUserId: string, limit = 50): Promise<StoredCommand[]> {
    const safeLimit = Math.min(Math.max(limit, 1), 200);
    const res = await this.sql.query<StoredCommand>(
      'SELECT * FROM commands WHERE owner_user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [ownerUserId, safeLimit]
    );
    return res.rows;
  }

  async close(): Promise<void> {}
}

export class PostgresAuditStore implements AuditStore {
  constructor(private readonly sql: SqlExecutor) {}

  async recordAudit(entry: AuditLogEntry): Promise<void> {
    await this.sql.query(
      `INSERT INTO audit_logs (
        actor_user_id, action, target_id, outcome, status_code, ip_hash, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        entry.actor_user_id,
        entry.action,
        entry.target_id,
        entry.outcome,
        entry.status_code,
        entry.ip_hash,
        entry.created_at ?? new Date().toISOString(),
      ]
    );
  }

  async close(): Promise<void> {}
}
