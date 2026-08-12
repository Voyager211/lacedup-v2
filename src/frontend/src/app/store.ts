import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector, useStore } from 'react-redux';
import authReducer from '@/features/auth/authSlice';

/**
 * The store.
 *
 * The root reducer is combined separately so RootState can be derived from it
 * rather than from the store instance. Deriving it from the store while
 * createStore accepts a Partial<RootState> is circular, and TypeScript refuses
 * it outright.
 */
const rootReducer = combineReducers({
  auth: authReducer
});

export type RootState = ReturnType<typeof rootReducer>;

/**
 * Built by a factory so tests can construct an isolated store with a known
 * starting state, rather than sharing the singleton and leaking state between
 * cases.
 */
export const createStore = (preloadedState?: Partial<RootState>) =>
  configureStore({
    reducer: rootReducer,
    preloadedState
  });

export const store = createStore();

export type AppStore = ReturnType<typeof createStore>;
export type AppDispatch = AppStore['dispatch'];

/** Typed hooks. Use these, never the bare react-redux ones. */
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
export const useAppStore = useStore.withTypes<AppStore>();
