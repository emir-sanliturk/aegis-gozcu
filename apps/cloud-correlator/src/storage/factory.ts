import { DatabaseSync } from 'node:sqlite';
import {
  SqliteAuditStore,
  SqliteCommandStore,
  SqliteDeviceStore,
  SqliteEventStore,
  SqliteShareStore,
} from './sqlite-store';
import {
  JsonAuditStore,
  JsonCommandStore,
  JsonDeviceStore,
  JsonEventStore,
  JsonShareStore,
} from './json-store';
import {
  PostgresAuditStore,
  PostgresCommandStore,
  PostgresDeviceStore,
  PostgresEventStore,
  PostgresShareStore,
} from './postgres-store';
import type {
  AuditStore,
  CommandStore,
  DeviceStore,
  EventStore,
  ShareStore,
  SqlExecutor,
} from './types';

export interface StoreBundle {
  backend: 'sqlite' | 'postgres' | 'json-dev';
  deviceStore: DeviceStore;
  eventStore: EventStore;
  shareStore: ShareStore;
  commandStore: CommandStore;
  auditStore: AuditStore;
}

export function createStoresFromEnv(options?: {
  postgresExecutor?: SqlExecutor;
}): StoreBundle {
  const nodeEnv = process.env.NODE_ENV ?? 'development';

  if (options?.postgresExecutor) {
    return {
      backend: 'postgres',
      deviceStore: new PostgresDeviceStore(options.postgresExecutor),
      eventStore: new PostgresEventStore(options.postgresExecutor),
      shareStore: new PostgresShareStore(options.postgresExecutor),
      commandStore: new PostgresCommandStore(options.postgresExecutor),
      auditStore: new PostgresAuditStore(options.postgresExecutor),
    };
  }

  if (nodeEnv === 'production') {
    if (process.env.AEGIS_DEVICE_STORE || process.env.AEGIS_EVENT_STORE) {
      throw new Error('json_store_env_forbidden_in_production');
    }
    const sqlitePath = process.env.AEGIS_SQLITE_PATH;
    if (!sqlitePath) {
      throw new Error('persistent_storage_required_in_production');
    }
    const db = new DatabaseSync(sqlitePath);
    return {
      backend: 'sqlite',
      deviceStore: new SqliteDeviceStore(db),
      eventStore: new SqliteEventStore(db),
      shareStore: new SqliteShareStore(db),
      commandStore: new SqliteCommandStore(db),
      auditStore: new SqliteAuditStore(db),
    };
  }

  if (process.env.AEGIS_SQLITE_PATH) {
    const db = new DatabaseSync(process.env.AEGIS_SQLITE_PATH);
    return {
      backend: 'sqlite',
      deviceStore: new SqliteDeviceStore(db),
      eventStore: new SqliteEventStore(db),
      shareStore: new SqliteShareStore(db),
      commandStore: new SqliteCommandStore(db),
      auditStore: new SqliteAuditStore(db),
    };
  }

  if (process.env.AEGIS_DEVICE_STORE || process.env.AEGIS_EVENT_STORE) {
    return {
      backend: 'json-dev',
      deviceStore: new JsonDeviceStore(process.env.AEGIS_DEVICE_STORE),
      eventStore: new JsonEventStore(process.env.AEGIS_EVENT_STORE),
      shareStore: new JsonShareStore(),
      commandStore: new JsonCommandStore(),
      auditStore: new JsonAuditStore(),
    };
  }

  const memDb = new DatabaseSync(':memory:');
  return {
    backend: 'sqlite',
    deviceStore: new SqliteDeviceStore(memDb),
    eventStore: new SqliteEventStore(memDb),
    shareStore: new SqliteShareStore(memDb),
    commandStore: new SqliteCommandStore(memDb),
    auditStore: new SqliteAuditStore(memDb),
  };
}
