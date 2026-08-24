import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import MockAdapter from 'axios-mock-adapter';
import { api } from '@/api/client';
import { createStore } from './store';
import { RequireAuth, RequireGuest } from './guards';

/**
 * The guards decide whether a visitor is signed in, and they have to ask the
 * server to find out - the auth cookies are httpOnly. The case worth guarding
 * against is the guard redirecting *while it is still asking*, which would
 * bounce every signed-in user to the login page on a hard refresh.
 */

const ALICE = { _id: 'u1', name: 'Alice', email: 'a@example.com', role: 'user', isBlocked: false };

const renderAt = (initialEntry: string, element: React.ReactNode, protectedPath = '/cart') => {
  const store = createStore();

  const router = createMemoryRouter(
    [
      {
        element,
        children: [{ path: protectedPath, element: <p>protected content</p> }]
      },
      { path: '/login', element: <p>login page</p> },
      { path: '/admin/login', element: <p>admin login page</p> },
      { path: '/', element: <p>storefront home</p> },
      { path: '/admin/dashboard', element: <p>admin dashboard</p> }
    ],
    { initialEntries: [initialEntry] }
  );

  render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>
  );

  return { store, router };
};

describe('RequireAuth', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(api);
  });

  afterEach(() => {
    mock.restore();
  });

  it('shows a pending state while the session is still unknown', () => {
    // Never resolves, so the guard stays in its checking state.
    mock.onGet('/auth/me').reply(() => new Promise(() => {}));

    renderAt('/cart', <RequireAuth audience="user" />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('login page')).not.toBeInTheDocument();
    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
  });

  it('renders the route once the server confirms a session', async () => {
    mock.onGet('/auth/me').reply(200, { success: true, user: ALICE });

    renderAt('/cart', <RequireAuth audience="user" />);

    expect(await screen.findByText('protected content')).toBeInTheDocument();
  });

  it('redirects to login when there is no session', async () => {
    mock.onGet('/auth/me').reply(401, { success: false });

    renderAt('/cart', <RequireAuth audience="user" />);

    expect(await screen.findByText('login page')).toBeInTheDocument();
  });

  it('remembers where the visitor was headed', async () => {
    mock.onGet('/auth/me').reply(401);

    const { router } = renderAt('/cart', <RequireAuth audience="user" />);

    await screen.findByText('login page');
    expect(router.state.location.state).toMatchObject({
      from: expect.objectContaining({ pathname: '/cart' })
    });
  });

  it('sends an unauthenticated admin to the admin login, not the shopper one', async () => {
    mock.onGet('/admin/auth/me').reply(401);

    renderAt('/admin/orders', <RequireAuth audience="admin" />, '/admin/orders');

    expect(await screen.findByText('admin login page')).toBeInTheDocument();
  });

  it('checks the admin endpoint for the admin audience', async () => {
    mock.onGet('/admin/auth/me').reply(200, { success: true, user: { ...ALICE, role: 'admin' } });

    renderAt('/admin/orders', <RequireAuth audience="admin" />, '/admin/orders');

    await screen.findByText('protected content');
    expect(mock.history.get.map((r) => r.url)).toEqual(['/admin/auth/me']);
  });

  it('does not treat a shopper session as an admin one', async () => {
    // The two audiences are independent - a signed-in shopper hitting an admin
    // route must still be refused.
    mock.onGet('/admin/auth/me').reply(401);
    mock.onGet('/auth/me').reply(200, { success: true, user: ALICE });

    renderAt('/admin/orders', <RequireAuth audience="admin" />, '/admin/orders');

    expect(await screen.findByText('admin login page')).toBeInTheDocument();
  });
});

describe('RequireGuest', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(api);
  });

  afterEach(() => {
    mock.restore();
  });

  it('lets a signed-out visitor reach the login page', async () => {
    mock.onGet('/auth/me').reply(401);

    renderAt('/login-page', <RequireGuest audience="user" />, '/login-page');

    expect(await screen.findByText('protected content')).toBeInTheDocument();
  });

  it('sends a signed-in shopper away from the login page', async () => {
    mock.onGet('/auth/me').reply(200, { success: true, user: ALICE });

    renderAt('/login-page', <RequireGuest audience="user" />, '/login-page');

    expect(await screen.findByText('storefront home')).toBeInTheDocument();
  });

  it('sends a signed-in admin to the dashboard', async () => {
    mock.onGet('/admin/auth/me').reply(200, { success: true, user: { ...ALICE, role: 'admin' } });

    renderAt('/admin/login-page', <RequireGuest audience="admin" />, '/admin/login-page');

    expect(await screen.findByText('admin dashboard')).toBeInTheDocument();
  });
});
