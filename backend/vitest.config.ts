import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 20000,
    coverage: {
      provider: 'v8',
      include: ['src/**/service.ts'],
      reporter: ['text', 'json-summary', 'html'],
      thresholds: { statements: 60, branches: 60, functions: 60, lines: 60 },
    },
  },
});
