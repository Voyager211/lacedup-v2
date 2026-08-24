import type { Request } from 'express';

/**
 * Should this request be answered with JSON rather than a rendered page?
 *
 * A handful of routers are mounted twice - on their historic path for the EJS
 * views, and under /api for the SPA (see app.ts). That means `GET /cart` and
 * `GET /api/cart` reach the *same* handler, one wanting HTML and the other
 * JSON. Rather than duplicate a hundred lines of cart assembly into a second
 * endpoint, the handler asks this.
 *
 * The mount path is the primary signal because it is unambiguous: a request
 * that arrived under /api wanted the API. The Accept and XHR checks are
 * fallbacks for callers on the bare path - the older EJS scripts fetch some of
 * these routes directly.
 */
export const wantsJson = (req: Request): boolean => {
  if (req.baseUrl?.startsWith('/api') || req.originalUrl?.startsWith('/api')) return true;
  if (req.xhr) return true;

  return Boolean(req.headers.accept?.includes('json'));
};
