import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import MockAdapter from 'axios-mock-adapter';
import { api as client } from '@/api/client';
import { createStore } from '@/app/store';
import { ConfirmProvider } from '@/components/confirm/ConfirmProvider';
import { Toaster } from '@/components/toast';
import { bootstrapSession } from '@/features/auth/authSlice';
import CartPage from './CartPage';
import WishlistPage from '@/features/wishlist/WishlistPage';
import type { CartItem } from './cart.api';

const SHOPPER = {
  _id: 'u1',
  name: 'Alice',
  email: 'alice@example.com',
  role: 'user' as const,
  isBlocked: false
};

const cartItem = (overrides: Partial<CartItem> = {}): CartItem =>
  ({
    _id: 'i1',
    productId: {
      _id: 'p1',
      productName: 'Air Max 90',
      slug: 'air-max-90',
      regularPrice: 2000,
      variants: [],
      totalStock: 5,
      mainImage: '/img.jpg'
    },
    variantId: 'v1',
    size: 'UK 8',
    quantity: 2,
    price: 1500,
    totalPrice: 3000,
    ...overrides
  }) as CartItem;

const emptyBuckets = {
  success: true,
  cartItems: [],
  availableCartItems: [],
  outOfStockCartItems: [],
  unavailableCartItems: []
};

const renderPage = (element: React.ReactNode, entry = '/cart', path = '/cart') => {
  const router = createMemoryRouter(
    [
      { path, element },
      { path: '/checkout', element: <p>checkout page</p> },
      { path: '/shop', element: <p>shop page</p> },
      { path: '/login', element: <p>login page</p> },
      { path: '/product/:slug', element: <p>product page</p> }
    ],
    { initialEntries: [entry] }
  );

  const store = createStore();

  /*
   * These pages sit behind RequireAuth, so in the app they only ever render
   * with a session already established. The wishlist card checks for one
   * before acting - without this it would send the test to /login instead.
   */
  store.dispatch(bootstrapSession.fulfilled(SHOPPER, 'test', 'user'));

  render(
    <Provider store={store}>
      <ConfirmProvider>
        <RouterProvider router={router} />
        {/* Mirrors main.tsx - without it, toasts have nowhere to render and
            anything reported only through a toast is invisible to the test. */}
        <Toaster />
      </ConfirmProvider>
    </Provider>
  );

  return router;
};

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(client);
  mock.onGet('/cart/count').reply(200, { count: 0 });
});

afterEach(() => mock.restore());

