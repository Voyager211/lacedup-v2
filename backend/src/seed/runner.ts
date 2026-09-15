import crypto from 'crypto';
import { faker } from '@faker-js/faker';
import type { Model } from 'mongoose';

export interface SeedContext {
  log: (message: string) => void;
}

export interface Seeder {
  name: string;
  /** Every collection this seeder writes. A reset empties all of them. */
  models: Model<any>[];
  run: (ctx: SeedContext) => Promise<void>;
}

export interface RunSeedOptions {
  /** Empty the seeders' collections first, including records that were not seeded. */
  reset?: boolean;
  log?: (message: string) => void;
}

/** Faker is re-seeded per seeder, so adding one seeder never changes another's data. */
const fakerSeedFor = (name: string): number =>
  crypto.createHash('md5').update(name).digest().readUInt32BE(0);

/**
 * Inserts the documents that are not there yet and leaves existing ones alone.
 *
 * Documents need a fixed `_id` (see seedId). Each is validated against its
 * schema first, so seed data that the app would reject fails the seed instead
 * of reaching the frontend. Pre-save hooks do not run: seeders set the fields
 * those hooks derive (slugs, SKUs, stock totals, password hashes) themselves.
 */
export const insertMissing = async <T>(model: Model<T>, docs: Array<Record<string, unknown>>): Promise<number> => {
  if (docs.length === 0) return 0;

  await model.init();
  const now = new Date();

  const operations = await Promise.all(
    docs.map(async (input) => {
      if (!input._id) throw new Error(`${model.modelName} seed document is missing a fixed _id`);

      const doc = new model(input);
      await doc.validate();
      const { _id, ...fields } = doc.toObject({ depopulate: true }) as Record<string, unknown>;

      const createdAt = (input.createdAt as Date | undefined) ?? now;
      fields.createdAt = createdAt;
      fields.updatedAt = (input.updatedAt as Date | undefined) ?? createdAt;

      return { updateOne: { filter: { _id }, update: { $setOnInsert: fields }, upsert: true } };
    })
  );

  const result = await model.collection.bulkWrite(operations as any);
  return result.upsertedCount;
};

export const runSeed = async (seeders: Seeder[], { reset = false, log = console.log }: RunSeedOptions = {}) => {
  if (reset) {
    const models = new Set(seeders.flatMap((seeder) => seeder.models));
    for (const model of models) {
      await model.deleteMany({});
    }
    log(`Reset ${models.size} collections`);
  }

  for (const seeder of seeders) {
    faker.seed(fakerSeedFor(seeder.name));
    await seeder.run({ log: (message) => log(`[${seeder.name}] ${message}`) });
  }
};
