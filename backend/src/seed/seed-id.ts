import crypto from 'crypto';
import mongoose from 'mongoose';

/**
 * A stable ObjectId for a seed record.
 *
 * Derived from a key such as 'user:admin' or 'product:3', so every run of the
 * seed addresses the same documents - which is what makes it idempotent and
 * lets one seeder reference another's records without querying for them.
 */
export const seedId = (key: string): mongoose.Types.ObjectId =>
  new mongoose.Types.ObjectId(
    crypto.createHash('md5').update(`lacedup-seed:${key}`).digest('hex').slice(0, 24)
  );
