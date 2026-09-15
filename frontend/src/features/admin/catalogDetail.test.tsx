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
import { BrandDetailPage, CategoryDetailPage } from './CatalogDetailPage';

const renderAt = (element: React.ReactNode, entry: string, path: string) => {
  const router = createMemoryRouter(
    [
      { path, element },
      { path: '/admin/products/:id', element: <p>product detail page</p> }
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

const NIKE_IMAGE = 'https://res.cloudinary.com/demo/image/upload/v1/lacedup/brands/nike.webp';

const brand = (overrides: Record<string, unknown> = {}) => ({
  success: true,
  brand: {
    _id: 'b1',
    name: 'Nike',
    description: 'Just do it',
    image: NIKE_IMAGE,
    brandOffer: 20,
    isActive: true,
    ...overrides
  }
});

const productsPage = (overrides: Record<string, unknown> = {}) => ({
  success: true,
  products: [
    {
      _id: 'p1',
      productName: 'Air Max 90',
      mainImage: '/uploads/am90.jpg',
      regularPrice: 12000,
      minPrice: 8000,
      maxPrice: 8800,
      totalStock: 4,
      isListed: true
    },
    {
      _id: 'p2',
      productName: 'Pegasus 41',
      mainImage: '/uploads/pegasus.jpg',
      regularPrice: 9000,
      minPrice: 7200,
      maxPrice: 7200,
      totalStock: 0,
      isListed: false
    }
  ],
  currentPage: 1,
  totalPages: 3,
  totalRecords: 22,
  ...overrides
});

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(client);
});

afterEach(() => mock.restore());

describe('BrandDetailPage', () => {
  it('shows the brand image, its name and its active offer', async () => {
    mock.onGet('/admin/brands/api/b1').reply(200, brand());
    mock.onGet('/admin/brands/api/b1/products').reply(200, productsPage());

    renderAt(<BrandDetailPage />, '/admin/brands/b1', '/admin/brands/:id');

    expect(await screen.findByRole('heading', { level: 1, name: 'Nike' })).toBeInTheDocument();
    expect(screen.getByText('20% off')).toBeInTheDocument();

    // Resized through Cloudinary rather than fetched at full size.
    const image = document.querySelector(`img[src*="nike.webp"]`);
    expect(image?.getAttribute('src')).toContain('w_512');
  });

  it('says None when the brand carries no offer', async () => {
    mock.onGet('/admin/brands/api/b1').reply(200, brand({ brandOffer: 0 }));
    mock.onGet('/admin/brands/api/b1/products').reply(200, productsPage());

    renderAt(<BrandDetailPage />, '/admin/brands/b1', '/admin/brands/:id');

    expect(await screen.findByText('None')).toBeInTheDocument();
    expect(screen.queryByText(/% off/)).not.toBeInTheDocument();
  });

  it("lists the products with the server's prices, as a range where variants differ", async () => {
    mock.onGet('/admin/brands/api/b1').reply(200, brand());
    mock.onGet('/admin/brands/api/b1/products').reply(200, productsPage());

    renderAt(<BrandDetailPage />, '/admin/brands/b1', '/admin/brands/:id');

    const table = await screen.findByRole('table');

    expect(within(table).getByText('Air Max 90')).toBeInTheDocument();
    expect(within(table).getByText('₹8,000 – ₹8,800')).toBeInTheDocument();
    expect(within(table).getByText('₹7,200')).toBeInTheDocument();
    expect(within(table).getByText('Out of stock')).toBeInTheDocument();
    expect(within(table).getByText('Unlisted')).toBeInTheDocument();
    // The count is the brand's total, not the rows on this page.
    expect(screen.getByText('22')).toBeInTheDocument();
  });

  it('asks for the products page named in the URL', async () => {
    mock.onGet('/admin/brands/api/b1').reply(200, brand());
    mock.onGet('/admin/brands/api/b1/products').reply(200, productsPage({ currentPage: 2 }));

    renderAt(<BrandDetailPage />, '/admin/brands/b1?page=2', '/admin/brands/:id');

    await screen.findByText('Air Max 90');

    const request = mock.history.get.find((r) => r.url === '/admin/brands/api/b1/products');
    expect(request?.params).toEqual({ page: 2 });
  });

  it('opens a product from its row', async () => {
    mock.onGet('/admin/brands/api/b1').reply(200, brand());
    mock.onGet('/admin/brands/api/b1/products').reply(200, productsPage());

    const router = renderAt(<BrandDetailPage />, '/admin/brands/b1', '/admin/brands/:id');

    await userEvent.click(await screen.findByText('Air Max 90'));

    await vi.waitFor(() => {
      expect(router.state.location.pathname).toBe('/admin/products/p1');
    });
  });

  it('opens a product with Enter on a focused row, so the table is not mouse-only', async () => {
    mock.onGet('/admin/brands/api/b1').reply(200, brand());
    mock.onGet('/admin/brands/api/b1/products').reply(200, productsPage());

    const router = renderAt(<BrandDetailPage />, '/admin/brands/b1', '/admin/brands/:id');

    const row = (await screen.findByText('Pegasus 41')).closest('tr');
    expect(row).toHaveClass('cursor-pointer');

    row?.focus();
    await userEvent.keyboard('{Enter}');

    await vi.waitFor(() => {
      expect(router.state.location.pathname).toBe('/admin/products/p2');
    });
  });

  it('shows placeholders rather than broken images, and says when there are no products', async () => {
    mock.onGet('/admin/brands/api/b1').reply(200, brand({ image: '' }));
    mock.onGet('/admin/brands/api/b1/products').reply(
      200,
      productsPage({ products: [], totalPages: 0, totalRecords: 0 })
    );

    renderAt(<BrandDetailPage />, '/admin/brands/b1', '/admin/brands/:id');

    expect(await screen.findByText('No products in this brand yet')).toBeInTheDocument();
    expect(document.querySelectorAll('img')).toHaveLength(0);
  });

  it('opens the edit dialog prefilled from the brand', async () => {
    mock.onGet('/admin/brands/api/b1').reply(200, brand());
    mock.onGet('/admin/brands/api/b1/products').reply(200, productsPage());

    renderAt(<BrandDetailPage />, '/admin/brands/b1', '/admin/brands/:id');

    await userEvent.click(await screen.findByRole('button', { name: /edit brand/i }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Name')).toHaveValue('Nike');
    expect(within(dialog).getByLabelText(/offer/i)).toHaveValue(20);
  });
});

describe('CategoryDetailPage', () => {
  it('reads the category and its products from the category endpoints', async () => {
    mock.onGet('/admin/categories/api/c1').reply(200, {
      success: true,
      category: { _id: 'c1', name: 'Running', image: '', categoryOffer: 0, isActive: false }
    });
    mock.onGet('/admin/categories/api/c1/products').reply(200, productsPage());

    renderAt(<CategoryDetailPage />, '/admin/categories/c1', '/admin/categories/:id');

    expect(await screen.findByRole('heading', { level: 1, name: 'Running' })).toBeInTheDocument();
    expect(screen.getByText('None')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
    expect(await screen.findByText('Air Max 90')).toBeInTheDocument();
  });
});
