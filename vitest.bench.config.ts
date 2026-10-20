import { defineConfig } from 'vitest/config';

/** Timing budgets run without coverage instrumentation, which would skew them. */
export default defineConfig({
  test: {
    include: ['src/**/*.bench.ts'],
    environment: 'node',
    coverage: { enabled: false },
  },
});
