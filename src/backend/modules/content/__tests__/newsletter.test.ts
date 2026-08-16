import request from 'supertest';
import * as db from '../../../common/testing/db';
import app from '../../../app';
import Subscriber from '../subscriber.model';

/**
 * The community signup on the landing page.
 *
 * The point of these is that the address is actually kept. A form that thanks
 * you and discards what you typed looks identical from the outside, which is
 * exactly why it needs a test that reads the collection back.
 */
describe('POST /api/newsletter/subscribe', () => {
  beforeAll(async () => {
    await db.connect();
    // The unique index has to exist before the upsert relies on it.
    await Subscriber.init();
  });

  afterAll(async () => {
    await db.disconnect();
  });

  beforeEach(async () => {
    await Subscriber.deleteMany({});
  });

  it('stores the address', async () => {
    const res = await request(app)
      .post('/api/newsletter/subscribe')
      .send({ email: 'sneakerhead@example.com', consented: true });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const stored = await Subscriber.findOne({ email: 'sneakerhead@example.com' });
    expect(stored).not.toBeNull();
    expect(stored?.consented).toBe(true);
  });

  it('records the consent as ticked, not as assumed', async () => {
    await request(app)
      .post('/api/newsletter/subscribe')
      .send({ email: 'quiet@example.com' });

    const stored = await Subscriber.findOne({ email: 'quiet@example.com' });
    expect(stored?.consented).toBe(false);
  });

  it('normalises the address, so one person is not two subscribers', async () => {
    await request(app)
      .post('/api/newsletter/subscribe')
      .send({ email: '  Mixed.Case@Example.COM ', consented: true });

    const stored = await Subscriber.findOne({ email: 'mixed.case@example.com' });
    expect(stored).not.toBeNull();
  });

  it('treats signing up twice as success, not as a duplicate', async () => {
    // Telling someone their address is "already taken" on a newsletter is a
    // strange thing to say, and they cannot do anything about it.
    await request(app)
      .post('/api/newsletter/subscribe')
      .send({ email: 'twice@example.com', consented: false });

    const res = await request(app)
      .post('/api/newsletter/subscribe')
      .send({ email: 'twice@example.com', consented: true });

    expect(res.status).toBe(200);
    expect(await Subscriber.countDocuments({ email: 'twice@example.com' })).toBe(1);
    // The second answer wins - this is how someone opts in after declining.
    expect((await Subscriber.findOne({ email: 'twice@example.com' }))?.consented).toBe(true);
  });

  it('rejects an address that is not one', async () => {
    const res = await request(app)
      .post('/api/newsletter/subscribe')
      .send({ email: 'not-an-address', consented: true });

    expect(res.status).toBe(400);
    expect(await Subscriber.countDocuments({})).toBe(0);
  });

  it('rejects an empty submission', async () => {
    const res = await request(app).post('/api/newsletter/subscribe').send({});

    expect(res.status).toBe(400);
  });
});
