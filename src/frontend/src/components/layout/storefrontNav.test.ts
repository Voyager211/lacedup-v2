import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { storefrontCrumbs, storefrontCrumbWidth } from './storefrontNav';

/** A crumb without its icon, so these assertions stay about structure. */
const trail = (crumbs: Array<{ label: string; to?: string }>) =>
  crumbs.map(({ label, to }) => (to ? { label, to } : { label }));

describe('storefrontCrumbs', () => {
  it('shows Home alone at the root, with nothing above it to link to', () => {
    expect(trail(storefrontCrumbs('/'))).toEqual([{ label: 'Home' }]);
  });

  it('roots every other page at Home', () => {
    expect(trail(storefrontCrumbs('/shop'))).toEqual([
      { label: 'Home', to: '/' },
      { label: 'Shop' }
    ]);
  });

  it('hangs a product off the shop it was found in', () => {
    expect(trail(storefrontCrumbs('/product/air-max-90'))).toEqual([
      { label: 'Home', to: '/' },
      { label: 'Shop', to: '/shop' },
      { label: 'Product' }
    ]);
  });

  it('lets the page name itself once it knows its own title', () => {
    expect(trail(storefrontCrumbs('/product/air-max-90', { label: 'Air Max 90' })).at(-1)).toEqual({
      label: 'Air Max 90'
    });
  });

  it('accepts a level the route does not express, such as a category', () => {
    const crumbs = storefrontCrumbs('/product/air-max-90', {
      label: 'Air Max 90',
      parents: [{ label: 'Running', to: '/shop?category=c1' }]
    });

    expect(trail(crumbs)).toEqual([
      { label: 'Home', to: '/' },
      { label: 'Shop', to: '/shop' },
      { label: 'Running', to: '/shop?category=c1' },
      { label: 'Air Max 90' }
    ]);
  });

  it('treats checkout as a step out of the cart, not a page off Home', () => {
    expect(trail(storefrontCrumbs('/checkout'))).toEqual([
      { label: 'Home', to: '/' },
      { label: 'Cart', to: '/cart' },
      { label: 'Checkout' }
    ]);
  });

  it('sends the post-payment pages back to Orders rather than to Checkout', () => {
    // Checkout is a dead end by then - the cart is empty and the page bounces.
    for (const path of [
      '/checkout/order-success/ORD1',
      '/checkout/order-failure/txn1',
      '/checkout/retry-payment/txn1'
    ]) {
      expect(trail(storefrontCrumbs(path)).at(-2)).toEqual({ label: 'Orders', to: '/orders' });
    }
  });

  it('names an order by its id, which is what support asks for', () => {
    expect(trail(storefrontCrumbs('/orders/ORD000123', { label: 'ORD000123' }))).toEqual([
      { label: 'Home', to: '/' },
      { label: 'Orders', to: '/orders' },
      { label: 'ORD000123' }
    ]);
  });

  it('puts the password page under the profile', () => {
    expect(trail(storefrontCrumbs('/profile/change-password'))).toEqual([
      { label: 'Home', to: '/' },
      { label: 'Profile', to: '/profile' },
      { label: 'Password' }
    ]);
  });

  it('gives every crumb an icon', () => {
    for (const crumb of storefrontCrumbs('/checkout')) {
      expect(crumb.icon).toBeTruthy();
    }
  });

  it('still offers a way home from a path it does not know', () => {
    expect(trail(storefrontCrumbs('/nonsense'))).toEqual([{ label: 'Home', to: '/' }]);
  });

  it('ignores a trailing slash', () => {
    expect(trail(storefrontCrumbs('/shop/'))).toEqual(trail(storefrontCrumbs('/shop')));
  });
});

/*
 * The point of deriving the trail from a table is that no page can be missed.
 * That only holds while the table covers the router, so this reads the router
 * itself: add a storefront route without a table entry and this fails, which is
 * the whole guarantee.
 */
describe('coverage of the router', () => {
  const routerSource = readFileSync(resolve(process.cwd(), 'src/app/router.tsx'), 'utf8');

  const storefrontBlock = routerSource
    .split('---- Storefront')[1]!
    .split('---- Auth')[0]!;

  const routes = storefrontBlock
    .split('\n')
    // Redirects render no page of their own, so they need no trail.
    .filter((line) => line.includes("path: '") && !line.includes('Navigate'))
    .map((line) => `/${/path: '([^']*)'/.exec(line)![1]!}`)
    // A concrete value for every :param; the table matches on the pattern.
    .map((path) => path.replace(/:[^/]+/g, 'x'));

  it('found the storefront routes to check', () => {
    expect(routes.length).toBeGreaterThan(10);
  });

  it.each(routes)('has a trail for %s', (path) => {
    const crumbs = storefrontCrumbs(path);

    // An unmapped path falls back to Home alone, which is what this catches.
    expect(crumbs.at(-1)!.label).not.toBe('Home');
  });

  it.each(routes)('has a container width for %s', (path) => {
    expect(storefrontCrumbWidth(path)).toMatch(/^max-w-/);
  });
});
