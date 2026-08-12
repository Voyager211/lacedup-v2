import { Link, Outlet } from 'react-router-dom';

/**
 * The auth shell.
 *
 * A centred card with no navbar or footer, matching the EJS auth-layout - but
 * without its page-transition overlay, whose driving object
 * (`window.PageTransition`) never existed, so the CSS and the three branches
 * guarding on it were dead.
 */
const AuthLayout = () => (
  <div className="flex min-h-screen flex-col bg-card">
    <header className="flex justify-center py-8">
      <Link to="/" className="font-display text-3xl tracking-wide text-ink">
        LACEDUP
      </Link>
    </header>

    <main id="main" className="flex flex-1 justify-center px-4 pb-16">
      <div className="w-full max-w-md">
        <div className="rounded-xl border border-line bg-white p-6 shadow-sm sm:p-8">
          <Outlet />
        </div>
      </div>
    </main>
  </div>
);

export default AuthLayout;
