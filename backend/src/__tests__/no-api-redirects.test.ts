import fs from 'fs';
import path from 'path';
import request from 'supertest';
import * as db from '../common/testing/db';
import app from '../app';
import User from '../modules/users/user.model';
import Cart from '../modules/cart/cart.model';
import { BACKEND_SRC } from '../config/paths';

/**
 * API handlers must answer, not redirect.
 *
 * A 302 from an endpoint the SPA fetches is worse than an error. axios follows
 * it; the target is a page path, so the SPA fallback answers with index.html;
 * and RTK Query hands the component a 200 whose body is HTML. The page reads
 * fields off a string, renders nothing, and reports no error anywhere - which
 * is exactly how checkout failed on an empty cart.
 *
 * Two of these. The first covers the case that actually broke. The second is a
 * sweep, because the redirects were a leftover of the EJS layer and there were
 * eleven of them scattered across controllers and middleware.
 */

const SHOPPER = {
  name: 'Redirect Shopper',
  email: 'redirect-shopper@example.com',
  password: 'CorrectHorse1!'
};

describe('checkout with an empty cart', () => {
  beforeAll(async () => {
    await db.connect();
  });

  afterAll(async () => {
    await db.disconnect();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Cart.deleteMany({});
    await User.create(SHOPPER);
  });

  const signIn = async () => {
    const res = await request(app)
      .post('/api/login')
      .type('form')
      .send({ email: SHOPPER.email, password: SHOPPER.password });

    return ([] as string[]).concat(res.headers['set-cookie'] ?? []);
  };

  it('answers with JSON rather than redirecting to the cart', async () => {
    const cookies = await signIn();

    const res = await request(app).get('/api/checkout').set('Cookie', cookies);

    expect(res.status).toBe(409);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body).toMatchObject({ success: false, code: 'CART_EMPTY' });
  });

  it('does not hand the client an HTML page with a 200', async () => {
    // What the redirect produced: a 302 to /cart, which the SPA fallback
    // answered with index.html. The client saw success and no data.
    const cookies = await signIn();

    const res = await request(app).get('/api/checkout').set('Cookie', cookies);

    expect(res.status).not.toBe(302);
    expect(res.text ?? '').not.toContain('<!doctype html');
  });
});

describe('no redirects left in the API', () => {
  /**
   * A source sweep rather than a request-by-request check.
   *
   * Reaching every one of these branches over HTTP would need a fixture per
   * failure mode; the property that matters is simply that none of them exist
   * in code the SPA fetches. OAuth is the deliberate exception - that flow is
   * a real browser navigation, so a redirect is the correct response.
   */
  const ALLOWED = [
    // The Google callback: the browser is mid-navigation, so it must redirect.
    path.join('modules', 'auth', 'auth.routes.ts'),
    // Reached by an old /cart/checkout link, not by a fetch.
    path.join('modules', 'cart', 'cart.routes.ts')
  ];

  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return entry.name === '__tests__' ? [] : walk(full);
      return full.endsWith('.ts') ? [full] : [];
    });

  it('has no res.redirect outside the flows that need one', () => {
    const offenders: string[] = [];

    for (const file of walk(BACKEND_SRC)) {
      const relative = path.relative(BACKEND_SRC, file);
      if (ALLOWED.some((allowed) => relative.endsWith(allowed))) continue;

      const source = fs.readFileSync(file, 'utf8');
      if (/res\.redirect\(/.test(source)) offenders.push(relative);
    }

    expect(offenders).toEqual([]);
  });
});
