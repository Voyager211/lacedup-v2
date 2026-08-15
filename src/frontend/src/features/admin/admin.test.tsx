import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import MockAdapter from 'axios-mock-adapter';
import { api as client } from '@/api/client';
import { createStore } from '@/app/store';
import { ConfirmProvider } from '@/components/confirm/ConfirmProvider';
import { Toaster } from '@/components/toast';
import AdminLoginPage from './AdminLoginPage';
import CouponsPage from './CouponsPage';
import ProductsPage from './ProductsPage';
import { CategoriesPage } from './CategoriesPage';
import ProductFormPage from './ProductFormPage';
import { RESOURCE_PATHS } from './admin.api';

const renderAt = (element: React.ReactNode, entry = '/admin/x', path = '/admin/x') => {
  const router = createMemoryRouter(
    [
      { path, element },
      { path: '/admin/dashboard', element: <p>admin dashboard</p> },
      { path: '/admin/products/add', element: <p>add product page</p> },
      { path: '/admin/products/:id', element: <p>product detail page</p> },
      { path: '/admin/products/:id/edit', element: <p>edit product page</p> }
    ],
    { initialEntries: [entry] }
  );

  render(
    <Provider store={createStore()}>
      <ConfirmProvider>
        <RouterProvider router={router} />
        <Toaster />
      </ConfirmProvider>
    </Provider>
  );

  return router;
};

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(client);
});

afterEach(() => mock.restore());

describe('RESOURCE_PATHS', () => {
  it('keeps the two endpoints that deviate from the shared shape', () => {
    // Coupons put create/read/update outside the /api segment, and products
    // soft-delete with PATCH rather than DELETE. Both are easy to normalise
    // away by accident, and both would 404 or 405 silently if they were.
    expect(RESOURCE_PATHS.coupons.create).toBe('/admin/coupons/create');
    expect(RESOURCE_PATHS.coupons.one('abc')).toBe('/admin/coupons/abc');
    expect(RESOURCE_PATHS.coupons.update('abc')).toBe('/admin/coupons/abc');

    expect(RESOURCE_PATHS.products.removeMethod).toBe('PATCH');
    expect(RESOURCE_PATHS.products.remove('abc')).toBe('/admin/products/api/abc/delete');
    expect(RESOURCE_PATHS.products.create).toBe('/admin/products/api/add');
  });

  it('keeps categories and brands on the standard shape', () => {
    for (const resource of ['categories', 'brands'] as const) {
      expect(RESOURCE_PATHS[resource].list).toBe(`/admin/${resource}/api`);
      expect(RESOURCE_PATHS[resource].create).toBe(`/admin/${resource}/api/create`);
      expect(RESOURCE_PATHS[resource].toggle('x')).toBe(`/admin/${resource}/api/x/toggle`);
      expect(RESOURCE_PATHS[resource].removeMethod).toBe('DELETE');
    }
  });
});

