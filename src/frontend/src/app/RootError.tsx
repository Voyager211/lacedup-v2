import { isRouteErrorResponse, useRouteError, Link } from 'react-router-dom';

/**
 * The router's error boundary.
 *
 * Replaces views/errors/server-error.ejs - and covers the gap left by the six
 * controllers that render a non-existent 'error' view and therefore throw
 * inside their own error handlers (docs/defects.md). Whatever else happens,
 * something renders here.
 */
const RootError = () => {
  const error = useRouteError();

  const status = isRouteErrorResponse(error) ? error.status : 500;
  const detail =
    isRouteErrorResponse(error)
      ? error.statusText
      : error instanceof Error
        ? error.message
        : null;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="font-display text-7xl text-brand">{status}</p>
      <h1 className="mt-4 font-heading text-2xl font-semibold text-ink">Something went wrong</h1>
      <p className="mt-2 max-w-md text-ink-muted">
        The page could not be loaded. Try again, and if it keeps happening let us know.
      </p>

      {import.meta.env.DEV && detail && (
        <pre className="mt-6 max-w-xl overflow-x-auto rounded-lg border border-line bg-card p-4 text-left font-mono text-xs text-ink">
          {detail}
        </pre>
      )}

      <div className="mt-8 flex gap-3">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-md bg-brand px-5 py-2.5 font-medium text-white transition-colors hover:bg-brand-hover"
        >
          Try again
        </button>
        <Link
          to="/"
          className="rounded-md border border-line px-5 py-2.5 font-medium text-ink transition-colors hover:bg-card"
        >
          Back home
        </Link>
      </div>
    </div>
  );
};

export default RootError;
