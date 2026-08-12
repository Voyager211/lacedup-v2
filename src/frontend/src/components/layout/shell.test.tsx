import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import MockAdapter from 'axios-mock-adapter';
import { api as client } from '@/api/client';
import { createStore } from '@/app/store';
import StorefrontLayout from './StorefrontLayout';
import AdminLayout from './AdminLayout';
import Footer from './Footer';

const ALICE = { _id: 'u1', name: 'Alice', email: 'alice@example.com', role: 'user', isBlocked: false };
const ADMIN = { _id: 'a1', name: 'Root Admin', email: 'admin@example.com', role: 'admin', isBlocked: false };

const renderShell = (element: React.ReactNode, initialEntry: string, childPath: string) => {
  const router = createMemoryRouter(
    [{ element, children: [{ path: childPath, element: <p>page body</p> }] }],
    { initialEntries: [initialEntry] }
  );

  render(
    <Provider store={createStore()}>
      <RouterProvider router={router} />
    </Provider>
  );
};

describe('StorefrontLayout', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(client);
    mock.onGet('/cart/count').reply(200, { count: 3 });
  });

  afterEach(() => mock.restore());

  it('offers sign in and sign up to a visitor', async () => {
    mock.onGet('/auth/me').reply(401);

    renderShell(<StorefrontLayout />, '/', '/');

    expect(await screen.findByRole('link', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign up' })).toBeInTheDocument();
  });

  it('swaps to the account menu once signed in', async () => {
    mock.onGet('/auth/me').reply(200, { success: true, user: ALICE });

    renderShell(<StorefrontLayout />, '/', '/');

    expect(await screen.findByRole('button', { name: /account menu for alice/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument();
  });

  it('shows the cart count for a signed-in shopper', async () => {
    mock.onGet('/auth/me').reply(200, { success: true, user: ALICE });

    renderShell(<StorefrontLayout />, '/', '/');

    expect(await screen.findByRole('link', { name: 'Cart, 3 items' })).toBeInTheDocument();
  });

  it('does not ask for a cart count while signed out', async () => {
    mock.onGet('/auth/me').reply(401);

    renderShell(<StorefrontLayout />, '/', '/');
    await screen.findByRole('link', { name: 'Sign in' });

    expect(mock.history.get.filter((r) => r.url === '/cart/count')).toHaveLength(0);
  });

  it('highlights About, which never highlighted in the EJS navbar', async () => {
    mock.onGet('/auth/me').reply(401);

    renderShell(<StorefrontLayout />, '/about', '/about');

    const nav = await screen.findByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'About' })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  it('does not mark Home active on another route', async () => {
    mock.onGet('/auth/me').reply(401);

    renderShell(<StorefrontLayout />, '/shop', '/shop');

    const nav = await screen.findByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
  });

  it('opens the account menu with the shopper details', async () => {
    mock.onGet('/auth/me').reply(200, { success: true, user: ALICE });

    renderShell(<StorefrontLayout />, '/', '/');

    await userEvent.click(await screen.findByRole('button', { name: /account menu/i }));

    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Orders' })).toHaveAttribute('href', '/orders');
  });

  it('renders the routed page inside the shell', async () => {
    mock.onGet('/auth/me').reply(401);

    renderShell(<StorefrontLayout />, '/', '/');

    expect(await screen.findByText('page body')).toBeInTheDocument();
  });
});

describe('Footer', () => {
  const renderFooter = () => {
    const router = createMemoryRouter([{ path: '/', element: <Footer /> }], {
      initialEntries: ['/']
    });
    render(<RouterProvider router={router} />);
  };

  it('has no links to routes that are not mounted', () => {
    // 11 of the 15 links in the EJS footer 404'd.
    renderFooter();

    const dead = ['/categories', '/contact', '/faq', '/returns', '/terms', '/privacy', '/cookies'];
    const hrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href'));

    for (const href of hrefs) {
      expect(dead).not.toContain(href?.split('?')[0]);
    }
  });

  it('has no placeholder anchors', () => {
    renderFooter();

    for (const link of screen.getAllByRole('link')) {
      expect(link.getAttribute('href')).not.toBe('#');
    }
  });

  it('sends customer-service links to the page that actually answers them', () => {
    renderFooter();

    expect(screen.getByRole('link', { name: 'FAQs' })).toHaveAttribute('href', '/help');
    expect(screen.getByRole('link', { name: 'Contact us' })).toHaveAttribute('href', '/help');
  });
});

describe('AdminLayout', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(client);
  });

  afterEach(() => mock.restore());

  it('shows all nine sections with the current one marked', async () => {
    mock.onGet('/admin/auth/me').reply(200, { success: true, user: ADMIN });

    renderShell(<AdminLayout />, '/admin/orders', '/admin/orders');

    const nav = await screen.findByRole('navigation', { name: 'Admin sections' });
    expect(within(nav).getAllByRole('link')).toHaveLength(9);
    expect(within(nav).getByRole('link', { name: 'Orders' })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  it('names the signed-in admin, which the EJS header never did', async () => {
    mock.onGet('/admin/auth/me').reply(200, { success: true, user: ADMIN });

    renderShell(<AdminLayout />, '/admin/dashboard', '/admin/dashboard');

    expect(await screen.findByRole('button', { name: /root admin/i })).toBeInTheDocument();
  });

  it('renders breadcrumbs derived from the route', async () => {
    mock.onGet('/admin/auth/me').reply(200, { success: true, user: ADMIN });

    renderShell(<AdminLayout />, '/admin/orders/abc123', '/admin/orders/:orderId');

    const breadcrumb = await screen.findByRole('navigation', { name: 'Breadcrumb' });
    expect(within(breadcrumb).getByText('Details')).toHaveAttribute('aria-current', 'page');
    expect(within(breadcrumb).getByRole('link', { name: 'Orders' })).toBeInTheDocument();
  });

  it('drops the notification bell that opened an empty dropdown', async () => {
    mock.onGet('/admin/auth/me').reply(200, { success: true, user: ADMIN });

    renderShell(<AdminLayout />, '/admin/dashboard', '/admin/dashboard');
    await screen.findByRole('navigation', { name: 'Admin sections' });

    expect(screen.queryByRole('button', { name: /notification/i })).not.toBeInTheDocument();
  });

  it('renders the login page without the shell around it', async () => {
    mock.onGet('/admin/auth/me').reply(401);

    renderShell(<AdminLayout />, '/admin/login', '/admin/login');

    expect(await screen.findByText('page body')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Admin sections' })).not.toBeInTheDocument();
  });
});
