import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { BsHeart, BsList, BsX } from 'react-icons/bs';
import { useAppSelector } from '@/app/store';
import { selectSession } from '@/features/auth/authSlice';
import { cn } from '@/lib/cn';
import AccountMenu from './AccountMenu';
import CartBadge from './CartBadge';
import SearchTypeahead from './SearchTypeahead';
import Logo from '@/components/Logo';

/**
 * The storefront navbar.
 *
 * Same four links as the EJS version, but every one of them now highlights -
 * About and Help never did, because the old template only compared `active`
 * against 'home' and 'shop'. NavLink derives it from the route instead, so a
 * new link cannot forget to.
 *
 * The mobile menu is a real panel rather than a Bootstrap collapse that
 * reflowed the same DOM.
 */
interface NavLinkItem {
  to: string;
  label: string;
  /** Home would otherwise match every route, since every path starts with "/". */
  end?: boolean;
}

const LINKS: NavLinkItem[] = [
  { to: '/', label: 'Home', end: true },
  { to: '/shop', label: 'Shop' },
  { to: '/about', label: 'About' },
  { to: '/help', label: 'Help' }
];

const Navbar = () => {
  const location = useLocation();
  const { status } = useAppSelector(selectSession('user'));
  const [menuOpen, setMenuOpen] = useState(false);

  const signedIn = status === 'authenticated';

  // Navigating with the mobile menu open should close it, or it covers the
  // page that was just opened.
  useEffect(() => setMenuOpen(false), [location.pathname]);

  // The panel is fixed and full-height, so the page behind it must not scroll.
  useEffect(() => {
    if (!menuOpen) return undefined;

    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = overflow;
    };
  }, [menuOpen]);

  /**
   * The nav links, with the underline that slides in.
   *
   * The rule is drawn as an `::after` scaled on the X axis rather than as a
   * border, because a border can only appear and disappear - there is nothing
   * to animate between. Scaling from `origin-left` gives the wipe, and
   * transform animates on the compositor, so it does not cause layout work on
   * hover.
   *
   * The active link is simply the same rule already at full width, so moving
   * between pages and hovering read as one idea rather than two effects.
   */
  const linkClasses = ({ isActive }: { isActive: boolean }) =>
    cn(
      'relative py-1 text-base transition-colors',
      "after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:bg-brand after:content-['']",
      'after:origin-left after:transition-transform after:duration-300 after:ease-out',
      isActive
        ? 'font-bold text-white after:scale-x-100'
        : 'font-medium text-white/75 after:scale-x-0 hover:text-white hover:after:scale-x-100'
    );

  return (
    <header className="sticky top-0 z-40 bg-ink text-white">
      <div className="mx-auto flex h-20 max-w-7xl items-center gap-5 px-4 sm:px-6">
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          aria-expanded={menuOpen}
          className="rounded p-2 text-white transition-colors hover:bg-white/10 lg:hidden"
        >
          <BsList className="size-5" aria-hidden="true" />
        </button>

        <Link to="/" className="shrink-0" aria-label="LacedUp home">
          <Logo onDark width={168} />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-8 lg:flex">
          {LINKS.map(({ to, label, end }) => (
            <NavLink key={to} to={to} end={end} className={linkClasses}>
              {label}
            </NavLink>
          ))}
        </nav>

        <SearchTypeahead className="ml-auto hidden max-w-sm flex-1 md:block" />

        <div className="ml-auto flex items-center gap-1 md:ml-0">
          {signedIn ? (
            <>
              <Link
                to="/wishlist"
                aria-label="Wishlist"
                className="hidden rounded-full p-2 text-white transition-colors hover:bg-white/10 sm:block"
              >
                <BsHeart className="size-5" aria-hidden="true" />
              </Link>
              <CartBadge enabled={signedIn} />
              <AccountMenu />
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="rounded-md px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                Sign in
              </Link>
              <Link
                to="/signup"
                className="rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover"
              >
                Sign up
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-white/15 px-4 py-2 md:hidden">
        <SearchTypeahead />
      </div>

      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />

          <nav
            aria-label="Mobile"
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-xl"
          >
            <div className="flex h-16 items-center justify-between border-b border-line px-4">
              {/* The drawer panel is white, so the mark is inverted here. */}
              <Logo width={116} />
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
                className="rounded p-2 text-ink transition-colors hover:bg-card"
              >
                <BsX className="size-5" aria-hidden="true" />
              </button>
            </div>

            <div className="flex flex-col gap-1 p-4">
              {LINKS.map(({ to, label, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    cn(
                      'rounded-md px-3 py-2.5 transition-colors',
                      isActive ? 'bg-card font-semibold text-brand' : 'text-ink hover:bg-card'
                    )
                  }
                >
                  {label}
                </NavLink>
              ))}

              {signedIn && (
                <NavLink
                  to="/wishlist"
                  className={({ isActive }) =>
                    cn(
                      'rounded-md px-3 py-2.5 transition-colors',
                      isActive ? 'bg-card font-semibold text-brand' : 'text-ink hover:bg-card'
                    )
                  }
                >
                  Wishlist
                </NavLink>
              )}
            </div>

            {!signedIn && (
              <div className="mt-auto flex flex-col gap-2 border-t border-line p-4">
                <Link
                  to="/login"
                  className="rounded-md border border-line px-4 py-2.5 text-center text-sm font-medium text-ink"
                >
                  Sign in
                </Link>
                <Link
                  to="/signup"
                  className="rounded-md bg-brand px-4 py-2.5 text-center text-sm font-medium text-white"
                >
                  Sign up
                </Link>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
};

export default Navbar;
