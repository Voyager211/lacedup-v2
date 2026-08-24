import { NavLink } from 'react-router-dom';
import {
  BsBagCheck,
  BsGeoAlt,
  BsKey,
  BsPeople,
  BsPerson,
  BsWallet2
} from 'react-icons/bs';
import { cn } from '@/lib/cn';

/**
 * The account sidebar.
 *
 * Replaces `profile-sidebar.ejs` and `profile-card.ejs` - 362 lines between
 * them, with ~285 lines of CSS duplicated into every account page that
 * included them. The active item is derived from the route rather than passed
 * in as an `active` string, so a page cannot forget to set it.
 */
const LINKS = [
  { to: '/profile', label: 'Profile', icon: BsPerson, end: true },
  { to: '/orders', label: 'Orders', icon: BsBagCheck },
  { to: '/addresses', label: 'Addresses', icon: BsGeoAlt },
  { to: '/wallet', label: 'Wallet', icon: BsWallet2 },
  { to: '/referrals', label: 'Referrals', icon: BsPeople },
  { to: '/profile/change-password', label: 'Password', icon: BsKey }
];

const AccountNav = () => (
  <nav aria-label="Account" className="lg:w-56 lg:shrink-0">
    <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
      {LINKS.map(({ to, label, icon: Icon, end }) => (
        <li key={to}>
          <NavLink
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 whitespace-nowrap rounded-md px-3 py-2.5 text-sm transition-colors',
                isActive ? 'bg-card font-semibold text-brand' : 'text-ink hover:bg-card'
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  className={cn('size-4 shrink-0', isActive ? 'text-brand' : 'text-ink-muted')}
                  aria-hidden="true"
                />
                {label}
              </>
            )}
          </NavLink>
        </li>
      ))}
    </ul>
  </nav>
);

export default AccountNav;

/** Shared page frame, so every account page lines up identically. */
export const AccountLayout = ({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
    <h1 className="mb-6 font-heading text-3xl font-semibold text-ink">{title}</h1>

    <div className="flex flex-col gap-8 lg:flex-row">
      <AccountNav />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  </div>
);
