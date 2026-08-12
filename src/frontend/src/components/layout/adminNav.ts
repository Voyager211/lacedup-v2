import type { IconType } from 'react-icons';
import {
  BsBookmarkStar,
  BsBoxSeam,
  BsGraphUp,
  BsGrid3X3Gap,
  BsArrowReturnLeft,
  BsPeople,
  BsReceipt,
  BsSpeedometer2,
  BsTicketPerforated
} from 'react-icons/bs';

/**
 * The admin navigation.
 *
 * The same nine destinations the EJS sidebar had, in the same order - but with
 * icons, which it had none of, and enough structure to derive breadcrumbs from
 * rather than passing a hand-written trail into every page.
 *
 * Two commented-out entries in the original pointed at /admin/offers and
 * /admin/settings. Neither route exists on the backend, so neither is here.
 */
export interface AdminNavItem {
  to: string;
  label: string;
  icon: IconType;
  /** Child routes that should keep this item highlighted. */
  matches?: string[];
}

export const ADMIN_NAV: AdminNavItem[] = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: BsSpeedometer2 },
  { to: '/admin/products', label: 'Products', icon: BsBoxSeam },
  { to: '/admin/categories', label: 'Categories', icon: BsGrid3X3Gap },
  { to: '/admin/brands', label: 'Brands', icon: BsBookmarkStar },
  { to: '/admin/orders', label: 'Orders', icon: BsReceipt },
  { to: '/admin/returns', label: 'Returns', icon: BsArrowReturnLeft },
  { to: '/admin/users', label: 'Users', icon: BsPeople },
  { to: '/admin/coupons', label: 'Coupons', icon: BsTicketPerforated },
  { to: '/admin/sales-report', label: 'Sales', icon: BsGraphUp }
];

export interface Crumb {
  label: string;
  to?: string;
}

/**
 * Breadcrumbs from the current path.
 *
 * The EJS pages each passed a hand-written `breadcrumbs` array into the
 * partial, which is why the coupons page ended up with a different root icon
 * from every other page. Deriving the trail from the route removes the chance
 * of that drift - and of a page forgetting its breadcrumbs entirely, as
 * add-product and edit-product both did.
 */
export const adminCrumbs = (pathname: string, detailLabel?: string): Crumb[] => {
  const crumbs: Crumb[] = [{ label: 'Dashboard', to: '/admin/dashboard' }];

  const section = ADMIN_NAV.find(
    (item) => item.to !== '/admin/dashboard' && pathname.startsWith(item.to)
  );

  if (!section) return pathname.startsWith('/admin/dashboard') ? [{ label: 'Dashboard' }] : crumbs;

  const isSectionRoot = pathname === section.to;
  crumbs.push({ label: section.label, ...(isSectionRoot ? {} : { to: section.to }) });

  if (isSectionRoot) return crumbs;

  // Anything deeper is a detail or form page. The caller can name it - a
  // product's title reads better than its id - and falls back to the last
  // path segment.
  const tail = pathname.slice(section.to.length).split('/').filter(Boolean);
  const last = tail.at(-1);

  const label =
    detailLabel ??
    (last === 'add'
      ? `New ${section.label.replace(/ies$/, 'y').replace(/s$/, '')}`
      : last === 'edit'
        ? 'Edit'
        : 'Details');

  crumbs.push({ label });

  return crumbs;
};
