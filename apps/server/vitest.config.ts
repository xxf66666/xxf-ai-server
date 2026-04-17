import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/__tests__/setup.ts'],
    // Tests are unit-only here — no DB, no Redis, no HTTP. Keep it that way;
    // integration tests belong in a separate `tests/` run that boots a real
    // Postgres + Redis.
    environment: 'node',
    globals: false,
    reporters: process.env.CI ? ['default', 'github-actions'] : ['default'],
  },
});
