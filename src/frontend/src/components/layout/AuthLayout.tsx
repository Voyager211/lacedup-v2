import { Link, Outlet, useLocation } from 'react-router-dom';
import Logo from '@/components/Logo';
import { cn } from '@/lib/cn';

/**
 * The auth shell.
 *
 * Sign in and create-account are a two-panel card: photograph on the left,
 * form on the right. The other four auth pages - the OTP steps and the
 * password reset - keep the plain centred card, because they are short
 * single-purpose forms that a half-empty photo panel would only stretch.
 *
 * The photograph fills its half edge to edge, so it is `object-cover` and the
 * card's `overflow-hidden` clips it to the rounded corners. That crops a
 * little off the top and bottom - both sources are 4:5 and the panel is
 * taller than that - which is why the signup form is split into two steps:
 * a single long form would have made its panel far taller than the login one,
 * and the two would have cropped by visibly different amounts.
 *
 * On small screens the panel becomes a short banner above the form rather than
 * disappearing, so the page still looks like itself on a phone without pushing
 * the first field below the fold.
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

/**
 * Height reserved for the signup card.
 *
 * Its two steps are naturally 781px and 549px, so without this the whole card
 * - photograph included - would jump by 230px the moment Proceed is pressed.
 * Reserving the taller step's height holds it still.
 *
 * Only signup needs this; login has one state and should size to its content.
 * The number is the measured height of the taller step, so it has to be
 * revisited if a field is added - a step taller than the reserve simply grows
 * the card again, which is a visible jump rather than a broken layout.
 */
const MIN_HEIGHT: Record<string, string> = {
  '/signup': 'md:min-h-[48.8rem]'
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
        <div
          className={cn(
            image && 'flex flex-col md:flex-row md:items-stretch',
            MIN_HEIGHT[pathname]
          )}
        >
          {image && (
            <img
              src={image}
              alt=""
              // Decorative: the page already has a heading, and describing the
              // shoe adds nothing a screen reader user needs here.
              aria-hidden="true"
              className="h-44 w-full shrink-0 object-cover md:h-auto md:w-[46%]"
            />
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
