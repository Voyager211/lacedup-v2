import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BsBagCheck,
  BsBoxArrowRight,
  BsGeoAlt,
  BsPerson,
  BsWallet2
} from 'react-icons/bs';
import { useAppDispatch, useAppSelector } from '@/app/store';
import { selectSession, signOut } from '@/features/auth/authSlice';
import { cn } from '@/lib/cn';

/**
 * Account dropdown.
 *
 * The EJS version held only Profile and Logout, and its profile link was
 * `href="#"` with an inline `console.log('Profile clicked')` handler. Orders,
 * addresses and wallet were reachable only from inside the profile page.
 */
const ITEMS = [
  { to: '/profile', label: 'Profile', icon: BsPerson },
  { to: '/orders', label: 'Orders', icon: BsBagCheck },
  { to: '/addresses', label: 'Addresses', icon: BsGeoAlt },
  { to: '/wallet', label: 'Wallet', icon: BsWallet2 }
] as const;

const AccountMenu = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { user } = useAppSelector(selectSession('user'));

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      // Focus goes back to the trigger, or the keyboard user is stranded at
      // the top of the document.
      triggerRef.current?.focus();
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const handleSignOut = async () => {
    setOpen(false);
    await dispatch(signOut('user'));
    navigate('/');
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-full p-2 text-ink transition-colors hover:bg-card"
      >
        {user?.profilePhoto ? (
          <img src={user.profilePhoto} alt="" className="size-6 rounded-full object-cover" />
        ) : (
          <BsPerson className="size-5" aria-hidden="true" />
        )}
        <span className="sr-only">Account menu for {user?.name ?? 'your account'}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-lg border border-line bg-white shadow-lg"
        >
          <div className="border-b border-line px-4 py-3">
            <p className="truncate font-medium text-ink">{user?.name}</p>
            <p className="truncate text-xs text-ink-muted">{user?.email}</p>
          </div>

          <div className="py-1">
            {ITEMS.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2 text-sm text-ink transition-colors hover:bg-card"
              >
                <Icon className="size-4 text-ink-muted" aria-hidden="true" />
                {label}
              </Link>
            ))}
          </div>

          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            className={cn(
              'flex w-full items-center gap-3 border-t border-line px-4 py-2.5',
              'text-sm text-danger transition-colors hover:bg-card'
            )}
          >
            <BsBoxArrowRight className="size-4" aria-hidden="true" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
};

export default AccountMenu;
