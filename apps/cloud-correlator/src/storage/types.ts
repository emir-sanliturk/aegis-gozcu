export interface StoredDevice {
  device_id: string;
  owner_user_id?: string;
  platform: 'windows' | 'macos' | 'android' | 'ios' | 'cloud';
  hostname: string;
  owner_signing_public_key: string;
  device_signing_public_key: string;
  device_agreement_public_key: string;
  hkdf_session_key_id: string;
  protocol_version: string;
  paired_at: string;
  status: 'active' | 'locked' | 'revoked';
}

export interface StoredEventEnvelope {
  seq?: number;
  owner_user_id?: string;
  schema_version: '1.0.0';
  event_id: string;
  device_id: string;
  timestamp: string;
  ciphertext: string;
  nonce: string;
  auth_tag: string;
  signature: string;
  prev_event_hash: string | null;
  event_hash: string;
}

export interface StoredShare {
  share_id: string;
  owner_user_id: string;
  device_id: string;
  active: boolean;
  status: 'active' | 'revoked' | 'expired';
  expires_at: string;
  revoked_at: string | null;
  access_count: number;
  created_at: string;
  updated_at?: string;
}

export interface StoredCommand {
  command_id: string;
  owner_user_id: string;
  target_device_id: string;
  action: 'lock_session';
  event_id: string | null;
  explicit_user_confirmation: true;
  status: 'queued_for_device';
  created_at: string;
  updated_at?: string;
}

export interface AuditLogEntry {
  actor_user_id: string | null;
  action: string;
  target_id: string | null;
  outcome: string;
  status_code: number;
  ip_hash: string | null;
  created_at?: string;
}

export type AppendEventResult =
  | { ok: true; event: StoredEventEnvelope }
  | {
      ok: false;
      reason: 'event_chain_mismatch' | 'nonce_replay_detected' | 'duplicate_event_id';
      expected_prev_event_hash: string | null;
    };

export interface DeviceStore {
  consumePairingNonce(nonce: string, seenAtMs?: number): Promise<boolean>;
  upsertDevice(device: StoredDevice): Promise<void>;
  findDevice(deviceId: string): Promise<StoredDevice | null>;
  listDevices(ownerUserId?: string): Promise<StoredDevice[]>;
  updateDeviceStatus(deviceId: string, status: StoredDevice['status']): Promise<boolean>;
  close(): Promise<void>;
}

export interface EventStore {
  last(): Promise<StoredEventEnvelope | null>;
  appendEvent(
    event: Omit<StoredEventEnvelope, 'seq'>
  ): Promise<AppendEventResult>;
  listEvents(options?: {
    deviceId?: string;
    ownerUserId?: string;
    limit?: number;
  }): Promise<StoredEventEnvelope[]>;
  countEvents(): Promise<number>;
  close(): Promise<void>;
}

export interface ShareStore {
  createShare(share: StoredShare): Promise<StoredShare>;
  findShare(shareId: string): Promise<StoredShare | null>;
  listActiveShares(ownerUserId: string, nowIso?: string): Promise<StoredShare[]>;
  revokeShare(
    shareId: string,
    ownerUserId: string,
    revokedAt: string
  ): Promise<
    | { ok: true; share: StoredShare }
    | { ok: false; reason: 'not_found' | 'forbidden' | 'already_revoked' }
  >;
  close(): Promise<void>;
}

export interface CommandStore {
  createCommand(command: StoredCommand): Promise<StoredCommand>;
  listCommands(ownerUserId: string, limit?: number): Promise<StoredCommand[]>;
  close(): Promise<void>;
}

export interface AuditStore {
  recordAudit(entry: AuditLogEntry): Promise<void>;
  close(): Promise<void>;
}

export interface SqlQueryResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount: number;
}

export interface SqlClient {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<SqlQueryResult<T>>;
}

export interface SqlExecutor {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<SqlQueryResult<T>>;
  transaction<T>(fn: (client: SqlClient) => Promise<T>): Promise<T>;
  close?(): Promise<void>;
}