describe('CartPage', () => {
  it('invites the shopper to browse when the cart is empty', async () => {
    mock.onGet('/cart').reply(200, emptyBuckets);

    renderPage(<CartPage />);

    expect(await screen.findByText(/your cart is empty/i)).toBeInTheDocument();
  });

  it('totals only what can actually be bought', async () => {
    // Out-of-stock and unavailable items cannot be checked out, so counting
    // them would tell the shopper they owe more than they will be charged.
    const available = cartItem();
    const stuck = cartItem({ _id: 'i2', totalPrice: 9999, isOutOfStock: true });

    mock.onGet('/cart').reply(200, {
      ...emptyBuckets,
      cartItems: [available, stuck],
      availableCartItems: [available],
      outOfStockCartItems: [stuck]
    });

    renderPage(<CartPage />);

    expect(await screen.findByText('Items (2)')).toBeInTheDocument();
    expect(screen.getAllByText('₹3,000').length).toBeGreaterThan(0);
    expect(screen.queryByText('₹12,999')).not.toBeInTheDocument();
  });

  it('offers to clear the items blocking checkout', async () => {
    const stuck = cartItem({ isOutOfStock: true });

    mock.onGet('/cart').reply(200, {
      ...emptyBuckets,
      cartItems: [stuck],
      outOfStockCartItems: [stuck]
    });
    mock.onPost('/cart/remove-out-of-stock').reply(200, { success: true, removedCount: 1 });

    renderPage(<CartPage />);

    await userEvent.click(await screen.findByRole('button', { name: /remove them/i }));

    await vi.waitFor(() => {
      expect(mock.history.post.some((r) => r.url === '/cart/remove-out-of-stock')).toBe(true);
    });
  });

  it('cannot check out when nothing is buyable', async () => {
    const stuck = cartItem({ isUnavailable: true, unavailableReason: 'Product unavailable' });

    mock.onGet('/cart').reply(200, {
      ...emptyBuckets,
      cartItems: [stuck],
      unavailableCartItems: [stuck]
    });

    renderPage(<CartPage />);

    expect(await screen.findByRole('button', { name: /nothing to check out/i })).toBeDisabled();
  });

  it('says why an item cannot be bought', async () => {
    const stuck = cartItem({ isUnavailable: true, unavailableReason: 'Category unavailable' });

    mock.onGet('/cart').reply(200, {
      ...emptyBuckets,
      cartItems: [stuck],
      unavailableCartItems: [stuck]
    });

    renderPage(<CartPage />);

    expect(await screen.findByText('Category unavailable')).toBeInTheDocument();
  });

  it('stops at the server-side cap of five per size', async () => {
    // The server refuses more than 5; disabling here avoids a request that
    // can only come back as an error.
    const item = cartItem({ quantity: 5 });

    mock.onGet('/cart').reply(200, {
      ...emptyBuckets,
      cartItems: [item],
      availableCartItems: [item]
    });

    renderPage(<CartPage />);

    expect(await screen.findByRole('button', { name: /increase quantity/i })).toBeDisabled();
  });

  it('cannot decrease below one - removing is a separate action', async () => {
    const item = cartItem({ quantity: 1 });

    mock.onGet('/cart').reply(200, {
      ...emptyBuckets,
      cartItems: [item],
      availableCartItems: [item]
    });

    renderPage(<CartPage />);

    expect(await screen.findByRole('button', { name: /decrease quantity/i })).toBeDisabled();
  });

  it('sends a quantity change with both ids the server needs', async () => {
    const item = cartItem();

    mock.onGet('/cart').reply(200, {
      ...emptyBuckets,
      cartItems: [item],
      availableCartItems: [item]
    });
    mock.onPost('/cart/update').reply(200, { success: true });

    renderPage(<CartPage />);

    await userEvent.click(await screen.findByRole('button', { name: /increase quantity/i }));

    await vi.waitFor(() => {
      const request = mock.history.post.find((r) => r.url === '/cart/update');
      expect(JSON.parse(String(request?.data))).toMatchObject({
        productId: 'p1',
        variantId: 'v1',
        quantity: 3
      });
    });
  });

  it('surfaces a stock refusal in the server own words', async () => {
    const item = cartItem();

    mock.onGet('/cart').reply(200, {
      ...emptyBuckets,
      cartItems: [item],
      availableCartItems: [item]
    });
    mock.onPost('/cart/update').reply(403, {
      success: false,
      message: 'Only 2 items available in stock for size UK 8.',
      code: 'INSUFFICIENT_STOCK'
    });

    renderPage(<CartPage />);

    await userEvent.click(await screen.findByRole('button', { name: /increase quantity/i }));

    expect(await screen.findByText(/only 2 items available/i)).toBeInTheDocument();
  });

  it('asks before emptying the whole cart', async () => {
    const item = cartItem();

    mock.onGet('/cart').reply(200, {
      ...emptyBuckets,
      cartItems: [item],
      availableCartItems: [item]
    });

    renderPage(<CartPage />);

    await userEvent.click(await screen.findByRole('button', { name: /^empty cart$/i }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/everything in it will be removed/i)).toBeInTheDocument();
    // Nothing sent until the shopper confirms.
    expect(mock.history.post.some((r) => r.url === '/cart/clear')).toBe(false);
  });
});

describe('WishlistPage', () => {
  it('invites the shopper to browse when empty', async () => {
    mock.onGet('/wishlist').reply(200, { success: true, products: [], search: '', userWishlistProductIds: [] });

    renderPage(<WishlistPage />, '/wishlist', '/wishlist');

    expect(await screen.findByText(/your wishlist is empty/i)).toBeInTheDocument();
  });

  it('does not offer a search - the list is short and all on one screen', async () => {
    mock.onGet('/wishlist').reply(200, { success: true, products: [], search: '', userWishlistProductIds: [] });

    renderPage(<WishlistPage />, '/wishlist', '/wishlist');

    await screen.findByText(/your wishlist is empty/i);
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    // The endpoint still takes a `q`; the page just never sends one.
    expect(mock.history.get.every((request) => !request.params?.q)).toBe(true);
  });

  it('removes an item and reports it', async () => {
    mock.onGet('/wishlist').reply(200, {
      success: true,
      search: '',
      userWishlistProductIds: ['p1'],
      products: [
        {
          _id: 'p1',
          productName: 'Air Max 90',
          slug: 'air-max-90',
          regularPrice: 2000,
          variants: [],
          totalStock: 5,
          mainImage: '/img.jpg',
          averageFinalPrice: 1500
        }
      ]
    });
    mock.onDelete('/wishlist/remove/p1').reply(200, { success: true, wishlistCount: 0 });

    renderPage(<WishlistPage />, '/wishlist', '/wishlist');

    await userEvent.click(await screen.findByRole('button', { name: /remove air max 90/i }));

    await vi.waitFor(() => {
      expect(mock.history.delete.some((r) => r.url === '/wishlist/remove/p1')).toBe(true);
    });
  });
});
