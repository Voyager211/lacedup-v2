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
    include: ['src/**/*.test.ts'],

    // Set before any module is imported, so the rate limiters register in skip
    // mode and the suite is not throttled by its own repeated requests. The
    // auth suite previously deferred requiring the app to achieve this.
    //
    // CLOUDINARY_URL is blanked for the same reason it is set at all: image
    // storage picks its backend from it, and a developer with real credentials
    // in .env would otherwise have the suite uploading to a live account. The
    // value is already in process.env by the time dotenv runs, and dotenv does
    // not overwrite what is there, so this wins. Nothing here relies on
    // Cloudinary - the disk backend is what these tests assert.
    env: { NODE_ENV: 'test', CLOUDINARY_URL: '' },

    // NOTE: this previously loaded tsx/cjs via a setup file, so that .js source
    // files could require() their already-converted .ts neighbours. The backend
    // is now entirely TypeScript and Vitest resolves .ts natively, so the hook
    // is gone - it was also corrupting the sourcemaps Vitest reads when
    // formatting stack traces.

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
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/common/testing/**']
    }
  }
});
