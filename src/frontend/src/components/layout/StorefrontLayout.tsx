import { useEffect, useState } from 'react';
import { Outlet, ScrollRestoration, useLocation } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/app/store';
import { bootstrapSession, selectSession } from '@/features/auth/authSlice';
import Breadcrumbs from '@/components/Breadcrumbs';
import { cn } from '@/lib/cn';
import { CrumbDetailProvider } from './crumbLabel';
import { storefrontCrumbs, storefrontCrumbWidth, type CrumbDetail } from './storefrontNav';
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
 *
 * The breadcrumb trail is drawn here rather than by each page, which is the
 * only way "every page has one" survives the next page anyone adds. Two pages
 * used to draw their own; they now hand their name up instead.
 */
const StorefrontLayout = () => {
  const dispatch = useAppDispatch();
  const { status } = useAppSelector(selectSession('user'));
  const location = useLocation();
  const [crumbDetail, setCrumbDetail] = useState<CrumbDetail>({});

  useEffect(() => {
    if (status === 'unknown') void dispatch(bootstrapSession('user'));
  }, [dispatch, status]);

  /*
   * Home is the root of every trail, so its own trail is one crumb pointing at
   * the page you are already on. It also sat between the navbar and a
   * full-bleed hero, where a pale strip reads as a seam rather than as
   * navigation.
   */
  const showCrumbs = location.pathname !== '/';

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      {/* Matched to the width of the page below, so the trail lines up with
          the content rather than floating off to one side of it. */}
      {showCrumbs && (
        <div
          className={cn(
            'mx-auto w-full px-4 pb-4 pt-5 sm:px-6',
            storefrontCrumbWidth(location.pathname)
          )}
        >
          <Breadcrumbs items={storefrontCrumbs(location.pathname, crumbDetail)} />
        </div>
      )}

      {/* Skip link target, and where focus should land on navigation. */}
      <main id="main" className="flex-1" key={location.pathname}>
        <CrumbDetailProvider value={setCrumbDetail}>
          <Outlet />
        </CrumbDetailProvider>
      </main>

      <Footer />
      <ScrollRestoration />
    </div>
  );
};

export default StorefrontLayout;
