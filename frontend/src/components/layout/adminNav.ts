import {
  BarChart3,
  Bookmark,
  FileText,
  Gauge,
  LayoutGrid,
  Package,
  Ticket,
  Undo2,
  Users,
  type LucideIcon
} from 'lucide-react';
import type { Crumb } from '@/components/Breadcrumbs';

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
  icon: LucideIcon;
  /** Child routes that should keep this item highlighted. */
  matches?: string[];
}

export const ADMIN_NAV: AdminNavItem[] = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: Gauge },
  { to: '/admin/products', label: 'Products', icon: Package },
  { to: '/admin/categories', label: 'Categories', icon: LayoutGrid },
  { to: '/admin/brands', label: 'Brands', icon: Bookmark },
  { to: '/admin/orders', label: 'Orders', icon: FileText },
  { to: '/admin/returns', label: 'Returns', icon: Undo2 },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/coupons', label: 'Coupons', icon: Ticket },
  { to: '/admin/sales-report', label: 'Sales', icon: BarChart3 }
];

/**
 * Breadcrumbs from the current path.
 *
 * The EJS pages each passed a hand-written `breadcrumbs` array into the
 * partial, which is why the coupons page ended up with a different root icon
 * from every other page. Deriving the trail from the route removes the chance
 * of that drift - and of a page forgetting its breadcrumbs entirely, as
 * add-product and edit-product both did.
 *
 * Each crumb carries the icon of the section it points at, so the trail reads
 * the same as the sidebar it mirrors.
 */
export const adminCrumbs = (pathname: string, detailLabel?: string): Crumb[] => {
  const dashboard = ADMIN_NAV[0]!;
  const crumbs: Crumb[] = [
    { label: dashboard.label, to: dashboard.to, icon: dashboard.icon }
  ];

  const section = ADMIN_NAV.find(
    (item) => item.to !== '/admin/dashboard' && pathname.startsWith(item.to)
  );

  if (!section) {
    return pathname.startsWith('/admin/dashboard')
      ? [{ label: dashboard.label, icon: dashboard.icon }]
      : crumbs;
  }

  const isSectionRoot = pathname === section.to;
  crumbs.push({
    label: section.label,
    icon: section.icon,
    ...(isSectionRoot ? {} : { to: section.to })
  });

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
