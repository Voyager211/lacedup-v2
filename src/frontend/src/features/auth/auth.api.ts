import { api } from '@/api/client';
import type { Audience, User } from '@/types/domain';

/**
 * Auth calls.
 *
 * Nothing here handles tokens - the cookies are httpOnly and set by the
 * server. `me` exists because that invisibility means the client has no other
 * way to know whether it has a session.
 */

interface MeResponse {
  success: boolean;
  user: User;
}

const ME_ENDPOINT: Record<Audience, string> = {
  user: '/auth/me',
  admin: '/admin/auth/me'
};

/** Resolves to the signed-in user, or null when there is no valid session. */
export const fetchMe = async (audience: Audience): Promise<User | null> => {
  try {
    const { data } = await api.get<MeResponse>(ME_ENDPOINT[audience], {
      // A 401 here IS the answer - it means "not signed in", not "the session
      // needs refreshing". Letting the interceptor try to refresh would turn
      // every anonymous page load into a pointless refresh attempt.
      _skipAuthRefresh: true
    } as never);
    return data.user;
  } catch {
    return null;
  }
};

export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * Shopper login.
 *
 * The route is form-encoded rather than JSON because the EJS login form still
 * posts to it. It answers `{ success: true }` on 200 and `{ error }` on 401.
 */
export const login = async (credentials: LoginCredentials): Promise<void> => {
  await api.post('/login', new URLSearchParams({ ...credentials }), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    _skipAuthRefresh: true
  } as never);
};

export const adminLogin = async (credentials: LoginCredentials): Promise<void> => {
  await api.post('/admin/login', new URLSearchParams({ ...credentials }), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    _skipAuthRefresh: true
  } as never);
};

/**
 * Ends the session server-side, revoking the refresh token row and clearing
 * both cookies. Failure is swallowed deliberately: the client is signing out
 * either way, and stranding someone on a page they wanted to leave because the
 * request failed is worse than a stale server-side row.
 */
export const logout = async (audience: Audience): Promise<void> => {
  try {
    await api.get(audience === 'admin' ? '/admin/logout' : '/logout', {
      _skipAuthRefresh: true
    } as never);
  } catch {
    /* signing out locally regardless */
  }
};
