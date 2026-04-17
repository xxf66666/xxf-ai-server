// Drizzle migration runner — invoked on server boot and via `pnpm db:migrate`.
// P1+ will populate ./migrations via `pnpm db:generate`.
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db } from './client.js';
import { logger } from '../utils/logger.js';

async function main() {
  logger.info('running migrations…');
  await migrate(db, { migrationsFolder: './drizzle' });
  logger.info('migrations complete');
  process.exit(0);
}

void main();
