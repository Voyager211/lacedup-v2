import request from 'supertest';
import * as db from '../../../common/testing/db';
import app from '../../../app';
import User from '../../users/user.model';
import RefreshToken from '../refresh-token.model';

/**
 * End-to-end JWT auth over HTTP.
 *
 * These go through the real app, so they cover the cookie wiring, the audience
 * split and revocation - not just token maths.
 */

const SEEDED = {
  name: 'Token Tester',
  email: 'tokens@example.com',
  password: 'CorrectHorse1!'
};

/** Pulls a named cookie out of a supertest response. */
const cookieFrom = (res: request.Response, name: string): string | undefined => {
  const raw = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
  const hit = raw.find((c) => c.startsWith(`${name}=`));
  return hit ? hit.split(';')[0] : undefined;
};

const cookieAttrs = (res: request.Response, name: string): string | undefined =>
  ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith(`${name}=`));

describe('JWT auth flow (HTTP)', () => {
  beforeAll(async () => {
    await db.connect();
  });

  afterAll(async () => {
    await db.disconnect();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await RefreshToken.deleteMany({});
    await User.create({
      name: SEEDED.name,
      email: SEEDED.email,
      password: SEEDED.password, // hashed by the model pre-save hook
      isVerified: true
    });
  });

  const login = () =>
    request(app).post('/api/login').type('form').send({
      email: SEEDED.email,
      password: SEEDED.password
    });

  describe('login', () => {
    it('issues both access and refresh cookies', async () => {
      const res = await login();

      expect(res.status).toBe(200);
      expect(cookieFrom(res, 'user_at')).toBeDefined();
      expect(cookieFrom(res, 'user_rt')).toBeDefined();
    });

    // The cookies must be unreadable from JavaScript, which is the reason for
    // choosing cookies over localStorage in the first place.
    it('marks both cookies HttpOnly', () => {
      return login().then((res) => {
        expect(cookieAttrs(res, 'user_at')).toMatch(/HttpOnly/i);
        expect(cookieAttrs(res, 'user_rt')).toMatch(/HttpOnly/i);
      });
    });

    it('persists the refresh token hashed, never in plaintext', async () => {
      const res = await login();
      const raw = cookieFrom(res, 'user_rt')!.split('=')[1];

      const stored = await RefreshToken.findOne({});
      expect(stored).not.toBeNull();
      expect(stored!.tokenHash).toHaveLength(64);
      expect(stored!.tokenHash).not.toBe(raw);
      expect(stored!.revokedAt).toBeNull();
    });

    it('issues no cookies on a failed login', async () => {
      const res = await request(app)
        .post('/api/login')
        .type('form')
        .send({ email: SEEDED.email, password: 'WrongPassword1!' });

      expect(cookieFrom(res, 'user_at')).toBeUndefined();
      expect(cookieFrom(res, 'user_rt')).toBeUndefined();
      expect(await RefreshToken.countDocuments()).toBe(0);
    });

    it('refuses a blocked user and issues nothing', async () => {
      await User.updateOne({ email: SEEDED.email }, { isBlocked: true });
      const res = await login();

      expect(cookieFrom(res, 'user_at')).toBeUndefined();
      expect(await RefreshToken.countDocuments()).toBe(0);
    });
  });

  describe('authenticated access', () => {
    it('reaches a protected route with the access cookie', async () => {
      const at = cookieFrom(await login(), 'user_at')!;

      const res = await request(app).get('/api/cart').set('Cookie', at);
      expect(res.status).toBe(200);
    });

    it('is refused without any cookie', async () => {
      const res = await request(app).get('/api/cart').set('Accept', 'application/json');
      expect(res.status).toBe(401);
    });

    // The admin audience check, exercised over HTTP rather than in isolation.
    it('does not let a shopper token reach the admin area', async () => {
      const at = cookieFrom(await login(), 'user_at')!;
      // Present the shopper token under the admin cookie name.
      const forged = at.replace('user_at=', 'admin_at=');

      // 403 rather than the old redirect to /admin/login: the admin panel is a
      // React route now and decides for itself where to send the visitor. The
      // point of the test is unchanged - a shopper token must not pass.
      const res = await request(app).get('/api/admin/dashboard').set('Cookie', forged);
      expect(res.status).toBe(403);
    });
  });

  describe('refresh', () => {
    it('rotates the pair and revokes the presented token', async () => {
      const rt = cookieFrom(await login(), 'user_rt')!;

      const res = await request(app).post('/api/auth/refresh').set('Cookie', rt);
      expect(res.status).toBe(200);
      expect(cookieFrom(res, 'user_at')).toBeDefined();
      expect(cookieFrom(res, 'user_rt')).toBeDefined();
      expect(cookieFrom(res, 'user_rt')).not.toBe(rt);

      // Two rows now: the revoked original and its replacement.
      expect(await RefreshToken.countDocuments({ revokedAt: { $ne: null } })).toBe(1);
      expect(await RefreshToken.countDocuments({ revokedAt: null })).toBe(1);
    });

    // Single-use rotation: replaying a captured token after the real client has
    // refreshed must fail.
    it('refuses a refresh token that has already been used', async () => {
      const rt = cookieFrom(await login(), 'user_rt')!;

      await request(app).post('/api/auth/refresh').set('Cookie', rt);
      const replay = await request(app).post('/api/auth/refresh').set('Cookie', rt);

      expect(replay.status).toBe(401);
    });

    it('refuses when no refresh cookie is sent', async () => {
      const res = await request(app).post('/api/auth/refresh');
      expect(res.status).toBe(401);
    });

    it('refuses an access token presented as a refresh token', async () => {
      const at = cookieFrom(await login(), 'user_at')!;
      const asRefresh = at.replace('user_at=', 'user_rt=');

      const res = await request(app).post('/api/auth/refresh').set('Cookie', asRefresh);
      expect(res.status).toBe(401);
    });
  });

  describe('logout', () => {
    it('revokes the refresh token server-side', async () => {
      const res = await login();
      const cookies = [cookieFrom(res, 'user_at')!, cookieFrom(res, 'user_rt')!].join('; ');

      await request(app).post('/api/auth/logout').set('Cookie', cookies);

      const stored = await RefreshToken.findOne({});
      expect(stored!.revokedAt).not.toBeNull();
    });

    it('makes the refresh token unusable afterwards', async () => {
      const res = await login();
      const rt = cookieFrom(res, 'user_rt')!;

      await request(app)
        .post('/api/auth/logout')
        .set('Cookie', [cookieFrom(res, 'user_at')!, rt].join('; '));

      const refresh = await request(app).post('/api/auth/refresh').set('Cookie', rt);
      expect(refresh.status).toBe(401);
    });
  });

  describe('blocked after issue', () => {
    // A token stays cryptographically valid until it expires, so blocking has
    // to be enforced at verification time against current user state.
    it('stops accepting a token once the user is blocked', async () => {
      const at = cookieFrom(await login(), 'user_at')!;

      const before = await request(app).get('/api/cart').set('Cookie', at);
      expect(before.status).toBe(200);

      await User.updateOne({ email: SEEDED.email }, { isBlocked: true });

      const after = await request(app)
        .get('/api/cart')
        .set('Cookie', at)
        .set('Accept', 'application/json');
      expect(after.status).toBe(401);
    });
  });
});
