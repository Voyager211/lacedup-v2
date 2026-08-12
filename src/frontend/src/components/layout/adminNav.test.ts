import { describe, expect, it } from 'vitest';
import { ADMIN_NAV, adminCrumbs } from './adminNav';

describe('ADMIN_NAV', () => {
  it('keeps the nine destinations the EJS sidebar had, in order', () => {
    expect(ADMIN_NAV.map((item) => item.label)).toEqual([
      'Dashboard',
      'Products',
      'Categories',
      'Brands',
      'Orders',
      'Returns',
      'Users',
      'Coupons',
      'Sales'
    ]);
  });

  it('gives every item an icon - the original had none', () => {
    for (const item of ADMIN_NAV) {
      expect(item.icon).toBeTypeOf('function');
    }
  });

  it('points every item at an /admin route', () => {
    for (const item of ADMIN_NAV) {
      expect(item.to).toMatch(/^\/admin\//);
    }
  });

  it('excludes the two routes that were commented out and never existed', () => {
    const paths = ADMIN_NAV.map((item) => item.to);
    expect(paths).not.toContain('/admin/offers');
    expect(paths).not.toContain('/admin/settings');
  });
});

describe('adminCrumbs', () => {
  it('shows the dashboard alone at the dashboard', () => {
    expect(adminCrumbs('/admin/dashboard')).toEqual([{ label: 'Dashboard' }]);
  });

  it('does not link the section the visitor is already on', () => {
    expect(adminCrumbs('/admin/products')).toEqual([
      { label: 'Dashboard', to: '/admin/dashboard' },
      { label: 'Products' }
    ]);
  });

  it('links back to the section from a detail page', () => {
    expect(adminCrumbs('/admin/orders/abc123')).toEqual([
      { label: 'Dashboard', to: '/admin/dashboard' },
      { label: 'Orders', to: '/admin/orders' },
      { label: 'Details' }
    ]);
  });

  it('accepts a caller-supplied label, so an id can become a name', () => {
    expect(adminCrumbs('/admin/products/abc123', 'Air Max 90').at(-1)).toEqual({
      label: 'Air Max 90'
    });
  });

  it('names the add and edit pages, which had no breadcrumbs at all before', () => {
    expect(adminCrumbs('/admin/products/add').at(-1)).toEqual({ label: 'New Product' });
    expect(adminCrumbs('/admin/products/abc123/edit').at(-1)).toEqual({ label: 'Edit' });
  });

  it('singularises the section name sensibly', () => {
    expect(adminCrumbs('/admin/categories/add').at(-1)).toEqual({ label: 'New Category' });
    expect(adminCrumbs('/admin/coupons/add').at(-1)).toEqual({ label: 'New Coupon' });
  });

  it('always starts at the dashboard', () => {
    for (const item of ADMIN_NAV) {
      expect(adminCrumbs(item.to)[0]?.label).toBe('Dashboard');
    }
  });

  it('does not fall over on a path outside the known sections', () => {
    expect(() => adminCrumbs('/admin/nonsense')).not.toThrow();
  });
});
