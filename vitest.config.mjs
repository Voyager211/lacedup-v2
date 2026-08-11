import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/backend/**/*.test.js', 'src/backend/**/*.test.ts'],

    // Spinning up an in-memory mongod and seeding fixtures is slower than a
    // pure unit test; these are deliberately generous.
    testTimeout: 60_000,
    hookTimeout: 120_000,

    // Mongoose keeps connection state on the module, and native deps behave
    // better out of worker threads - one forked process, files run in series.
    pool: 'forks',
    fileParallelism: false,

    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      include: ['src/backend/**/*.js'],
      exclude: ['src/backend/common/testing/**', 'src/backend/views/**']
    }
  }
});
