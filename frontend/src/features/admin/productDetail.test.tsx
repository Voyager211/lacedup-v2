import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import MockAdapter from 'axios-mock-adapter';
import { api as client } from '@/api/client';
import { createStore } from '@/app/store';
import AdminProductDetailPage from './AdminProductDetailPage';

/**
 * The admin product detail view.
 *
 * The thing worth pinning here is that the page reports the backend's offer
 * decision rather than making its own. Every price and every "which offer won"
 * label comes from the response; if this page ever starts computing them it
 * will drift from the storefront, which uses the same server-side maths.
 */

const detail = {
  success: true,
  product: {
    _id: 'p1',
    productName: 'Air Max 90',
    slug: 'air-max-90',
    description: 'A classic.',
    regularPrice: 12000,
    productOffer: 10,
    isListed: true,
    sold: 34,
    mainImage: '/uploads/main.jpg',
    subImages: ['/uploads/sub1.jpg'],
    brand: { _id: 'b1', name: 'Nike', brandOffer: 20 },
    category: { _id: 'c1', name: 'Running', categoryOffer: 5 },
    totalStock: 12,
    variants: [
      {
        _id: 'v1',
        size: 'UK 8',
        sku: 'AM90-8',
        stock: 10,
        basePrice: 10000,
        calculatedFinalPrice: 8000,
        appliedOffer: 20,
        offerSource: 'Brand'
      },
      {
        _id: 'v2',
        size: 'UK 9',
        sku: 'AM90-9',
        stock: 0,
        basePrice: 10000,
        calculatedFinalPrice: 10000,
        appliedOffer: 0,
        offerSource: 'None'
      }
    ]
  },
  allImages: ['/uploads/main.jpg', '/uploads/sub1.jpg'],
  activeOffers: [
    { type: 'Brand', name: 'Nike', value: 20, label: '20% off on all Nike products' },
    { type: 'Product', name: 'This Product', value: 10, label: '10% off on this product' }
  ]
};

const renderPage = () => {
  const router = createMemoryRouter(
    [
      { path: '/admin/products/:id', element: <AdminProductDetailPage /> },
      { path: '/admin/products/:id/edit', element: <p>edit form</p> },
      { path: '/admin/products', element: <p>product list</p> }
    ],
    { initialEntries: ['/admin/products/p1'] }
  );

  render(
    <Provider store={createStore()}>
      <RouterProvider router={router} />
    </Provider>
  );

  return router;
};

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(client);
});

afterEach(() => mock.restore());

describe('AdminProductDetailPage', () => {
  it('shows the price the server calculated, not a recomputed one', async () => {
    mock.onGet('/api/admin/products/p1').reply(200, detail);

    renderPage();

    // 10000 less the winning 20% brand offer - and notably NOT the product's
    // own 10%, which loses.
    expect(await screen.findByText('₹8,000')).toBeInTheDocument();
  });

  it('names the offer that won for each variant', async () => {
    mock.onGet('/api/admin/products/p1').reply(200, detail);

    renderPage();

    const row = (await screen.findByText('UK 8')).closest('tr')!;
    expect(within(row).getByText('Brand')).toBeInTheDocument();
    expect(within(row).getByText('20%')).toBeInTheDocument();

    const plain = screen.getByText('UK 9').closest('tr')!;
    expect(within(plain).getByText('None')).toBeInTheDocument();
  });

  it('lists every offer competing for the product', async () => {
    mock.onGet('/api/admin/products/p1').reply(200, detail);

    renderPage();

    expect(await screen.findByText('20% off on all Nike products')).toBeInTheDocument();
    expect(screen.getByText('10% off on this product')).toBeInTheDocument();
  });

  it('says so plainly when no offer applies', async () => {
    mock.onGet('/api/admin/products/p1').reply(200, { ...detail, activeOffers: [] });

    renderPage();

    expect(await screen.findByText(/every variant sells at its base price/i)).toBeInTheDocument();
  });

  it('totals stock across variants', async () => {
    mock.onGet('/api/admin/products/p1').reply(200, detail);

    renderPage();

    expect(await screen.findByText('10 in stock')).toBeInTheDocument();
  });

  it('switches the main image when a thumbnail is picked', async () => {
    mock.onGet('/api/admin/products/p1').reply(200, detail);

    renderPage();

    const main = await screen.findByAltText('Air Max 90');
    expect(main).toHaveAttribute('src', '/uploads/main.jpg');

    await userEvent.click(screen.getByRole('button', { name: 'Image 2' }));

    expect(screen.getByAltText('Air Max 90')).toHaveAttribute('src', '/uploads/sub1.jpg');
  });

  it('sends the admin to the edit form', async () => {
    mock.onGet('/api/admin/products/p1').reply(200, detail);

    const router = renderPage();
    await screen.findByText('Air Max 90');

    await userEvent.click(screen.getByRole('button', { name: /edit/i }));

    expect(router.state.location.pathname).toBe('/admin/products/p1/edit');
  });

  it('offers a retry when the product cannot be loaded', async () => {
    mock.onGet('/api/admin/products/p1').reply(404, { message: 'Product not found' });

    renderPage();

    expect(await screen.findByRole('button', { name: /try again/i })).toBeInTheDocument();
  });
});
