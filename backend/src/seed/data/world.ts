import { buildCommerce, type CommercePlan } from './commerce';
import { buildPeople, type SeedUser } from './people';

export interface SeedWorld {
  now: Date;
  people: SeedUser[];
  commerce: CommercePlan;
}

let world: SeedWorld | null = null;

/**
 * What the seeders share, built once per process.
 *
 * Dates count back from the start of today (UTC), so running the seed again
 * the same day produces the same order ids and timestamps.
 */
export const seedWorld = (): SeedWorld => {
  if (!world) {
    const now = new Date();
    now.setUTCHours(0, 0, 0, 0);

    const people = buildPeople(now);
    world = { now, people, commerce: buildCommerce(now, people) };
  }

  return world;
};
