import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, ScrollRestoration, useLocation, useNavigate } from 'react-router-dom';
import { BsBoxArrowRight, BsChevronRight, BsList, BsPersonCircle, BsX } from 'react-icons/bs';
import { useAppDispatch, useAppSelector } from '@/app/store';
import { bootstrapSession, selectSession, signOut } from '@/features/auth/authSlice';
import { cn } from '@/lib/cn';
import { ADMIN_NAV, adminCrumbs } from './adminNav';
import Logo from '@/components/Logo';

/**
 * The admin shell.
 *
 * The EJS version was nine text-only links with no icons and no active state,
 * a header containing nothing but a bell that opened a permanently empty
 * dropdown, and no indication anywhere of who was signed in. It also had no
 * mobile handling at all - the sidebar was a fixed-width column at every
 * viewport.
 *
 * Per the recorded decision, the routes and information architecture are
 * unchanged; the chrome around them is not. The bell is gone: there is no
 * notifications API and never was.
 */

const AdminSidebarLinks = ({ onNavigate }: { onNavigate?: () => void }) => (
  <nav aria-label="Admin sections" className="flex flex-col gap-1 p-3">
    {ADMIN_NAV.map(({ to, label, icon: Icon }) => (
      <NavLink
        key={to}
        to={to}
        onClick={onNavigate}
        className={({ isActive }) =>
          cn(
            'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors',
            isActive
              ? 'bg-brand/10 font-semibold text-brand'
              : 'text-white/70 hover:bg-white/5 hover:text-white'
          )
        }
      >
        {({ isActive }) => (
          <>
            <Icon
              className={cn('size-4 shrink-0', isActive ? 'text-brand' : 'text-white/50')}
              aria-hidden="true"
            />
            {label}
          </>
        )}
      </NavLink>
    ))}
  </nav>
);

const AdminIdentity = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { user } = useAppSelector(selectSession('admin'));

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-ink transition-colors hover:bg-card"
      >
        <BsPersonCircle className="size-5 text-ink-muted" aria-hidden="true" />
        <span className="hidden max-w-[12rem] truncate sm:inline">
          {user?.name ?? 'Admin'}
        </span>
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

          <button
            type="button"
            role="menuitem"
            onClick={async () => {
              setOpen(false);
              await dispatch(signOut('admin'));
              navigate('/admin/login');
            }}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-danger transition-colors hover:bg-card"
          >
            <BsBoxArrowRight className="size-4" aria-hidden="true" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
};

const AdminLayout = () => {
  const dispatch = useAppDispatch();
  const location = useLocation();
  const { status } = useAppSelector(selectSession('admin'));
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (status === 'unknown') void dispatch(bootstrapSession('admin'));
  }, [dispatch, status]);

  useEffect(() => setSidebarOpen(false), [location.pathname]);

  const crumbs = adminCrumbs(location.pathname);
  const onLoginPage = location.pathname === '/admin/login';

  // The login page uses the same route branch but must not show the shell -
  // there is nobody signed in to show it to.
  if (onLoginPage) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-card">
        <Outlet />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-canvas">
      <aside className="hidden w-60 shrink-0 flex-col bg-ink lg:flex">
        <Link
          to="/admin/dashboard"
          className="flex h-16 items-center px-5"
        >
          <Logo variant="admin" onDark width={150} />
          <span className="ml-2 rounded bg-white/10 px-1.5 py-0.5 text-[0.625rem] font-sans font-semibold uppercase tracking-wider">
            Admin
          </span>
        </Link>
        <AdminSidebarLinks />
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute inset-y-0 left-0 flex w-60 flex-col bg-ink shadow-xl">
            <div className="flex h-16 items-center justify-between px-5">
              <Logo variant="admin" onDark width={140} />
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                aria-label="Close menu"
                className="rounded p-2 text-white/70 transition-colors hover:bg-white/10"
              >
                <BsX className="size-5" aria-hidden="true" />
              </button>
            </div>
            <AdminSidebarLinks onNavigate={() => setSidebarOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center gap-3 border-b border-line bg-white px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
            className="rounded p-2 text-ink transition-colors hover:bg-card lg:hidden"
          >
            <BsList className="size-5" aria-hidden="true" />
          </button>

          <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
            <ol className="flex items-center gap-1.5 text-sm">
              {crumbs.map((crumb, index) => (
                <li key={`${crumb.label}-${index}`} className="flex items-center gap-1.5">
                  {index > 0 && (
                    <BsChevronRight className="size-3 text-ink-muted/50" aria-hidden="true" />
                  )}
                  {crumb.to ? (
                    <Link to={crumb.to} className="text-ink-muted transition-colors hover:text-ink">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="truncate font-medium text-ink" aria-current="page">
                      {crumb.label}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </nav>

          <AdminIdentity />
        </header>

        <main id="main" className="min-w-0 flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>

      <ScrollRestoration />
    </div>
  );
};

export default AdminLayout;
