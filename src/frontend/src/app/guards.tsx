import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from './store';
import { bootstrapSession, selectSession } from '@/features/auth/authSlice';
import type { Audience } from '@/types/domain';

/**
 * Route guards.
 *
 * These mirror the server middlewares they replace - `requireAuth` (seven
 * near-identical copies across the module route files) and `isGuest` - but
 * with one difference forced by httpOnly cookies: the client cannot read its
 * own session, so a guard has to ask the server before it can decide.
 *
 * That is why 'unknown' and 'checking' both render a placeholder rather than
 * redirecting. Treating "not yet known" as "signed out" would bounce every
 * signed-in user to the login page on a hard refresh.
 */

const SessionPending = () => (
  <div className="flex min-h-screen items-center justify-center" role="status" aria-live="polite">
    <span className="sr-only">Checking your session…</span>
    <div
      className="size-8 animate-spin rounded-full border-2 border-line border-t-brand"
      aria-hidden="true"
    />
  </div>
);

/** Asks the server who we are, once, if we do not already know. */
const useSession = (audience: Audience) => {
  const dispatch = useAppDispatch();
  const session = useAppSelector(selectSession(audience));

  useEffect(() => {
    if (session.status === 'unknown') {
      void dispatch(bootstrapSession(audience));
    }
  }, [dispatch, audience, session.status]);

  return session;
};

interface GuardProps {
  audience?: Audience;
  /** Where to send an unauthenticated visitor. */
  redirectTo?: string;
}

/**
 * Requires a session. Remembers where the visitor was headed so login can
 * return them there instead of dumping everyone on the home page.
 */
export const RequireAuth = ({ audience = 'user', redirectTo }: GuardProps) => {
  const session = useSession(audience);
  const location = useLocation();

  if (session.status === 'unknown' || session.status === 'checking') {
    return <SessionPending />;
  }

  if (session.status === 'anonymous') {
    const target = redirectTo ?? (audience === 'admin' ? '/admin/login' : '/login');
    return <Navigate to={target} replace state={{ from: location }} />;
  }

  return <Outlet />;
};

/**
 * The inverse: login and signup pages an authenticated visitor should not see.
 * Matches `isGuest`, which redirected shoppers to /home.
 */
export const RequireGuest = ({ audience = 'user', redirectTo }: GuardProps) => {
  const session = useSession(audience);

  if (session.status === 'unknown' || session.status === 'checking') {
    return <SessionPending />;
  }

  if (session.status === 'authenticated') {
    return <Navigate to={redirectTo ?? (audience === 'admin' ? '/admin/dashboard' : '/')} replace />;
  }

  return <Outlet />;
};
