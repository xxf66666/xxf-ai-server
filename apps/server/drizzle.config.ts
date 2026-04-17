import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://xxfai:xxfai@localhost:5432/xxfai',
  },
  strict: true,
  verbose: true,
} satisfies Config;
