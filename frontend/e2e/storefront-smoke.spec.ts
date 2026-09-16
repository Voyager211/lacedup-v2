import { expect, test, type Locator } from '@playwright/test';

/** The image arrived and decoded, not just its <img> tag. */
const expectImageLoaded = async (image: Locator) => {
  await image.scrollIntoViewIfNeeded();
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
};

test('landing → shop → product page shows the seeded catalog', async ({ page }) => {
  await page.goto('/');

  const newArrivals = page.locator('section').filter({ has: page.getByRole('heading', { name: 'New arrivals' }) });
  await expect(newArrivals.getByRole('link', { name: 'Pureboost 5' })).toBeVisible();
  await expectImageLoaded(newArrivals.locator('img').first());
  await expect(page.getByRole('heading', { name: 'Best sellers' })).toBeVisible();

  await page.getByRole('link', { name: 'Shop', exact: true }).first().click();
  await expect(page).toHaveURL(/\/shop/);

  const productLink = page.locator('h3 a[href^="/product/"]').first();
  await expect(productLink).toBeVisible();
  const productName = (await productLink.textContent())!.trim();

  await productLink.click();
  await expect(page).toHaveURL(/\/product\//);

  await expect(page.getByRole('heading', { level: 1, name: productName })).toBeVisible();
  await expect(page.getByText(/₹\s?[\d,]+/).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Description' })).toBeVisible();
  await expectImageLoaded(page.locator('main img').first());
});
