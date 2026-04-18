import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db } from './client.js';
import { logger } from '../utils/logger.js';

const here = dirname(fileURLToPath(import.meta.url));
// Migrations are emitted by drizzle-kit into apps/server/drizzle/.
// From dist/db/migrate.js this resolves to dist/drizzle, which is wrong;
// we always ship migrations from repo-root-relative apps/server/drizzle.
const MIGRATIONS_FOLDER = resolve(here, '../../drizzle');

// Arbitrary 32-bit int used as the advisory-lock key. pg_advisory_lock
// namespaces serialize multi-replica boots: the first server grabs the
// lock, runs migrations, releases; the rest wait then see the drizzle
// migration ledger is already up to date and no-op. Keep stable across
// deploys. 32-bit keeps the value inside JS `number` and avoids driver
// bigint serialisation quirks.
const MIGRATION_LOCK_KEY = 0x4e455841; // "NEXA"

export async function runMigrations(): Promise<void> {
  logger.info({ folder: MIGRATIONS_FOLDER }, 'running migrations');
  // pg_advisory_lock blocks until acquired (default timeout: none). We
  // release via pg_advisory_unlock whether migrations succeed or fail so
  // other processes aren't stuck behind a crashed holder.
  await db.execute(sql`SELECT pg_advisory_lock(${MIGRATION_LOCK_KEY})`);
  try {
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    logger.info('migrations complete');
  } finally {
    await db.execute(sql`SELECT pg_advisory_unlock(${MIGRATION_LOCK_KEY})`).catch(() => {});
  }
}

// Allow `pnpm db:migrate` to execute this file directly.
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      logger.fatal({ err }, 'migration failed');
      process.exit(1);
    });
}
