import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import * as authApi from './auth.api';
import { errorMessage } from '@/api/client';
import type { Audience, User } from '@/types/domain';

/**
 * Session state.
 *
 * Two sessions are tracked, not one. The backend issues separate cookie pairs
 * per audience and one browser can legitimately hold both - an admin browsing
 * the storefront as a shopper is a real case, and a shopper token does not
 * satisfy an admin route. Collapsing them into a single `user` would make
 * signing out of one appear to sign out of the other.
 *
 * `status` starts at 'unknown' rather than 'anonymous' because the cookies are
 * httpOnly: on first paint the client genuinely does not know, and a guard
 * that treats "don't know yet" as "signed out" bounces signed-in users to the
 * login page on every refresh.
 */
export type SessionStatus = 'unknown' | 'checking' | 'authenticated' | 'anonymous';

interface Session {
  status: SessionStatus;
  user: User | null;
}

export interface AuthState {
  sessions: Record<Audience, Session>;
}

const emptySession = (): Session => ({ status: 'unknown', user: null });

const initialState: AuthState = {
  sessions: { user: emptySession(), admin: emptySession() }
};

/** Asks the server who we are. Safe to dispatch when already known. */
export const bootstrapSession = createAsyncThunk(
  'auth/bootstrap',
  (audience: Audience) => authApi.fetchMe(audience),
  {
    condition: (audience, { getState }) => {
      const { auth } = getState() as { auth: AuthState };
      return auth.sessions[audience].status !== 'checking';
    }
  }
);

/**
 * Signs in and reads the resulting session back.
 *
 * The rejection is converted to a message with `rejectWithValue` rather than
 * left to throw. createAsyncThunk serialises a thrown error down to
 * `{ name, message, stack }`, which discards the axios response - and with it
 * the body the server explains itself in. Without this, every failed login
 * would report "Request failed with status code 401" instead of "Invalid
 * credentials", and a 429 would look like a server fault rather than a rate
 * limit.
 */
export const signIn = createAsyncThunk<
  { audience: Audience; user: User | null },
  authApi.LoginCredentials & { audience: Audience },
  { rejectValue: string }
>('auth/signIn', async ({ audience, ...credentials }, { rejectWithValue }) => {
  try {
    if (audience === 'admin') await authApi.adminLogin(credentials);
    else await authApi.login(credentials);
  } catch (error) {
    return rejectWithValue(errorMessage(error, 'Could not sign you in.'));
  }

  // The login routes set cookies but do not return the user, so read it back
  // rather than guessing at the shape from the credentials.
  return { audience, user: await authApi.fetchMe(audience) };
});

export const signOut = createAsyncThunk('auth/signOut', async (audience: Audience) => {
  await authApi.logout(audience);
  return audience;
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    /**
     * The refresh path gave up. Dispatched by the axios interceptor, which is
     * why it is a plain reducer rather than a thunk - the interceptor already
     * knows the session is gone and has nothing left to ask the server.
     */
    sessionExpired(state, action: PayloadAction<Audience>) {
      state.sessions[action.payload] = { status: 'anonymous', user: null };
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(bootstrapSession.pending, (state, action) => {
        state.sessions[action.meta.arg].status = 'checking';
      })
      .addCase(bootstrapSession.fulfilled, (state, action) => {
        state.sessions[action.meta.arg] = {
          status: action.payload ? 'authenticated' : 'anonymous',
          user: action.payload
        };
      })
      .addCase(bootstrapSession.rejected, (state, action) => {
        state.sessions[action.meta.arg] = { status: 'anonymous', user: null };
      })
      .addCase(signIn.fulfilled, (state, action) => {
        const { audience, user } = action.payload;
        state.sessions[audience] = {
          status: user ? 'authenticated' : 'anonymous',
          user
        };
      })
      .addCase(signOut.fulfilled, (state, action) => {
        state.sessions[action.payload] = { status: 'anonymous', user: null };
      });
  }
});

export const { sessionExpired } = authSlice.actions;
export default authSlice.reducer;

/* Selectors ------------------------------------------------------------- */

interface RootStateWithAuth {
  auth: AuthState;
}

export const selectSession = (audience: Audience) => (state: RootStateWithAuth): Session =>
  state.auth.sessions[audience];

export const selectUser = (audience: Audience) => (state: RootStateWithAuth): User | null =>
  state.auth.sessions[audience].user;

export const selectIsAuthenticated = (audience: Audience) => (state: RootStateWithAuth): boolean =>
  state.auth.sessions[audience].status === 'authenticated';
