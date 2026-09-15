import { expect, test } from '@playwright/test';

/**
 * Guards the harness itself: if the SPA were proxying to a dev API (and its
 * database) instead of the e2e API, every other spec would be testing the
 * wrong thing.
 */
test('the SPA talks to the e2e API', async ({ page, request }) => {
  const health = await request.get('http://localhost:3100/healthz');
  expect(health.ok()).toBe(true);

  const apiResponse = page.waitForResponse((res) => new URL(res.url()).pathname.startsWith('/api/'));
  await page.goto('/');

  expect((await apiResponse).status()).toBeLessThan(500);
});
