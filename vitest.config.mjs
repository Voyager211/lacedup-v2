import { defineConfig } from 'vitest/config';

export default defineConfig({
  // While the backend is a mix of .js and .ts, a require('./x') from a .js file
  // must be able to resolve x.ts. Node's CommonJS resolver only tries .js/.json,
  // so the source tree is processed by Vite (rather than externalised to Node)
  // and .ts is listed ahead of .js in the resolver.
  resolve: {
    extensions: ['.ts', '.js', '.mjs', '.cjs', '.json']
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/backend/**/*.test.js', 'src/backend/**/*.test.ts'],

    // The backend is CommonJS, so require() chains inside source files are
    // resolved by Node itself, which cannot find a .ts file from an
    // extensionless specifier. tsx/cjs patches require to handle that, and is
    // the same loader `npm run dev` uses.
    setupFiles: ['src/backend/common/testing/register-tsx.js'],

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
