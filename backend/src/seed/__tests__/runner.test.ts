import { faker } from '@faker-js/faker';
import { connect, disconnect, clear } from '../../common/testing/db';
import Subscriber from '../../modules/content/subscriber.model';
import { insertMissing, runSeed, type Seeder } from '../runner';
import { seedId } from '../seed-id';

const subscriberSeeder: Seeder = {
  name: 'subscribers',
  models: [Subscriber],
  run: async () => {
    await insertMissing(
      Subscriber,
      [0, 1].map((i) => ({ _id: seedId(`subscriber:${i}`), email: faker.internet.email(), consented: true }))
    );
  }
};

const silent = { log: () => {} };

describe('seed runner', () => {
  beforeAll(connect);
  afterAll(disconnect);
  beforeEach(clear);

  it('is idempotent: a second run adds nothing', async () => {
    await runSeed([subscriberSeeder], silent);
    await runSeed([subscriberSeeder], silent);

    expect(await Subscriber.countDocuments()).toBe(2);
  });

  it('leaves seeded records that were edited since untouched', async () => {
    await runSeed([subscriberSeeder], silent);
    await Subscriber.updateOne({ _id: seedId('subscriber:0') }, { consented: false });

    await runSeed([subscriberSeeder], silent);

    expect((await Subscriber.findById(seedId('subscriber:0')))?.consented).toBe(false);
  });

  it('generates the same data on every run', async () => {
    await runSeed([subscriberSeeder], silent);
    const first = (await Subscriber.find().sort({ _id: 1 }).lean()).map((s) => s.email);

    await runSeed([subscriberSeeder], { ...silent, reset: true });
    const second = (await Subscriber.find().sort({ _id: 1 }).lean()).map((s) => s.email);

    expect(second).toEqual(first);
  });

  it('reset empties the collection, including records it did not seed', async () => {
    await Subscriber.create({ email: 'someone@example.com' });

    await runSeed([subscriberSeeder], { ...silent, reset: true });

    expect(await Subscriber.countDocuments()).toBe(2);
    expect(await Subscriber.exists({ email: 'someone@example.com' })).toBeNull();
  });

  it('sets timestamps on inserted documents', async () => {
    await runSeed([subscriberSeeder], silent);

    const subscriber = await Subscriber.findById(seedId('subscriber:1')).lean();
    expect(subscriber?.createdAt).toBeInstanceOf(Date);
    expect(subscriber?.updatedAt).toBeInstanceOf(Date);
  });

  it('rejects documents the schema would reject', async () => {
    await expect(insertMissing(Subscriber, [{ _id: seedId('subscriber:bad') }])).rejects.toThrow(/email/);
  });

  it('rejects documents without a fixed _id', async () => {
    await expect(insertMissing(Subscriber, [{ email: 'a@example.com' }])).rejects.toThrow(/fixed _id/);
  });
});
