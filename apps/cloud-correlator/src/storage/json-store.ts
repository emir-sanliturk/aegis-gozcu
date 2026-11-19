import fs from 'node:fs';
import path from 'node:path';
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

function assertNotProduction(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('json_store_disallowed_in_production');
  }
}

export class JsonDeviceStore implements DeviceStore {
  private devices: StoredDevice[] = [];
  private readonly nonces = new Set<string>();

  constructor(private readonly filePath?: string) {
    assertNotProduction();
    if (filePath && fs.existsSync(filePath)) {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as {
        devices?: StoredDevice[];
        nonces?: string[];
      };
      this.devices = parsed.devices ?? [];
      for (const n of parsed.nonces ?? []) {
        this.nonces.add(n);
      }
    }
  }

  private flush(): void {
    assertNotProduction();
    if (!this.filePath) return;
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(
      this.filePath,
      JSON.stringify({ devices: this.devices, nonces: Array.from(this.nonces) }, null, 2),
      'utf8'
    );
  }

  async consumePairingNonce(nonce: string): Promise<boolean> {
    assertNotProduction();
    if (this.nonces.has(nonce)) {
      return false;
    }
    this.nonces.add(nonce);
    this.flush();
    return true;
  }

  async upsertDevice(device: StoredDevice): Promise<void> {
    assertNotProduction();
    const normalized: StoredDevice = {
      ...device,
      owner_user_id: device.owner_user_id ?? 'usr-owner-default',
    };
    const idx = this.devices.findIndex((d) => d.device_id === device.device_id);
    if (idx >= 0) {
      this.devices[idx] = normalized;
    } else {
      this.devices.push(normalized);
    }
    this.flush();
  }

  async findDevice(deviceId: string): Promise<StoredDevice | null> {
    return this.devices.find((d) => d.device_id === deviceId) ?? null;
  }

  async listDevices(ownerUserId?: string): Promise<StoredDevice[]> {
    if (ownerUserId) {
      return this.devices.filter((d) => (d.owner_user_id ?? 'usr-owner-default') === ownerUserId);
    }
    return [...this.devices];
  }

  async updateDeviceStatus(
    deviceId: string,
    status: StoredDevice['status']
  ): Promise<boolean> {
    assertNotProduction();
    const target = this.devices.find((d) => d.device_id === deviceId);
    if (!target) return false;
    target.status = status;
    this.flush();
    return true;
  }

  async close(): Promise<void> {}
}

export class JsonEventStore implements EventStore {
  private events: StoredEventEnvelope[] = [];

  constructor(private readonly filePath?: string) {
    assertNotProduction();
    if (filePath && fs.existsSync(filePath)) {
      this.events = JSON.parse(fs.readFileSync(filePath, 'utf8')) as StoredEventEnvelope[];
    }
  }

  private flush(): void {
    assertNotProduction();
    if (!this.filePath) return;
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.events, null, 2), 'utf8');
  }

  async last(): Promise<StoredEventEnvelope | null> {
    return this.events.length > 0 ? this.events[this.events.length - 1] : null;
  }

  async appendEvent(
    event: Omit<StoredEventEnvelope, 'seq'>
  ): Promise<AppendEventResult> {
    assertNotProduction();
    const expectedPrev = (await this.last())?.event_hash ?? null;
    if (expectedPrev !== event.prev_event_hash) {
      return {
        ok: false,
        reason: 'event_chain_mismatch',
        expected_prev_event_hash: expectedPrev,
      };
    }

    if (this.events.some((e) => e.device_id === event.device_id && e.nonce === event.nonce)) {
      return {
        ok: false,
        reason: 'nonce_replay_detected',
        expected_prev_event_hash: expectedPrev,
      };
    }

    if (this.events.some((e) => e.event_id === event.event_id)) {
      return {
        ok: false,
        reason: 'duplicate_event_id',
        expected_prev_event_hash: expectedPrev,
      };
    }

    const stored: StoredEventEnvelope = {
      ...event,
      owner_user_id: event.owner_user_id ?? 'usr-owner-default',
      seq: this.events.length + 1,
    };
    this.events.push(stored);
    this.flush();
    return { ok: true, event: stored };
  }

  async listEvents(options?: {
    deviceId?: string;
    ownerUserId?: string;
    limit?: number;
  }): Promise<StoredEventEnvelope[]> {
    const limit = Math.min(Math.max(options?.limit ?? 50, 1), 200);
    let filtered = this.events;
    if (options?.deviceId) {
      filtered = filtered.filter((e) => e.device_id === options.deviceId);
    }
    if (options?.ownerUserId) {
      filtered = filtered.filter(
        (e) => (e.owner_user_id ?? 'usr-owner-default') === options.ownerUserId
      );
    }
    return [...filtered].reverse().slice(0, limit);
  }

  async countEvents(): Promise<number> {
    return this.events.length;
  }

  async close(): Promise<void> {}
}

export class JsonShareStore implements ShareStore {
  private readonly shares = new Map<string, StoredShare>();

  constructor() {
    assertNotProduction();
  }

  async createShare(share: StoredShare): Promise<StoredShare> {
    assertNotProduction();
    this.shares.set(share.share_id, share);
    return share;
  }

  async findShare(shareId: string): Promise<StoredShare | null> {
    return this.shares.get(shareId) ?? null;
  }

  async listActiveShares(ownerUserId: string, nowIso = new Date().toISOString()): Promise<StoredShare[]> {
    const result: StoredShare[] = [];
    for (const share of this.shares.values()) {
      if (share.active && share.status === 'active' && share.expires_at <= nowIso) {
        share.active = false;
        share.status = 'expired';
      }
      if (share.owner_user_id === ownerUserId && share.active && share.status === 'active') {
        result.push(share);
      }
    }
    return result;
  }

  async revokeShare(
    shareId: string,
    ownerUserId: string,
    revokedAt: string
  ): Promise<
    | { ok: true; share: StoredShare }
    | { ok: false; reason: 'not_found' | 'forbidden' | 'already_revoked' }
  > {
    assertNotProduction();
    const existing = this.shares.get(shareId);
    if (!existing) return { ok: false, reason: 'not_found' };
    if (existing.owner_user_id !== ownerUserId) return { ok: false, reason: 'forbidden' };
    if (existing.status === 'revoked' || !existing.active) {
      return { ok: false, reason: 'already_revoked' };
    }
    existing.active = false;
    existing.status = 'revoked';
    existing.revoked_at = revokedAt;
    return { ok: true, share: existing };
  }

  async close(): Promise<void> {}
}

export class JsonCommandStore implements CommandStore {
  private readonly commands: StoredCommand[] = [];

  constructor() {
    assertNotProduction();
  }

  async createCommand(command: StoredCommand): Promise<StoredCommand> {
    assertNotProduction();
    this.commands.unshift(command);
    return command;
  }

  async listCommands(ownerUserId: string, limit = 50): Promise<StoredCommand[]> {
    return this.commands
      .filter((c) => c.owner_user_id === ownerUserId)
      .slice(0, Math.min(Math.max(limit, 1), 200));
  }

  async close(): Promise<void> {}
}

export class JsonAuditStore implements AuditStore {
  private readonly entries: AuditLogEntry[] = [];

  constructor() {
    assertNotProduction();
  }

  async recordAudit(entry: AuditLogEntry): Promise<void> {
    this.entries.push(entry);
    if (this.entries.length > 500) {
      this.entries.shift();
    }
  }

  async close(): Promise<void> {}
}
