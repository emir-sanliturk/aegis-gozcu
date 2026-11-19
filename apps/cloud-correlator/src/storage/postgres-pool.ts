import fs from 'node:fs';
import path from 'node:path';
import type { SqlClient, SqlExecutor, SqlQueryResult } from './types';

export interface PoolConnectionLike {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<{ rows: T[]; rowCount: number | null }>;
  release(): void;
}

export interface PoolLike {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<{ rows: T[]; rowCount: number | null }>;
  connect(): Promise<PoolConnectionLike>;
  end(): Promise<void>;
}

export function redactConnectionString(connectionString: string): string {
  try {
    const parsed = new URL(connectionString);
    if (parsed.password) {
      parsed.password = '[REDACTED]';
    }
    if (parsed.username) {
      parsed.username = '[REDACTED]';
    }
    return parsed.toString();
  } catch {
    return '[REDACTED_CONNECTION_STRING]';
  }
}

export class PgPoolSqlExecutor implements SqlExecutor {
  constructor(private readonly pool: PoolLike) {}

  async query<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = []
  ): Promise<SqlQueryResult<T>> {
    const result = await this.pool.query<T>(sql, params);
    return {
      rows: result.rows ?? [],
      rowCount: Number(result.rowCount ?? 0),
    };
  }

  async transaction<T>(fn: (client: SqlClient) => Promise<T>): Promise<T> {
    const conn = await this.pool.connect();
    const client: SqlClient = {
      async query<R = Record<string, unknown>>(
        sql: string,
        params: unknown[] = []
      ): Promise<SqlQueryResult<R>> {
        const result = await conn.query<R>(sql, params);
        return {
          rows: result.rows ?? [],
          rowCount: Number(result.rowCount ?? 0),
        };
      },
    };

    try {
      await client.query('BEGIN');
      const output = await fn(client);
      await client.query('COMMIT');
      return output;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ignore rollback error after primary failure
      }
      throw error;
    } finally {
      conn.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

export function resolveDatabaseUrlFromEnv(): string | undefined {
  let databaseUrl = process.env.DATABASE_URL ?? process.env.AEGIS_DATABASE_URL;
  if (!databaseUrl) return undefined;

  let dbPassword = process.env.AEGIS_DB_PASSWORD;
  if (!dbPassword) {
    const pwFile = process.env.POSTGRES_PASSWORD_FILE ?? '/run/secrets/postgres_password';
    if (fs.existsSync(pwFile)) {
      dbPassword = fs.readFileSync(pwFile, 'utf8').trim();
    }
  }

  if (dbPassword) {
    try {
      const parsed = new URL(databaseUrl);
      if (!parsed.password) {
        parsed.password = dbPassword;
        databaseUrl = parsed.toString();
      }
    } catch {
      // let pg validate malformed URL
    }
  }
  return databaseUrl;
}

export function resolveMigrationsDir(): string {
  const baseDir = import.meta.dirname ?? '.';
  const candidates = [
    path.resolve(baseDir, '../migrations'),
    path.resolve(baseDir, '../../migrations'),
    path.resolve(process.cwd(), 'migrations'),
    path.resolve(process.cwd(), 'apps/cloud-correlator/migrations'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return candidates[1];
}

export async function createPostgresPoolFromEnv(
  connectionString = resolveDatabaseUrlFromEnv()
): Promise<PgPoolSqlExecutor> {
  if (!connectionString) {
    throw new Error('database_url_required');
  }

  let pgModule: { Pool?: new (config: { connectionString: string; max: number }) => PoolLike };
  try {
    const moduleName = 'pg';
    pgModule = (await import(moduleName)) as typeof pgModule;
  } catch {
    throw new Error(
      `pg_driver_not_installed_for:${redactConnectionString(connectionString)}`
    );
  }

  if (!pgModule.Pool) {
    throw new Error('pg_pool_export_missing');
  }

  const pool = new pgModule.Pool({
    connectionString,
    max: 10,
  });
  return new PgPoolSqlExecutor(pool);
}

export async function runPostgresMigrations(
  executor: SqlExecutor,
  migrationsDir = resolveMigrationsDir()
): Promise<string[]> {
  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  const applied: string[] = [];
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    await executor.transaction(async (client) => {
      await client.query(sql);
    });
    applied.push(file);
  }
  return applied;
}
