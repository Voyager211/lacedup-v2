import { describe, expect, it, beforeEach, vi } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { api, audienceFor, errorMessage, setSessionExpiredHandler } from './client';

/**
 * The interceptor is the riskiest piece of the client, because refresh tokens
 * rotate single-use: get the concurrency wrong and a burst of 401s revokes the
 * session it was meant to recover.
 */
describe('audienceFor', () => {
  it.each([
    ['/admin/orders', 'admin'],
    ['/api/admin/users', 'admin'],
    ['/admin/auth/refresh', 'admin'],
    ['/cart', 'user'],
    ['/api/shop', 'user'],
    ['/administrative-thing', 'user'],
    [undefined, 'user']
  ])('%s -> %s', (url, expected) => {
    expect(audienceFor(url)).toBe(expected);
  });
});

describe('refresh-on-401', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(api);
    setSessionExpiredHandler(() => {});
  });

  it('refreshes once and retries the original request', async () => {
    mock.onGet('/cart').replyOnce(401);
    mock.onPost('/auth/refresh').replyOnce(200, { success: true });
    mock.onGet('/cart').replyOnce(200, { items: [] });

    const { data } = await api.get('/cart');

    expect(data).toEqual({ items: [] });
    expect(mock.history.post.filter((r) => r.url === '/auth/refresh')).toHaveLength(1);
  });

  it('uses the admin refresh endpoint for admin routes', async () => {
    mock.onGet('/admin/orders').replyOnce(401);
    mock.onPost('/admin/auth/refresh').replyOnce(200, { success: true });
    mock.onGet('/admin/orders').replyOnce(200, { orders: [] });

    await api.get('/admin/orders');

    expect(mock.history.post.map((r) => r.url)).toEqual(['/admin/auth/refresh']);
  });

  it('shares one refresh across concurrent 401s', async () => {
    // Three requests fail at once. Single-use rotation means three refreshes
    // would revoke each other, so exactly one exchange must happen.
    mock.onGet('/cart').replyOnce(401);
    mock.onGet('/wishlist').replyOnce(401);
    mock.onGet('/orders').replyOnce(401);
    mock.onPost('/auth/refresh').replyOnce(200, { success: true });
    mock.onGet('/cart').replyOnce(200, { ok: 1 });
    mock.onGet('/wishlist').replyOnce(200, { ok: 2 });
    mock.onGet('/orders').replyOnce(200, { ok: 3 });

    const results = await Promise.all([
      api.get('/cart'),
      api.get('/wishlist'),
      api.get('/orders')
    ]);

    expect(results.map((r) => r.data)).toEqual([{ ok: 1 }, { ok: 2 }, { ok: 3 }]);
    expect(mock.history.post.filter((r) => r.url === '/auth/refresh')).toHaveLength(1);
  });

  it('gives up and reports expiry when the refresh itself 401s', async () => {
    const onExpired = vi.fn();
    setSessionExpiredHandler(onExpired);

    mock.onGet('/cart').reply(401);
    mock.onPost('/auth/refresh').reply(401);

    await expect(api.get('/cart')).rejects.toMatchObject({ response: { status: 401 } });

    expect(onExpired).toHaveBeenCalledWith('user');
    expect(mock.history.post.filter((r) => r.url === '/auth/refresh')).toHaveLength(1);
  });

  it('does not retry a second time when the retried request also 401s', async () => {
    const onExpired = vi.fn();
    setSessionExpiredHandler(onExpired);

    mock.onGet('/cart').reply(401);
    mock.onPost('/auth/refresh').reply(200, { success: true });

    await expect(api.get('/cart')).rejects.toMatchObject({ response: { status: 401 } });

    // One refresh, two GETs (original + single retry) - not a loop.
    expect(mock.history.post.filter((r) => r.url === '/auth/refresh')).toHaveLength(1);
    expect(mock.history.get.filter((r) => r.url === '/cart')).toHaveLength(2);
    expect(onExpired).toHaveBeenCalledWith('user');
  });

  it('leaves non-401 failures alone', async () => {
    mock.onGet('/cart').reply(500);

    await expect(api.get('/cart')).rejects.toMatchObject({ response: { status: 500 } });
    expect(mock.history.post).toHaveLength(0);
  });

  it('does not attempt a refresh for requests that opted out', async () => {
    mock.onGet('/auth/me').reply(401);

    await expect(
      api.get('/auth/me', { _skipAuthRefresh: true } as never)
    ).rejects.toMatchObject({ response: { status: 401 } });

    expect(mock.history.post).toHaveLength(0);
  });
});

describe('errorMessage', () => {
  const axiosError = (status: number, data?: unknown) => {
    const error = new Error('Request failed') as Error & Record<string, unknown>;
    error.isAxiosError = true;
    error.response = { status, data };
    error.toJSON = () => ({});
    return error;
  };

  it('reads the message field', () => {
    expect(errorMessage(axiosError(400, { message: 'Coupon expired' }))).toBe('Coupon expired');
  });

  it('falls back to the error field', () => {
    expect(errorMessage(axiosError(401, { error: 'Invalid credentials' }))).toBe(
      'Invalid credentials'
    );
  });

  it('reads the first express-validator entry', () => {
    expect(errorMessage(axiosError(422, { errors: [{ msg: 'Phone is invalid' }] }))).toBe(
      'Phone is invalid'
    );
  });

  it('explains a 429 rather than passing the raw body through', () => {
    expect(errorMessage(axiosError(429, { message: 'Too many requests' }))).toMatch(/wait a moment/i);
  });

  it('uses the fallback when the body carries nothing useful', () => {
    expect(errorMessage(axiosError(500, {}), 'Could not load orders')).toBe('Could not load orders');
  });
});
