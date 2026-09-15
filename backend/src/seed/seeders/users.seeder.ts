import bcrypt from 'bcryptjs';
import User from '../../modules/users/user.model';
import Address from '../../modules/addresses/address.model';
import { addressBookId, daysBefore, userId } from '../data/people';
import { seedWorld } from '../data/world';
import { insertMissing, type Seeder } from '../runner';
import { seedId } from '../seed-id';

export const usersSeeder: Seeder = {
  name: 'users',
  models: [User],
  run: async ({ log }) => {
    const { now, people } = seedWorld();

    // insertMissing skips the pre-save hook, so hash here. One hash per password.
    const hashes = new Map<string, string>();
    for (const password of new Set(people.map((p) => p.password))) {
      hashes.set(password, await bcrypt.hash(password, 10));
    }

    const inserted = await insertMissing(
      User,
      people.map((person) => ({
        _id: userId(person.key),
        name: person.name,
        email: person.email,
        phone: person.phone,
        password: hashes.get(person.password),
        role: person.role,
        isBlocked: person.isBlocked,
        blockedAt: person.isBlocked ? daysBefore(now, 10) : undefined,
        referralCode: person.referralCode,
        referredBy: person.referredBy ? userId(person.referredBy) : null,
        hasUsedReferralCode: Boolean(person.referredBy),
        referralCount: people.filter((other) => other.referredBy === person.key).length,
        createdAt: person.createdAt
      }))
    );

    log(`${inserted} of ${people.length} inserted`);
  }
};

export const addressesSeeder: Seeder = {
  name: 'addresses',
  models: [Address],
  run: async ({ log }) => {
    const withAddresses = seedWorld().people.filter((p) => p.addresses.length > 0);

    const inserted = await insertMissing(
      Address,
      withAddresses.map((person) => ({
        _id: addressBookId(person.key),
        userId: userId(person.key),
        address: person.addresses.map((address, index) => ({
          _id: seedId(`address-entry:${person.key}:${index}`),
          ...address
        })),
        createdAt: person.createdAt
      }))
    );

    log(`${inserted} of ${withAddresses.length} address books inserted`);
  }
};
