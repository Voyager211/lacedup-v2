import { Faker, base, en, en_IN } from '@faker-js/faker';
import { seedId } from '../seed-id';

export const DAY = 86_400_000;
export const HOUR = 3_600_000;

export const daysBefore = (now: Date, days: number): Date => new Date(now.getTime() - days * DAY);

/** Log in to the seeded accounts with these. */
export const SEED_PASSWORDS = {
  admin: 'Admin@12345',
  shopper: 'Shopper@12345',
  user: 'Password@123'
} as const;

export const SEED_EMAILS = {
  admin: 'admin@lacedup.dev',
  shopper: 'shopper@lacedup.dev'
} as const;

export interface SeedAddress {
  addressType: 'Home' | 'Work';
  name: string;
  city: string;
  state: string;
  landMark: string;
  pincode: number;
  phone: string;
  isDefault: boolean;
}

export interface SeedUser {
  key: string;
  name: string;
  email: string;
  password: string;
  phone: string;
  role: 'user' | 'admin';
  isBlocked: boolean;
  referralCode: string;
  /** Key of the user whose code this one signed up with. */
  referredBy: string | null;
  createdAt: Date;
  addresses: SeedAddress[];
}

export const userId = (key: string) => seedId(`user:${key}`);

/** One Address document per user holds the whole address book. */
export const addressBookId = (key: string) => seedId(`address:${key}`);

export const referralCodeFor = (key: string): string => userId(key).toHexString().slice(-6).toUpperCase();

const CITIES: Array<[string, string]> = [
  ['Bengaluru', 'Karnataka'],
  ['Mumbai', 'Maharashtra'],
  ['New Delhi', 'Delhi'],
  ['Chennai', 'Tamil Nadu'],
  ['Hyderabad', 'Telangana'],
  ['Pune', 'Maharashtra'],
  ['Kochi', 'Kerala'],
  ['Kolkata', 'West Bengal'],
  ['Ahmedabad', 'Gujarat'],
  ['Jaipur', 'Rajasthan']
];

/**
 * The admin, a demo shopper with a full history, and a dozen customers.
 *
 * Uses its own Faker instance so the people stay the same no matter which
 * seeders run or in what order.
 */
export const buildPeople = (now: Date): SeedUser[] => {
  const f = new Faker({ locale: [en_IN, en, base] });
  f.seed(20260916);

  const phone = () => `${f.helpers.arrayElement(['6', '7', '8', '9'])}${f.string.numeric(9)}`;

  const address = (name: string, addressType: SeedAddress['addressType'], isDefault: boolean): SeedAddress => {
    const [city, state] = f.helpers.arrayElement(CITIES);
    return {
      addressType,
      name,
      city,
      state,
      landMark: `Near ${f.location.street()}`,
      pincode: Number(`${f.number.int({ min: 1, max: 9 })}${f.string.numeric(5)}`),
      phone: phone(),
      isDefault
    };
  };

  const people: SeedUser[] = [
    {
      key: 'admin',
      name: 'LacedUp Admin',
      email: SEED_EMAILS.admin,
      password: SEED_PASSWORDS.admin,
      phone: '9000000001',
      role: 'admin',
      isBlocked: false,
      referralCode: referralCodeFor('admin'),
      referredBy: null,
      createdAt: daysBefore(now, 180),
      addresses: []
    },
    {
      key: 'shopper',
      name: 'Aarav Sharma',
      email: SEED_EMAILS.shopper,
      password: SEED_PASSWORDS.shopper,
      phone: '9000000002',
      role: 'user',
      isBlocked: false,
      referralCode: referralCodeFor('shopper'),
      referredBy: 'user-1',
      createdAt: daysBefore(now, 60),
      addresses: [address('Aarav Sharma', 'Home', true), address('Aarav Sharma', 'Work', false)]
    }
  ];

  for (let i = 1; i <= 12; i++) {
    const firstName = f.person.firstName();
    const lastName = f.person.lastName();
    const name = `${firstName} ${lastName}`;
    const handle = `${firstName}.${lastName}`.toLowerCase().replace(/[^a-z.]/g, '');

    people.push({
      key: `user-${i}`,
      name,
      email: `${handle}${i}@example.com`,
      password: SEED_PASSWORDS.user,
      phone: phone(),
      role: 'user',
      isBlocked: i === 12,
      referralCode: referralCodeFor(`user-${i}`),
      referredBy: null,
      // Older than the shopper, whom user-1 referred.
      createdAt: daysBefore(now, f.number.int({ min: 61, max: 170 })),
      addresses: [address(name, 'Home', true), ...(f.datatype.boolean() ? [address(name, 'Work', false)] : [])]
    });
  }

  return people;
};
