import fs from 'node:fs';
import { buildApp } from './app';
import { validateSessionSecret } from './security/auth-session';
import {
  createPostgresPoolFromEnv,
  resolveDatabaseUrlFromEnv,
  runPostgresMigrations,
} from './storage/postgres-pool';

function loadSecretFromFileIfPresent(envName: string, defaultSecretPath: string): void {
  if (process.env[envName]) return;
  const filePath = process.env[`${envName}_FILE`] ?? defaultSecretPath;
  if (fs.existsSync(filePath)) {
    process.env[envName] = fs.readFileSync(filePath, 'utf8').trim();
  }
}

async function start(): Promise<void> {
  const port = Number(process.env.PORT ?? 8080);
  const host = process.env.HOST ?? '0.0.0.0';

  loadSecretFromFileIfPresent('AEGIS_SESSION_SECRET', '/run/secrets/aegis_session_secret');
  loadSecretFromFileIfPresent('AEGIS_IP_PEPPER', '/run/secrets/aegis_ip_pepper');
  loadSecretFromFileIfPresent('AEGIS_DB_PASSWORD', '/run/secrets/postgres_password');

  if (process.env.NODE_ENV === 'production') {
    validateSessionSecret(process.env.AEGIS_SESSION_SECRET);
  }

  const databaseUrl = resolveDatabaseUrlFromEnv();
  let postgresExecutor;
  if (databaseUrl) {
    postgresExecutor = await createPostgresPoolFromEnv(databaseUrl);
    await runPostgresMigrations(postgresExecutor);
  }

  const app = await buildApp({
    postgresExecutor,
    requireExplicitCorsOrigins: process.env.NODE_ENV === 'production',
  });
  await app.listen({ port, host });
}

start().catch((error) => {
  console.error('cloud_correlator_boot_failed', error);
  process.exit(1);
});
