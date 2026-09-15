import '../config/env';

import mongoose from 'mongoose';
import { assertSafeSeedTarget } from './guard';
import { runSeed } from './runner';
import { seeders } from './seeders';

/**
 * `npm run seed` inserts whatever seed data is missing.
 * `npm run seed:reset` empties the seeded collections first.
 *
 * Targets SEED_MONGODB_URI, falling back to MONGODB_URI, and refuses anything
 * that is not a local database (see guard.ts).
 */
const main = async (): Promise<void> => {
  const reset = process.argv.includes('--reset');
  const uri = process.env.SEED_MONGODB_URI || process.env.MONGODB_URI;

  assertSafeSeedTarget(uri);

  await mongoose.connect(uri!);
  try {
    await runSeed(seeders, { reset });
    console.log('Seed complete');
  } finally {
    await mongoose.disconnect();
  }
};

main().catch((error: Error) => {
  console.error(`Seed failed: ${error.message}`);
  process.exitCode = 1;
});
