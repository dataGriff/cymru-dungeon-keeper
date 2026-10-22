import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist',
    // The game and its living style guide (styleguide.html).
    rollupOptions: { input: { main: resolve(__dirname, 'index.html'), styleguide: resolve(__dirname, 'styleguide.html') } },
  },
  test: {
    include: ['src/sim/**/*.test.ts', 'src/design/**/*.test.ts', 'src/render/scale.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/sim/**/*.ts'],
      exclude: ['src/sim/**/*.test.ts', 'src/sim/index.ts'],
      reporter: ['text-summary', 'html'],
      reportsDirectory: 'coverage',
      thresholds: { lines: 80, functions: 80, statements: 80, branches: 70 },
    },
  },
});
