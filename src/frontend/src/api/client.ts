import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import type { Audience } from '@/types/domain';

/**
 * The HTTP client.
 *
 * Auth is carried in httpOnly cookies, so there is no token to read, attach or
 * store - `withCredentials` is the entire client-side auth setup. The rest of
 * this file is the refresh dance.
 */

declare module 'axios' {
  export interface InternalAxiosRequestConfig {
    /** Set once a request has already been retried after a refresh. */
    _retried?: boolean;
    /** Opts a request out of refresh handling (the refresh call itself). */
    _skipAuthRefresh?: boolean;
  }
}

export const api: AxiosInstance = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { Accept: 'application/json' }
});

/**
 * Which cookie pair a request travels on.
 *
 * The backend decides this by path - anything under /admin uses the admin
 * pair, everything else the shopper pair (jwt-auth.middleware.ts). The client
 * has to agree, or a 401 on an admin route would try to refresh the shopper
 * session and silently fail.
 *
 * The segment boundary matters: a bare `startsWith('/admin')` also matches
 * `/administrators`. No such route exists today, so this agrees with the
 * backend on every real path - but the backend does use the naive check, so
 * adding one would break there rather than here.
 */
export const audienceFor = (url: string | undefined): Audience => {
  const path = url?.replace(/^\/api/, '') ?? '';
  return path === '/admin' || path.startsWith('/admin/') ? 'admin' : 'user';
};

const REFRESH_ENDPOINT: Record<Audience, string> = {
  user: '/auth/refresh',
  admin: '/admin/auth/refresh'
};

/**
 * One in-flight refresh per audience.
 *
 * Refresh tokens rotate single-use: the presented token is revoked as part of
 * the exchange. So if three requests 401 at once and each fires its own
 * refresh, the first succeeds and the other two present a token that was just
 * revoked - all three end up signed out. Sharing the promise means one
 * exchange, and everyone waits on it.
 */
const inFlight: Partial<Record<Audience, Promise<boolean>>> = {};

const refreshSession = (audience: Audience): Promise<boolean> => {
  const existing = inFlight[audience];
  if (existing) return existing;

  const attempt = api
    .post(REFRESH_ENDPOINT[audience], null, { _skipAuthRefresh: true } as never)
    .then(() => true)
    .catch(() => false)
    .finally(() => {
      delete inFlight[audience];
    });

  inFlight[audience] = attempt;
  return attempt;
};

/**
 * Called when a session cannot be recovered.
 *
 * Set by the app at startup so this module stays free of router and store
 * imports - it is imported by tests and by MSW handlers, and dragging the
 * store in would make both awkward.
 */
type SessionExpiredHandler = (audience: Audience) => void;

let onSessionExpired: SessionExpiredHandler = () => {};

export const setSessionExpiredHandler = (handler: SessionExpiredHandler): void => {
  onSessionExpired = handler;
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as InternalAxiosRequestConfig | undefined;

    if (!config || error.response?.status !== 401) {
      return Promise.reject(error);
    }

    // The refresh call itself 401ing means the refresh token is gone or
    // already used. Nothing left to try.
    if (config._skipAuthRefresh) {
      return Promise.reject(error);
    }

    // Refresh once per request, never in a loop.
    if (config._retried) {
      onSessionExpired(audienceFor(config.url));
      return Promise.reject(error);
    }

    const audience = audienceFor(config.url);
    const refreshed = await refreshSession(audience);

    if (!refreshed) {
      onSessionExpired(audience);
      return Promise.reject(error);
    }

    config._retried = true;
    return api.request(config);
  }
);

/** Shape of the error payloads the backend sends. */
interface ErrorBody {
  message?: string;
  error?: string;
  errors?: Array<{ msg?: string; message?: string }>;
}

/**
 * A message worth showing a user.
 *
 * Controllers are inconsistent about the field they use - `message`, `error`,
 * or an express-validator `errors` array - so all three are checked. 429 gets
 * an explicit case because six routes are rate limited and the default body
 * reads like a server fault rather than "you did that too quickly".
 */
export const errorMessage = (error: unknown, fallback = 'Something went wrong'): string => {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error.message : fallback;
  }

  if (error.code === 'ERR_NETWORK') return 'Cannot reach the server. Check your connection.';
  if (error.response?.status === 429) return 'Too many attempts. Please wait a moment and try again.';

  const body = error.response?.data as ErrorBody | undefined;
  return body?.message ?? body?.error ?? body?.errors?.[0]?.msg ?? body?.errors?.[0]?.message ?? fallback;
};
