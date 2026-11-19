import { DatabaseSync } from 'node:sqlite';
import type {
  AppendEventResult,
  AuditLogEntry,
  AuditStore,
  CommandStore,
  DeviceStore,
  EventStore,
  ShareStore,
  StoredCommand,
  StoredDevice,
  StoredEventEnvelope,
  StoredShare,
} from './types';

function ensureColumn(
  db: DatabaseSync,
  table: string,
  column: string,
  definition: string
): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function initSchema(db: DatabaseSync): void {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      user_id TEXT PRIMARY KEY,
      role TEXT NOT NULL DEFAULT 'owner',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS devices (
      device_id TEXT PRIMARY KEY,
      owner_user_id TEXT NOT NULL DEFAULT 'usr-owner-default',
      platform TEXT NOT NULL,
      hostname TEXT NOT NULL,
      owner_signing_public_key TEXT NOT NULL,
      device_signing_public_key TEXT NOT NULL,
      device_agreement_public_key TEXT NOT NULL,
      hkdf_session_key_id TEXT NOT NULL,
      protocol_version TEXT NOT NULL,
      paired_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS pairing_nonces (
      nonce TEXT PRIMARY KEY,
      seen_at_ms INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS events (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_user_id TEXT NOT NULL DEFAULT 'usr-owner-default',
      schema_version TEXT NOT NULL,
      event_id TEXT UNIQUE NOT NULL,
      device_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      ciphertext TEXT NOT NULL,
      nonce TEXT NOT NULL,
      auth_tag TEXT NOT NULL,
      signature TEXT NOT NULL,
      prev_event_hash TEXT,
      event_hash TEXT UNIQUE NOT NULL,
      UNIQUE(device_id, nonce)
    );

    CREATE TABLE IF NOT EXISTS shares (
      share_id TEXT PRIMARY KEY,
      owner_user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      device_id TEXT NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
      active INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
      expires_at TEXT NOT NULL,
      revoked_at TEXT,
      access_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS commands (
      command_id TEXT PRIMARY KEY,
      owner_user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      target_device_id TEXT NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
      action TEXT NOT NULL CHECK (action IN ('lock_session')),
      event_id TEXT,
      explicit_user_confirmation INTEGER NOT NULL CHECK (explicit_user_confirmation = 1),
      status TEXT NOT NULL DEFAULT 'queued_for_device',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_user_id TEXT,
      action TEXT NOT NULL,
      target_id TEXT,
      outcome TEXT NOT NULL,
      status_code INTEGER NOT NULL,
      ip_hash TEXT,
      created_at TEXT NOT NULL
    );
  `);

  ensureColumn(db, 'devices', 'owner_user_id', "TEXT NOT NULL DEFAULT 'usr-owner-default'");
  ensureColumn(db, 'events', 'owner_user_id', "TEXT NOT NULL DEFAULT 'usr-owner-default'");
  ensureColumn(db, 'shares', 'updated_at', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'commands', 'updated_at', "TEXT NOT NULL DEFAULT ''");
}

function ensureUserRecord(db: DatabaseSync, userId: string): void {
  db.prepare(
    "INSERT OR IGNORE INTO users (user_id, role, status, created_at) VALUES (?, 'owner', 'active', ?)"
  ).run(userId, new Date().toISOString());
}

export class SqliteDeviceStore implements DeviceStore {
  private readonly db: DatabaseSync;
  private readonly ownsConnection: boolean;

  constructor(dbOrPath: DatabaseSync | string) {
    if (typeof dbOrPath === 'string') {
      this.db = new DatabaseSync(dbOrPath);
      this.ownsConnection = true;
    } else {
      this.db = dbOrPath;
      this.ownsConnection = false;
    }
    initSchema(this.db);
  }

  async consumePairingNonce(nonce: string, seenAtMs = Date.now()): Promise<boolean> {
    const stmt = this.db.prepare(
      'INSERT OR IGNORE INTO pairing_nonces (nonce, seen_at_ms) VALUES (?, ?)'
    );
    const result = stmt.run(nonce, seenAtMs);
    return Number(result.changes) === 1;
  }

  async upsertDevice(device: StoredDevice): Promise<void> {
    const ownerUserId = device.owner_user_id ?? 'usr-owner-default';
    ensureUserRecord(this.db, ownerUserId);
    const stmt = this.db.prepare(`
      INSERT INTO devices (
        device_id, owner_user_id, platform, hostname,
        owner_signing_public_key, device_signing_public_key,
        device_agreement_public_key, hkdf_session_key_id,
        protocol_version, paired_at, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(device_id) DO UPDATE SET
        owner_user_id = excluded.owner_user_id,
        platform = excluded.platform,
        hostname = excluded.hostname,
        owner_signing_public_key = excluded.owner_signing_public_key,
        device_signing_public_key = excluded.device_signing_public_key,
        device_agreement_public_key = excluded.device_agreement_public_key,
        hkdf_session_key_id = excluded.hkdf_session_key_id,
        protocol_version = excluded.protocol_version,
        paired_at = excluded.paired_at,
        status = excluded.status
    `);
    stmt.run(
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
      device.status
    );
  }

  async findDevice(deviceId: string): Promise<StoredDevice | null> {
    const stmt = this.db.prepare('SELECT * FROM devices WHERE device_id = ? LIMIT 1');
    const row = stmt.get(deviceId) as StoredDevice | undefined;
    return row ?? null;
  }

  async listDevices(ownerUserId?: string): Promise<StoredDevice[]> {
    if (ownerUserId) {
      const stmt = this.db.prepare(
        'SELECT * FROM devices WHERE owner_user_id = ? ORDER BY paired_at DESC'
      );
      return stmt.all(ownerUserId) as unknown as StoredDevice[];
    }
    const stmt = this.db.prepare('SELECT * FROM devices ORDER BY paired_at DESC');
    return stmt.all() as unknown as StoredDevice[];
  }

  async updateDeviceStatus(
    deviceId: string,
    status: StoredDevice['status']
  ): Promise<boolean> {
    const stmt = this.db.prepare('UPDATE devices SET status = ? WHERE device_id = ?');
    const res = stmt.run(status, deviceId);
    return Number(res.changes) > 0;
  }

  async close(): Promise<void> {
    if (this.ownsConnection) {
      this.db.close();
    }
  }
}

export class SqliteEventStore implements EventStore {
  private readonly db: DatabaseSync;
  private readonly ownsConnection: boolean;

  constructor(dbOrPath: DatabaseSync | string) {
    if (typeof dbOrPath === 'string') {
      this.db = new DatabaseSync(dbOrPath);
      this.ownsConnection = true;
    } else {
      this.db = dbOrPath;
      this.ownsConnection = false;
    }
    initSchema(this.db);
  }

  async last(): Promise<StoredEventEnvelope | null> {
    const stmt = this.db.prepare('SELECT * FROM events ORDER BY seq DESC LIMIT 1');
    const row = stmt.get() as StoredEventEnvelope | undefined;
    return row ?? null;
  }

  async appendEvent(
    event: Omit<StoredEventEnvelope, 'seq'>
  ): Promise<AppendEventResult> {
    const ownerUserId = event.owner_user_id ?? 'usr-owner-default';
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const lastRow = this.db
        .prepare('SELECT event_hash FROM events ORDER BY seq DESC LIMIT 1')
        .get() as { event_hash: string } | undefined;
      const expectedPrev = lastRow?.event_hash ?? null;

      if (expectedPrev !== event.prev_event_hash) {
        this.db.exec('ROLLBACK');
        return {
          ok: false,
          reason: 'event_chain_mismatch',
          expected_prev_event_hash: expectedPrev,
        };
      }

      const duplicateNonce = this.db
        .prepare('SELECT 1 FROM events WHERE device_id = ? AND nonce = ? LIMIT 1')
        .get(event.device_id, event.nonce);
      if (duplicateNonce) {
        this.db.exec('ROLLBACK');
        return {
          ok: false,
          reason: 'nonce_replay_detected',
          expected_prev_event_hash: expectedPrev,
        };
      }

      const duplicateId = this.db
        .prepare('SELECT 1 FROM events WHERE event_id = ? LIMIT 1')
        .get(event.event_id);
      if (duplicateId) {
        this.db.exec('ROLLBACK');
        return {
          ok: false,
          reason: 'duplicate_event_id',
          expected_prev_event_hash: expectedPrev,
        };
      }

      const insertStmt = this.db.prepare(`
        INSERT INTO events (
          owner_user_id, schema_version, event_id, device_id, timestamp,
          ciphertext, nonce, auth_tag, signature,
          prev_event_hash, event_hash
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const info = insertStmt.run(
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
        event.event_hash
      );
      this.db.exec('COMMIT');

      return {
        ok: true,
        event: {
          ...event,
          owner_user_id: ownerUserId,
          seq: Number(info.lastInsertRowid),
        },
      };
    } catch (error) {
      try {
        this.db.exec('ROLLBACK');
      } catch {
        // already rolled back
      }
      throw error;
    }
  }

  async listEvents(options?: {
    deviceId?: string;
    ownerUserId?: string;
    limit?: number;
  }): Promise<StoredEventEnvelope[]> {
    const limit = Math.min(Math.max(options?.limit ?? 50, 1), 200);
    if (options?.deviceId && options?.ownerUserId) {
      const stmt = this.db.prepare(
        'SELECT * FROM events WHERE device_id = ? AND owner_user_id = ? ORDER BY seq DESC LIMIT ?'
      );
      return stmt.all(options.deviceId, options.ownerUserId, limit) as unknown as StoredEventEnvelope[];
    }
    if (options?.deviceId) {
      const stmt = this.db.prepare(
        'SELECT * FROM events WHERE device_id = ? ORDER BY seq DESC LIMIT ?'
      );
      return stmt.all(options.deviceId, limit) as unknown as StoredEventEnvelope[];
    }
    if (options?.ownerUserId) {
      const stmt = this.db.prepare(
        'SELECT * FROM events WHERE owner_user_id = ? ORDER BY seq DESC LIMIT ?'
      );
      return stmt.all(options.ownerUserId, limit) as unknown as StoredEventEnvelope[];
    }
    const stmt = this.db.prepare('SELECT * FROM events ORDER BY seq DESC LIMIT ?');
    return stmt.all(limit) as unknown as StoredEventEnvelope[];
  }

  async countEvents(): Promise<number> {
    const row = this.db
      .prepare('SELECT COUNT(*) AS cnt FROM events')
      .get() as { cnt: number };
    return Number(row.cnt);
  }

  async close(): Promise<void> {
    if (this.ownsConnection) {
      this.db.close();
    }
  }
}

interface RawShareRow {
  share_id: string;
  owner_user_id: string;
  device_id: string;
  active: number;
  status: 'active' | 'revoked' | 'expired';
  expires_at: string;
  revoked_at: string | null;
  access_count: number;
  created_at: string;
  updated_at?: string;
}

function mapShareRow(row: RawShareRow): StoredShare {
  return {
    share_id: row.share_id,
    owner_user_id: row.owner_user_id,
    device_id: row.device_id,
    active: Boolean(row.active) && row.status === 'active',
    status: row.status,
    expires_at: row.expires_at,
    revoked_at: row.revoked_at,
    access_count: Number(row.access_count),
    created_at: row.created_at,
    updated_at: row.updated_at || row.created_at,
  };
}

export class SqliteShareStore implements ShareStore {
  private readonly db: DatabaseSync;
  private readonly ownsConnection: boolean;

  constructor(dbOrPath: DatabaseSync | string) {
    if (typeof dbOrPath === 'string') {
      this.db = new DatabaseSync(dbOrPath);
      this.ownsConnection = true;
    } else {
      this.db = dbOrPath;
      this.ownsConnection = false;
    }
    initSchema(this.db);
  }

  async createShare(share: StoredShare): Promise<StoredShare> {
    ensureUserRecord(this.db, share.owner_user_id);
    const updatedAt = share.updated_at ?? share.created_at;
    this.db.prepare(
      `INSERT INTO shares (
        share_id, owner_user_id, device_id, active, status,
        expires_at, revoked_at, access_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      share.share_id,
      share.owner_user_id,
      share.device_id,
      share.active ? 1 : 0,
      share.status,
      share.expires_at,
      share.revoked_at,
      share.access_count,
      share.created_at,
      updatedAt
    );
    return { ...share, updated_at: updatedAt };
  }

  async findShare(shareId: string): Promise<StoredShare | null> {
    const row = this.db
      .prepare('SELECT * FROM shares WHERE share_id = ? LIMIT 1')
      .get(shareId) as RawShareRow | undefined;
    return row ? mapShareRow(row) : null;
  }

  async listActiveShares(ownerUserId: string, nowIso = new Date().toISOString()): Promise<StoredShare[]> {
    this.db.prepare(
      "UPDATE shares SET active = 0, status = 'expired', updated_at = ? WHERE active = 1 AND status = 'active' AND expires_at <= ?"
    ).run(nowIso, nowIso);

    const rows = this.db
      .prepare(
        "SELECT * FROM shares WHERE owner_user_id = ? AND active = 1 AND status = 'active' AND expires_at > ? ORDER BY created_at DESC"
      )
      .all(ownerUserId, nowIso) as unknown as RawShareRow[];
    return rows.map(mapShareRow);
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
    if (!existing) {
      return { ok: false, reason: 'not_found' };
    }
    if (existing.owner_user_id !== ownerUserId) {
      return { ok: false, reason: 'forbidden' };
    }
    if (existing.status === 'revoked' || !existing.active) {
      return { ok: false, reason: 'already_revoked' };
    }

    this.db
      .prepare(
        "UPDATE shares SET active = 0, status = 'revoked', revoked_at = ?, updated_at = ? WHERE share_id = ? AND owner_user_id = ?"
      )
      .run(revokedAt, revokedAt, shareId, ownerUserId);

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

  async close(): Promise<void> {
    if (this.ownsConnection) {
      this.db.close();
    }
  }
}

export class SqliteCommandStore implements CommandStore {
  private readonly db: DatabaseSync;
  private readonly ownsConnection: boolean;

  constructor(dbOrPath: DatabaseSync | string) {
    if (typeof dbOrPath === 'string') {
      this.db = new DatabaseSync(dbOrPath);
      this.ownsConnection = true;
    } else {
      this.db = dbOrPath;
      this.ownsConnection = false;
    }
    initSchema(this.db);
  }

  async createCommand(command: StoredCommand): Promise<StoredCommand> {
    ensureUserRecord(this.db, command.owner_user_id);
    const updatedAt = command.updated_at ?? command.created_at;
    this.db.prepare(
      `INSERT INTO commands (
        command_id, owner_user_id, target_device_id, action,
        event_id, explicit_user_confirmation, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      command.command_id,
      command.owner_user_id,
      command.target_device_id,
      command.action,
      command.event_id,
      1,
      command.status,
      command.created_at,
      updatedAt
    );
    return { ...command, updated_at: updatedAt };
  }

  async listCommands(ownerUserId: string, limit = 50): Promise<StoredCommand[]> {
    const safeLimit = Math.min(Math.max(limit, 1), 200);
    const rows = this.db
      .prepare(
        'SELECT * FROM commands WHERE owner_user_id = ? ORDER BY created_at DESC LIMIT ?'
      )
      .all(ownerUserId, safeLimit) as unknown as Array<{
      command_id: string;
      owner_user_id: string;
      target_device_id: string;
      action: 'lock_session';
      event_id: string | null;
      status: 'queued_for_device';
      created_at: string;
      updated_at?: string;
    }>;

    return rows.map((r) => ({
      command_id: r.command_id,
      owner_user_id: r.owner_user_id,
      target_device_id: r.target_device_id,
      action: r.action,
      event_id: r.event_id,
      explicit_user_confirmation: true,
      status: r.status,
      created_at: r.created_at,
      updated_at: r.updated_at || r.created_at,
    }));
  }

  async close(): Promise<void> {
    if (this.ownsConnection) {
      this.db.close();
    }
  }
}

export class SqliteAuditStore implements AuditStore {
  private readonly db: DatabaseSync;
  private readonly ownsConnection: boolean;

  constructor(dbOrPath: DatabaseSync | string) {
    if (typeof dbOrPath === 'string') {
      this.db = new DatabaseSync(dbOrPath);
      this.ownsConnection = true;
    } else {
      this.db = dbOrPath;
      this.ownsConnection = false;
    }
    initSchema(this.db);
  }

  async recordAudit(entry: AuditLogEntry): Promise<void> {
    this.db.prepare(
      `INSERT INTO audit_logs (
        actor_user_id, action, target_id, outcome, status_code, ip_hash, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      entry.actor_user_id,
      entry.action,
      entry.target_id,
      entry.outcome,
      entry.status_code,
      entry.ip_hash,
      entry.created_at ?? new Date().toISOString()
    );
  }

  async close(): Promise<void> {
    if (this.ownsConnection) {
      this.db.close();
    }
  }
}
