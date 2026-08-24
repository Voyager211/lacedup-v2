import { FcGoogle } from 'react-icons/fc';

/**
 * The pieces sign-in and create-account share.
 *
 * Kept here rather than in `components/` because they are specific to the two
 * auth cards - the filled input style in particular is deliberately local, not
 * a change to the app's default field.
 */

/**
 * The filled input treatment used on the auth cards.
 *
 * The app's default control is white with a visible border, which is right
 * inside a busy admin table but too noisy on a bare card. Passed per field
 * rather than changed in `Field.tsx`, so checkout, the admin forms and the
 * address dialog are untouched. `cn` is tailwind-merge, so these win over the
 * defaults they replace.
 */
export const FILLED_INPUT = 'border-transparent bg-card focus-visible:outline-ink';

/** The "or" rule between the password form and the Google button. */
export const AuthDivider = () => (
  <div className="my-5 flex items-center gap-3">
    <span className="h-px flex-1 bg-line" />
    <span className="text-sm text-ink-muted">or</span>
    <span className="h-px flex-1 bg-line" />
  </div>
);

/**
 * Google sign-in.
 *
 * A real navigation, not a fetch: OAuth needs the browser to leave for Google
 * and come back to the backend's callback. Vite proxies `/google` in
 * development so it behaves the same in both environments.
 */
export const GoogleButton = ({ children }: { children: React.ReactNode }) => (
  <a
    href="/google"
    className="flex h-11 w-full items-center justify-center gap-2.5 rounded-md border border-line font-medium text-ink transition-colors hover:bg-card"
  >
    <FcGoogle className="size-5" aria-hidden="true" />
    {children}
  </a>
);
