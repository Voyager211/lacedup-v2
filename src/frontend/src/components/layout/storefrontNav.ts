import {
  CircleAlert,
  CircleCheck,
  CreditCard,
  Heart,
  Home,
  Info,
  KeyRound,
  LifeBuoy,
  MapPin,
  Package,
  Receipt,
  RotateCcw,
  ShoppingCart,
  Store,
  User,
  Users,
  Wallet,
  type LucideIcon
} from 'lucide-react';
import type { Crumb } from '@/components/Breadcrumbs';

/**
 * The storefront page map, and the breadcrumb trail derived from it.
 *
 * The EJS storefront had no breadcrumbs at all outside two pages, and those two
 * wrote their trails by hand. Deriving them from one table is what makes "every
 * page has breadcrumbs" a property of the shell rather than something each new
 * page has to remember - the same reason the admin side derives its trail from
 * ADMIN_NAV.
 *
 * `parent` is the page above this one in the trail, which is not always the
 * page above it in the URL: /checkout hangs off /cart, and the three
 * post-payment pages hang off /orders, because that is where the shopper is
 * actually going next. Linking them back to /checkout would be a dead end - the
 * cart is empty by then and the page would bounce.
 */

interface PageNode {
  label: string;
  icon: LucideIcon;
  /** The crumb above this one. Omitted means it hangs directly off Home. */
  parent?: string;
  /**
   * The page's own container width, so the trail lines up with the content
   * underneath it. Must match the `max-w-*` the page itself uses.
   */
  width: string;
}

const HOME: PageNode = { label: 'Home', icon: Home, width: 'max-w-7xl' };

const PAGES: Record<string, PageNode> = {
  '/': HOME,
  '/shop': { label: 'Shop', icon: Store, width: 'max-w-7xl' },
  /* 'Product' is the placeholder the page replaces once it knows the title. */
  '/product/:slug': { label: 'Product', icon: Package, parent: '/shop', width: 'max-w-7xl' },
  '/about': { label: 'About', icon: Info, width: 'max-w-4xl' },
  '/help': { label: 'Help', icon: LifeBuoy, width: 'max-w-4xl' },

  '/cart': { label: 'Cart', icon: ShoppingCart, width: 'max-w-6xl' },
  '/wishlist': { label: 'Wishlist', icon: Heart, width: 'max-w-7xl' },
  '/checkout': { label: 'Checkout', icon: CreditCard, parent: '/cart', width: 'max-w-6xl' },
  '/checkout/order-success/:id': {
    label: 'Order placed',
    icon: CircleCheck,
    parent: '/orders',
    width: 'max-w-2xl'
  },
  '/checkout/order-failure/:id': {
    label: 'Payment failed',
    icon: CircleAlert,
    parent: '/orders',
    width: 'max-w-2xl'
  },
  '/checkout/retry-payment/:id': {
    label: 'Retry payment',
    icon: RotateCcw,
    parent: '/orders',
    width: 'max-w-2xl'
  },

  '/orders': { label: 'Orders', icon: Package, width: 'max-w-4xl' },
  /* Replaced by the order id, which is what the shopper quotes to support. */
  '/orders/:orderId': { label: 'Order', icon: Receipt, parent: '/orders', width: 'max-w-4xl' },

  /* The account pages are siblings behind one sidebar, not a hierarchy, so
     they all hang off Home - which is what the sidebar itself implies. */
  '/profile': { label: 'Profile', icon: User, width: 'max-w-5xl' },
  '/profile/change-password': {
    label: 'Password',
    icon: KeyRound,
    parent: '/profile',
    width: 'max-w-5xl'
  },
  '/addresses': { label: 'Addresses', icon: MapPin, width: 'max-w-5xl' },
  '/wallet': { label: 'Wallet', icon: Wallet, width: 'max-w-5xl' },
  '/referrals': { label: 'Referrals', icon: Users, width: 'max-w-5xl' }
};

/**
 * The table key for a path, with its route params folded back into patterns.
 *
 * Matching on the pattern rather than the literal path is what keeps
 * /orders/ORD000123 and /orders/ORD000999 from needing an entry each.
 */
const patternFor = (pathname: string): string => {
  const segments = pathname.replace(/\/+$/, '').split('/').filter(Boolean);

  if (segments[0] === 'product' && segments[1]) return '/product/:slug';
  if (segments[0] === 'orders' && segments[1]) return '/orders/:orderId';
  if (segments[0] === 'checkout' && segments[1]) return `/checkout/${segments[1]}/:id`;

  return `/${segments.join('/')}`;
};

export interface CrumbDetail {
  /** Names the page - a product's title reads better than "Product". */
  label?: string;
  /** Extra crumbs to sit between the derived trail and the current page. */
  parents?: Crumb[];
}

/**
 * The trail for a storefront path.
 *
 * Home is always the root and is always a link, except on Home itself where
 * there is nothing above it - the same shape the admin dashboard has.
 */
export const storefrontCrumbs = (pathname: string, detail: CrumbDetail = {}): Crumb[] => {
  const homeLink: Crumb = { label: HOME.label, to: '/', icon: HOME.icon };
  const key = patternFor(pathname);
  const page = PAGES[key];

  if (key === '/') return [{ label: HOME.label, icon: HOME.icon }];

  // An unmapped path still gets a way back rather than an empty bar.
  if (!page) return [homeLink];

  const trail: Crumb[] = [homeLink];

  const ancestors: string[] = [];
  for (let parent = page.parent; parent; parent = PAGES[parent]?.parent) {
    ancestors.unshift(parent);
  }

  for (const path of ancestors) {
    const node = PAGES[path];
    if (node) trail.push({ label: node.label, to: path, icon: node.icon });
  }

  if (detail.parents) trail.push(...detail.parents);

  trail.push({ label: detail.label ?? page.label, icon: page.icon });

  return trail;
};

/** The container width the trail should sit in, matching the page below it. */
export const storefrontCrumbWidth = (pathname: string): string =>
  PAGES[patternFor(pathname)]?.width ?? 'max-w-7xl';
