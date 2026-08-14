import { Link, Outlet, useLocation } from 'react-router-dom';
import Logo from '@/components/Logo';

/**
 * The auth shell.
 *
 * Sign in and create-account are a two-panel card: photograph on the left,
 * form on the right. The other four auth pages - the OTP steps and the
 * password reset - keep the plain centred card, because they are short
 * single-purpose forms that a half-empty photo panel would only stretch.
 *
 * Both photographs are 4:5, so the panel is fixed at that ratio and the image
 * is `object-contain`. That gives the two pages an identically sized image
 * with nothing cropped off, which cover would not: the signup form is four
 * fields longer, so a stretch-to-fit panel would crop it further than the
 * login one.
 */

const BASE = 'https://res.cloudinary.com/daqfxkc3u/image/upload';

/**
 * Keyed by path rather than passed down from the page, because the card is the
 * thing that has to contain both panels and the card lives here.
 */
const PANEL_IMAGE: Record<string, string> = {
  '/login': `${BASE}/f_auto,q_auto,w_900/v1749657503/user-login-image_gcethm.jpg`,
  '/signup': `${BASE}/f_auto,q_auto,w_900/v1749657503/user-signup-image_syswag.jpg`
};

const AuthLayout = () => {
  const { pathname } = useLocation();
  const image = PANEL_IMAGE[pathname];

  return (
    <div className="flex min-h-screen items-center justify-center bg-card px-4 py-10">
      <main
        id="main"
        className={
          image
            ? 'w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-lg'
            : 'w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-lg'
        }
      >
        <div className={image ? 'flex flex-col md:flex-row' : ''}>
          {image && (
            <div className="shrink-0 self-center p-3 md:w-[46%] md:p-4">
              <img
                src={image}
                alt=""
                // Decorative: the page already has a heading, and describing
                // the shoe adds nothing a screen reader user needs here.
                aria-hidden="true"
                className="aspect-[4/5] w-full rounded-xl object-contain"
              />
            </div>
          )}

          <div className="flex flex-1 flex-col justify-center px-6 py-8 sm:px-10">
            <Link to="/" className="mb-6 self-center" aria-label="LacedUp home">
              <Logo width={150} />
            </Link>

            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
};

export default AuthLayout;
