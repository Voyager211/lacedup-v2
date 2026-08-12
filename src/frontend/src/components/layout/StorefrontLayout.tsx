import { useEffect } from 'react';
import { Outlet, ScrollRestoration, useLocation } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/app/store';
import { bootstrapSession, selectSession } from '@/features/auth/authSlice';
import Navbar from './Navbar';
import Footer from './Footer';

/**
 * The storefront shell.
 *
 * Bootstraps the shopper session once for the whole tree rather than leaving
 * it to the guards. Public pages need to know too - the navbar has to decide
 * between an account menu and a pair of sign-in buttons - and asking here
 * means a visitor moving from a public page to a guarded one already has the
 * answer, so the guard renders without a flash of its pending state.
 */
const StorefrontLayout = () => {
  const dispatch = useAppDispatch();
  const { status } = useAppSelector(selectSession('user'));
  const location = useLocation();

  useEffect(() => {
    if (status === 'unknown') void dispatch(bootstrapSession('user'));
  }, [dispatch, status]);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      {/* Skip link target, and where focus should land on navigation. */}
      <main id="main" className="flex-1" key={location.pathname}>
        <Outlet />
      </main>

      <Footer />
      <ScrollRestoration />
    </div>
  );
};

export default StorefrontLayout;
