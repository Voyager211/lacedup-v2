import fs from 'fs';
import path from 'path';
import request from 'supertest';
import * as db from '../common/testing/db';
import app from '../app';
import { FRONTEND_DIST } from '../config/paths';

/**
 * Serving the React app.
 *
 * The SPA is mounted last, so it answers only what no router claimed. Two
 * things about that are worth pinning, because both are easy to break and
 * neither fails loudly:
 *
 *  - A deep link like /orders/ORD1 must return the shell, or refreshing any
 *    page in the app 404s. This is the whole reason the fallback exists.
 *  - /api must NOT return the shell. A mistyped endpoint answered with 200 and
 *    a page of HTML is a genuinely confusing thing to debug from the client,
 *    and it would make a broken fetch look like a parsing bug.
 */

const shell = path.join(FRONTEND_DIST, 'index.html');

// The frontend build is not a prerequisite for the backend suite, so these run
// only when it is present. Skipping loudly beats a false pass.
const built = fs.existsSync(shell);

describe.skipIf(!built)('SPA fallback', () => {
  beforeAll(async () => {
    await db.connect();
  });

  afterAll(async () => {
    await db.disconnect();
  });

  it.each(['/account/addresses', '/checkout/success', '/some/deep/react/route'])(
    'returns the app shell for the deep link %s',
    async (route) => {
      const res = await request(app).get(route);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/html/);
    }
  );

  it.each(['/orders/ORD000123', '/admin/products/abc'])(
    'still lets the EJS router claim %s (flips in step 5.4)',
    async (route) => {
      // These paths are owned by a root-mounted EJS page route with an auth
      // guard, so signed out they redirect rather than reaching the fallback.
      // When the renders are deleted these become shell responses; this test
      // moves up into the block above at that point.
      const res = await request(app).get(route);

      expect(res.status).toBe(302);
    }
  );

  it.each([
    '/api/definitely-not-a-route',
    '/api/orders/nope/nope',
    '/uploads/missing.jpg',
    '/images/missing.png'
  ])('does not answer %s with the shell', async (route) => {
    const res = await request(app).get(route);

    expect(res.status).not.toBe(200);
  });

  it('leaves the API itself alone', async () => {
    // A real endpoint must still be answered by its router, not the fallback.
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.headers['content-type']).toMatch(/json/);
  });

  it('serves the built assets', async () => {
    const assets = path.join(FRONTEND_DIST, 'assets');
    const first = fs.readdirSync(assets).find((file) => file.endsWith('.js'));

    const res = await request(app).get(`/assets/${first}`);

    expect(res.status).toBe(200);
  });
});

describe.skipIf(built)('SPA fallback (no build present)', () => {
  it('is skipped because src/frontend/dist does not exist', () => {
    // Recorded rather than silently passing: if the whole suite above is
    // skipped in CI, this line is the reason.
    expect(built).toBe(false);
  });
});
