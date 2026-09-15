import type { Seeder } from '../runner';
import { catalogSeeder } from './catalog.seeder';
import { commerceSeeder, couponsSeeder } from './commerce.seeder';
import { reviewsSeeder, shoppingSeeder, subscribersSeeder } from './engagement.seeder';
import { addressesSeeder, usersSeeder } from './users.seeder';

/** In dependency order: a seeder may reference records from the ones before it. */
export const seeders: Seeder[] = [
  usersSeeder,
  addressesSeeder,
  catalogSeeder,
  couponsSeeder,
  commerceSeeder,
  shoppingSeeder,
  reviewsSeeder,
  subscribersSeeder
];
