import {
  createPostgresPoolFromEnv,
  redactConnectionString,
  resolveDatabaseUrlFromEnv,
  runPostgresMigrations,
} from './postgres-pool';

async function main(): Promise<void> {
  const databaseUrl = resolveDatabaseUrlFromEnv();
  if (!databaseUrl) {
    throw new Error('DATABASE_URL_or_AEGIS_DATABASE_URL_required_for_migration');
  }

  const executor = await createPostgresPoolFromEnv(databaseUrl);
  try {
    const applied = await runPostgresMigrations(executor);
    console.log(
      JSON.stringify({
        status: 'migrations_applied',
        target: redactConnectionString(databaseUrl),
        files: applied,
      })
    );
  } finally {
    await executor.close();
  }
}

main().catch((error) => {
  console.error(
    'postgres_migration_failed',
    error instanceof Error ? error.message : 'unknown_error'
  );
  process.exit(1);
});
