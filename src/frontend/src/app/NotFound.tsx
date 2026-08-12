import { Link } from 'react-router-dom';

/** Replaces views/errors/404.ejs. */
const NotFound = () => (
  <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
    <p className="font-display text-7xl text-brand">404</p>
    <h1 className="mt-4 font-heading text-2xl font-semibold text-ink">Page not found</h1>
    <p className="mt-2 max-w-md text-ink-muted">
      That page does not exist, or it has moved.
    </p>
    <Link
      to="/"
      className="mt-8 rounded-md bg-brand px-5 py-2.5 font-medium text-white transition-colors hover:bg-brand-hover"
    >
      Back to the shop
    </Link>
  </div>
);

export default NotFound;
