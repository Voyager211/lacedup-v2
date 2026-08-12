import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { RouterProvider } from 'react-router-dom';

import { store } from './app/store';
import { router } from './app/router';
import { setSessionExpiredHandler } from './api/client';
import { sessionExpired } from './features/auth/authSlice';
import './styles/index.css';

/**
 * Wire the axios interceptor to the store.
 *
 * The client module deliberately knows nothing about Redux or the router - it
 * is imported by tests and MSW handlers, and dragging the store in would make
 * both awkward. This is the one place the two are joined.
 */
setSessionExpiredHandler((audience) => {
  store.dispatch(sessionExpired(audience));
});

const container = document.getElementById('root');

if (!container) {
  throw new Error('Root element #root is missing from index.html');
}

createRoot(container).render(
  <StrictMode>
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>
  </StrictMode>
);
