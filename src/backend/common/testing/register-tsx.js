/**
 * Teach Node's CommonJS require() about .ts files inside the test worker.
 *
 * The backend is CommonJS, so a require('./x') from a .js file is resolved by
 * Node, which only tries .js/.json/.node and therefore cannot find x.ts during
 * the JS-to-TypeScript conversion. tsx/cjs patches the resolver - it is the
 * same loader `npm run dev` uses, so tests and dev resolve identically.
 *
 * This file can be deleted once no .js remains under src/backend.
 */
require('tsx/cjs');