describe('AdminLoginPage', () => {
  it('signs in against the admin audience, not the shopper one', async () => {
    mock.onPost('/admin/login').reply(200, { success: true });
    mock.onGet('/admin/auth/me').reply(200, {
      success: true,
      user: { _id: 'a1', name: 'Root', email: 'admin@example.com', role: 'admin', isBlocked: false }
    });

    renderAt(<AdminLoginPage />, '/admin/login', '/admin/login');

    await userEvent.type(screen.getByLabelText('Email'), 'admin@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'correcthorse1');
    await userEvent.click(screen.getByRole('button', { name: 'Log In' }));

    expect(await screen.findByText('admin dashboard')).toBeInTheDocument();
    // The shopper endpoints must not be touched.
    expect(mock.history.post.some((r) => r.url === '/login')).toBe(false);
    expect(mock.history.get.some((r) => r.url === '/auth/me')).toBe(false);
  });

  it('shows the server message when the account is not an admin', async () => {
    mock.onPost('/admin/login').reply(401, { error: 'Not authorized as admin' });

    renderAt(<AdminLoginPage />, '/admin/login', '/admin/login');

    await userEvent.type(screen.getByLabelText('Email'), 'shopper@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'correcthorse1');
    await userEvent.click(screen.getByRole('button', { name: 'Log In' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Not authorized as admin');
  });
});

describe('ResourceListPage (via CategoriesPage)', () => {
  const list = (overrides: Record<string, unknown> = {}) => ({
    categories: [
      { _id: 'c1', name: 'Running', description: 'Road shoes', categoryOffer: 10, isActive: true }
    ],
    currentPage: 1,
    totalPages: 2,
    totalRecords: 14,
    ...overrides
  });

  it('normalises the list whatever key the array arrives under', async () => {
    mock.onGet('/admin/categories/api').reply(200, list());

    renderAt(<CategoriesPage />, '/admin/categories', '/admin/categories');

    expect(await screen.findByText('Running')).toBeInTheDocument();
    expect(screen.getByText('14 total')).toBeInTheDocument();
    expect(screen.getByText('10%')).toBeInTheDocument();
  });

  it('reads its filters from the URL', async () => {
    mock.onGet('/admin/categories/api').reply(200, list());

    renderAt(
      <CategoriesPage />,
      '/admin/categories?q=run&status=active&page=2',
      '/admin/categories'
    );

    await screen.findByText('Running');

    const request = mock.history.get.find((r) => r.url === '/admin/categories/api');
    expect(request?.params).toMatchObject({ q: 'run', status: 'active', page: 2 });
  });

  it('omits empty filters from the request', async () => {
    mock.onGet('/admin/categories/api').reply(200, list());

    renderAt(<CategoriesPage />, '/admin/categories', '/admin/categories');
    await screen.findByText('Running');

    const request = mock.history.get.find((r) => r.url === '/admin/categories/api');
    expect(request?.params).not.toHaveProperty('q');
    expect(request?.params).not.toHaveProperty('status');
  });

  it('toggles a record against the toggle endpoint', async () => {
    mock.onGet('/admin/categories/api').reply(200, list());
    mock.onPatch('/admin/categories/api/c1/toggle').reply(200, { success: true });

    renderAt(<CategoriesPage />, '/admin/categories', '/admin/categories');

    await userEvent.click(await screen.findByRole('button', { name: /deactivate/i }));

    await vi.waitFor(() => {
      expect(mock.history.patch.some((r) => r.url === '/admin/categories/api/c1/toggle')).toBe(true);
    });
  });

  it('offers Activate on an inactive record', async () => {
    mock.onGet('/admin/categories/api').reply(200, {
      ...list(),
      categories: [{ _id: 'c1', name: 'Running', isActive: false }]
    });

    renderAt(<CategoriesPage />, '/admin/categories', '/admin/categories');

    expect(await screen.findByRole('button', { name: /activate/i })).toBeInTheDocument();
    // Scoped to the table: the status filter also has an "Inactive" option.
    expect(within(screen.getByRole('table')).getByText('Inactive')).toBeInTheDocument();
  });

  it('asks before deleting', async () => {
    mock.onGet('/admin/categories/api').reply(200, list());

    renderAt(<CategoriesPage />, '/admin/categories', '/admin/categories');

    await userEvent.click(await screen.findByRole('button', { name: /delete category/i }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(mock.history.delete).toHaveLength(0);
  });

  it('distinguishes "nothing yet" from "nothing matched"', async () => {
    mock.onGet('/admin/categories/api').reply(200, { ...list(), categories: [], totalRecords: 0 });

    const { unmount } = render(<div />);
    unmount();

    renderAt(<CategoriesPage />, '/admin/categories?q=zzz', '/admin/categories');

    expect(await screen.findByText(/nothing matched/i)).toBeInTheDocument();
  });

  it('opens a prefilled dialog when editing', async () => {
    mock.onGet('/admin/categories/api').reply(200, list());

    renderAt(<CategoriesPage />, '/admin/categories', '/admin/categories');

    await userEvent.click(await screen.findByRole('button', { name: /edit category/i }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Name')).toHaveValue('Running');
    expect(within(dialog).getByLabelText(/offer/i)).toHaveValue(10);
  });

  it('creates through the create endpoint, not the update one', async () => {
    mock.onGet('/admin/categories/api').reply(200, list());
    mock.onPost('/admin/categories/api/create').reply(200, { success: true });

    renderAt(<CategoriesPage />, '/admin/categories', '/admin/categories');

    await userEvent.click(await screen.findByRole('button', { name: /add category/i }));

    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Trail');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create' }));

    await vi.waitFor(() => {
      expect(mock.history.post.some((r) => r.url === '/admin/categories/api/create')).toBe(true);
    });
    expect(mock.history.put).toHaveLength(0);
  });

  it('surfaces a rejected save in the server own words', async () => {
    mock.onGet('/admin/categories/api').reply(200, list());
    mock.onPost('/admin/categories/api/create').reply(400, {
      success: false,
      message: 'A category with that name already exists'
    });

    renderAt(<CategoriesPage />, '/admin/categories', '/admin/categories');

    await userEvent.click(await screen.findByRole('button', { name: /add category/i }));

    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Running');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create' }));

    expect(await screen.findByText(/already exists/i)).toBeInTheDocument();
  });
});

describe('CouponsPage', () => {
  /**
   * The envelope the coupons endpoint really uses.
   *
   * Unlike categories, brands and products - which return their rows at the top
   * level - coupons wraps everything one level deeper. These fixtures are
   * copied from admin-coupon.controller, not invented: the previous ones put
   * `coupons` at the top level, so the suite passed while the page rendered an
   * empty table against the real server.
   *
   * The server side of the same contract is pinned in
   * backend/__tests__/admin-list-contract.test.ts.
   */
  const envelope = (coupons: unknown[], pagination = {}, totalCount = coupons.length) => ({
    success: true,
    message: 'Coupons fetched successfully',
    data: {
      coupons,
      count: coupons.length,
      totalCount,
      pagination: { currentPage: 1, totalPages: 1, hasPrevPage: false, hasNextPage: false, ...pagination }
    }
  });

  it('formats a percentage and a fixed discount differently', async () => {
    mock.onGet('/admin/coupons/api').reply(
      200,
      envelope([
        {
          _id: 'k1',
          code: 'SAVE10',
          name: 'Ten off',
          discountType: 'percentage',
          discountValue: 10,
          validTo: '2026-12-31T00:00:00Z',
          isActive: true
        },
        {
          _id: 'k2',
          code: 'FLAT500',
          name: 'Five hundred off',
          discountType: 'fixed',
          discountValue: 500,
          validTo: '2026-12-31T00:00:00Z',
          isActive: true
        }
      ])
    );

    renderAt(<CouponsPage />, '/admin/coupons', '/admin/coupons');

    expect(await screen.findByText('10%')).toBeInTheDocument();
    expect(screen.getByText('₹500')).toBeInTheDocument();
  });

  it('finds the rows even though they are nested under data', async () => {
    // The regression: the normaliser read only the top level, found `data` -
    // an object, not an array - and the page rendered nothing.
    mock
      .onGet('/admin/coupons/api')
      .reply(200, envelope([{ _id: 'k1', code: 'SAVE10', name: 'Ten off', isActive: true }]));

    renderAt(<CouponsPage />, '/admin/coupons', '/admin/coupons');

    expect(await screen.findByText('SAVE10')).toBeInTheDocument();
  });

  it('reads the total out of data.totalCount, not totalRecords', async () => {
    mock
      .onGet('/admin/coupons/api')
      .reply(
        200,
        envelope([{ _id: 'k1', code: 'SAVE10', name: 'Ten off', isActive: true }], { totalPages: 3 }, 25)
      );

    renderAt(<CouponsPage />, '/admin/coupons', '/admin/coupons');

    expect(await screen.findByText('25 total')).toBeInTheDocument();
  });
});

describe('ProductsPage', () => {
  const products = {
    products: [
      {
        _id: 'p1',
        productName: 'Air Max 90',
        mainImage: '/i.jpg',
        brand: { name: 'Nike' },
        regularPrice: 2000,
        totalStock: 0,
        isListed: true
      }
    ],
    currentPage: 1,
    totalPages: 1,
    totalRecords: 1
  };

  it('flags a product with no stock', async () => {
    mock.onGet('/admin/products/api').reply(200, products);

    renderAt(<ProductsPage />, '/admin/products', '/admin/products');

    expect(await screen.findByText('Out of stock')).toBeInTheDocument();
  });

  it('sends create and edit to their own pages, not a dialog', async () => {
    mock.onGet('/admin/products/api').reply(200, products);

    const router = renderAt(<ProductsPage />, '/admin/products', '/admin/products');

    await userEvent.click(await screen.findByRole('button', { name: /add product/i }));

    await vi.waitFor(() => {
      expect(router.state.location.pathname).toBe('/admin/products/add');
    });
  });
});

describe('ProductFormPage', () => {
  const filters = {
    success: true,
    categories: [{ _id: 'c1', name: 'Running' }],
    brands: [{ _id: 'b1', name: 'Nike' }],
    sizes: []
  };

  const fill = async () => {
    await userEvent.type(screen.getByLabelText('Product name'), 'Air Max 90');
    await userEvent.selectOptions(screen.getByLabelText('Category'), 'c1');
    await userEvent.selectOptions(screen.getByLabelText('Brand'), 'b1');
    await userEvent.type(screen.getByLabelText('Regular price'), '2000');
    await userEvent.type(screen.getByLabelText('Size'), 'UK 8');
  };

  beforeEach(() => {
    mock.onGet('/catalog/filters').reply(200, filters);
  });

  it('refuses a base price at or above the regular price', async () => {
    // The regular price is what gets struck through, so a variant priced at or
    // above it would show a "discount" that costs more.
    renderAt(<ProductFormPage />, '/admin/products/add', '/admin/products/add');

    await fill();
    await userEvent.type(screen.getByLabelText('Base price'), '2500');
    await userEvent.click(screen.getByRole('button', { name: 'Add product' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /base price ₹2,500 must be below the regular price ₹2,000/i
    );
    expect(mock.history.post).toHaveLength(0);
  });

  it('refuses fewer than three images', async () => {
    renderAt(<ProductFormPage />, '/admin/products/add', '/admin/products/add');

    await fill();
    await userEvent.type(screen.getByLabelText('Base price'), '1800');
    await userEvent.click(screen.getByRole('button', { name: 'Add product' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/at least 3 images/i);
    expect(mock.history.post).toHaveLength(0);
  });

  it('says which field is missing rather than failing silently', async () => {
    renderAt(<ProductFormPage />, '/admin/products/add', '/admin/products/add');

    await userEvent.click(screen.getByRole('button', { name: 'Add product' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/give the product a name/i);
  });
});
