import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['server/src/**/*.ts'],
      exclude: ['server/src/server.ts', 'server/src/infrastructure/**'],
    },
  },
});
