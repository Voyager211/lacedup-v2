import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  newTokenId,
  hashToken,
  cookieNamesFor
} from '../jwt.service';

const USER_ID = '507f1f77bcf86cd799439011';

describe('jwt.service', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('access tokens', () => {
    it('round-trips a valid token', () => {
      const token = signAccessToken(USER_ID, 'user', 'user');
      const payload = verifyAccessToken(token, 'user');

      expect(payload).not.toBeNull();
      expect(payload!.sub).toBe(USER_ID);
      expect(payload!.role).toBe('user');
    });

    // The whole point of the audience claim: moving a shopper cookie onto an
    // admin route must not grant admin access.
    it('rejects a shopper token presented as an admin token', () => {
      const token = signAccessToken(USER_ID, 'user', 'user');
      expect(verifyAccessToken(token, 'admin')).toBeNull();
    });

    it('rejects an admin token presented as a shopper token', () => {
      const token = signAccessToken(USER_ID, 'admin', 'admin');
      expect(verifyAccessToken(token, 'user')).toBeNull();
    });

    // A refresh token is long-lived; accepting one as an access token would
    // hand out a long-lived session.
    it('rejects a refresh token presented as an access token', () => {
      const refresh = signRefreshToken(USER_ID, 'user', newTokenId());
      expect(verifyAccessToken(refresh, 'user')).toBeNull();
    });

    it('rejects a token signed with a different secret', () => {
      const token = signAccessToken(USER_ID, 'user', 'user');
      process.env.JWT_SECRET = 'someone-elses-secret';
      expect(verifyAccessToken(token, 'user')).toBeNull();
    });

    it('rejects a tampered token', () => {
      const token = signAccessToken(USER_ID, 'user', 'user');
      const tampered = token.slice(0, -3) + 'aaa';
      expect(verifyAccessToken(tampered, 'user')).toBeNull();
    });

    it('rejects garbage instead of throwing', () => {
      expect(verifyAccessToken('not-a-token', 'user')).toBeNull();
      expect(verifyAccessToken('', 'user')).toBeNull();
    });

    it('throws a clear error when no secret is configured', () => {
      delete process.env.JWT_SECRET;
      expect(() => signAccessToken(USER_ID, 'user', 'user')).toThrow(/JWT_SECRET/);
    });
  });

  describe('refresh tokens', () => {
    it('round-trips and carries the token id', () => {
      const jti = newTokenId();
      const token = signRefreshToken(USER_ID, 'user', jti);
      const payload = verifyRefreshToken(token, 'user');

      expect(payload).not.toBeNull();
      expect(payload!.jti).toBe(jti);
      expect(payload!.sub).toBe(USER_ID);
    });

    it('rejects an access token presented as a refresh token', () => {
      const access = signAccessToken(USER_ID, 'user', 'user');
      expect(verifyRefreshToken(access, 'user')).toBeNull();
    });

    it('is signed with the refresh secret, not the access secret', () => {
      const token = signRefreshToken(USER_ID, 'user', newTokenId());
      // Rotating only the access secret must leave refresh tokens verifiable.
      process.env.JWT_SECRET = 'rotated-access-secret';
      expect(verifyRefreshToken(token, 'user')).not.toBeNull();
    });
  });

  describe('storage helpers', () => {
    it('hashes tokens deterministically and irreversibly', () => {
      const token = signRefreshToken(USER_ID, 'user', newTokenId());
      const hash = hashToken(token);

      expect(hash).toHaveLength(64);
      expect(hash).toBe(hashToken(token));
      expect(hash).not.toContain(token);
    });

    it('issues distinct token ids', () => {
      const ids = new Set(Array.from({ length: 50 }, () => newTokenId()));
      expect(ids.size).toBe(50);
    });
  });

  describe('cookie names', () => {
    // Distinct names are what let one browser hold both logins at once, the
    // same way admin.sid and user.sid did.
    it('keeps admin and shopper cookies separate', () => {
      const user = cookieNamesFor('user');
      const admin = cookieNamesFor('admin');

      expect(user.access).not.toBe(admin.access);
      expect(user.refresh).not.toBe(admin.refresh);
      expect(user.access).not.toBe(user.refresh);
    });
  });
});
