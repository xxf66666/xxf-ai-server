import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db } from './client.js';
import { logger } from '../utils/logger.js';

const here = dirname(fileURLToPath(import.meta.url));
// Migrations are emitted by drizzle-kit into apps/server/drizzle/.
// From dist/db/migrate.js this resolves to dist/drizzle, which is wrong;
// we always ship migrations from repo-root-relative apps/server/drizzle.
const MIGRATIONS_FOLDER = resolve(here, '../../drizzle');

export async function runMigrations(): Promise<void> {
  logger.info({ folder: MIGRATIONS_FOLDER }, 'running migrations');
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  logger.info('migrations complete');
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
