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
import CheckoutPage from './CheckoutPage';

const ADDRESS = {
  _id: 'a1',
  name: 'Alice Example',
  phone: '9876543210',
  addressType: 'Home',
  landMark: 'Near the park',
  city: 'Kochi',
  district: 'Ernakulam',
  state: 'Kerala',
  pincode: '682001',
  isDefault: false
};

const checkout = (overrides: Record<string, unknown> = {}) => ({
  success: true,
  cartItems: [
    {
      _id: 'i1',
      productId: { _id: 'p1', productName: 'Air Max 90', slug: 'air-max-90', mainImage: '/i.jpg' },
      variantId: 'v1',
      size: 'UK 8',
      quantity: 1,
      price: 1500,
      totalPrice: 1500
    }
  ],
  addresses: [ADDRESS],
  addressDocumentId: 'doc1',
  totalItemCount: 1,
  totalDiscount: 500,
  subtotal: 2000,
  amountAfterDiscount: 1500,
  couponDiscount: 0,
  appliedCoupon: null,
  shipping: 0,
  total: 1500,
  walletBalance: 5000,
  ...overrides
});

const renderPage = () => {
  const router = createMemoryRouter(
    [
      { path: '/checkout', element: <CheckoutPage /> },
      { path: '/checkout/order-success/:orderId', element: <p>order success page</p> },
      { path: '/orders', element: <p>orders page</p> },
      { path: '/shop', element: <p>shop page</p> }
    ],
    { initialEntries: ['/checkout'] }
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
  mock.onGet('/cart/count').reply(200, { count: 1 });
  mock.onGet('/states-districts').reply(200, {});
  mock.onGet('/checkout/validate-checkout-stock').reply(200, { success: true, invalidItems: [] });
});

afterEach(() => mock.restore());

describe('CheckoutPage', () => {
  it('shows the server totals rather than recomputing them', async () => {
    // The server re-prices the cart as it reads it, so anything computed here
    // could disagree with what is actually charged.
    mock.onGet('/checkout').reply(200, checkout());

    renderPage();

    expect(await screen.findByText('₹2,000')).toBeInTheDocument();
    expect(screen.getByText('−₹500')).toBeInTheDocument();
    expect(screen.getAllByText('₹1,500').length).toBeGreaterThan(0);
  });

  it('preselects the default address', async () => {
    mock.onGet('/checkout').reply(200, {
      ...checkout(),
      addresses: [ADDRESS, { ...ADDRESS, _id: 'a2', name: 'Work', isDefault: true }]
    });

    renderPage();

    // The address marked default wins, not simply the first one listed.
    expect(await screen.findByRole('radio', { name: /Work/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Alice Example/ })).not.toBeChecked();
  });

  it('cannot pay without an address', async () => {
    mock.onGet('/checkout').reply(200, { ...checkout(), addresses: [] });

    renderPage();

    expect(await screen.findByText(/no saved addresses/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Pay/ })).toBeDisabled();
  });

  it('refuses a wallet payment when the balance is short, and says by how much', async () => {
    mock.onGet('/checkout').reply(200, checkout({ walletBalance: 200 }));

    renderPage();

    await userEvent.click(await screen.findByRole('radio', { name: /wallet/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/wallet balance is ₹200/i);
    expect(screen.getByRole('button', { name: /^Pay/ })).toBeDisabled();
  });

  it('rechecks stock before taking any money', async () => {
    // A shopper must learn a size sold out before a payment sheet opens, not
    // after being charged.
    mock.onGet('/checkout').reply(200, checkout());
    mock.onGet('/checkout/validate-checkout-stock').reply(200, {
      success: false,
      message: 'Air Max 90 (UK 8) is out of stock',
      invalidItems: [{ productName: 'Air Max 90' }]
    });
    mock.onPost('/checkout/place-order').reply(200, { success: true });

    renderPage();

    await userEvent.click(await screen.findByRole('radio', { name: /cash on delivery/i }));
    await userEvent.click(screen.getByRole('button', { name: /place order/i }));

    expect(await screen.findByText(/out of stock/i)).toBeInTheDocument();
    // Nothing was ordered.
    expect(mock.history.post.some((r) => r.url === '/checkout/place-order')).toBe(false);
  });

  it('places a COD order with the address document id and index', async () => {
    mock.onGet('/checkout').reply(200, checkout());
    mock.onPost('/checkout/place-order').reply(200, {
      success: true,
      data: { orderNumber: 'ORD000123' }
    });

    renderPage();

    await userEvent.click(await screen.findByRole('radio', { name: /cash on delivery/i }));
    await userEvent.click(screen.getByRole('button', { name: /place order/i }));

    await vi.waitFor(() => {
      const request = mock.history.post.find((r) => r.url === '/checkout/place-order');
      expect(JSON.parse(String(request?.data))).toMatchObject({
        deliveryAddressId: 'doc1',
        addressIndex: 0,
        paymentMethod: 'cod'
      });
    });
  });

  it('uses the wallet endpoint for a wallet payment, not place-order', async () => {
    mock.onGet('/checkout').reply(200, checkout());
    mock.onPost('/checkout/process-wallet-payment').reply(200, {
      success: true,
      data: { orderNumber: 'ORD000124' }
    });

    renderPage();

    await userEvent.click(await screen.findByRole('radio', { name: /wallet/i }));
    await userEvent.click(screen.getByRole('button', { name: /^Pay/ }));

    await vi.waitFor(() => {
      expect(mock.history.post.some((r) => r.url === '/checkout/process-wallet-payment')).toBe(true);
    });
    expect(mock.history.post.some((r) => r.url === '/checkout/place-order')).toBe(false);
  });

  it('applies a coupon in upper case', async () => {
    mock.onGet('/checkout').reply(200, checkout());
    mock.onPost('/checkout/apply-coupon').reply(200, { success: true });

    renderPage();

    await userEvent.type(await screen.findByLabelText(/coupon code/i), 'save10');
    await userEvent.click(screen.getByRole('button', { name: /apply/i }));

    await vi.waitFor(() => {
      const request = mock.history.post.find((r) => r.url === '/checkout/apply-coupon');
      expect(JSON.parse(String(request?.data))).toEqual({ couponCode: 'SAVE10' });
    });
  });

  it('reports a rejected coupon in the server own words', async () => {
    mock.onGet('/checkout').reply(200, checkout());
    mock.onPost('/checkout/apply-coupon').reply(400, {
      success: false,
      message: 'This coupon needs a minimum order of ₹3,000'
    });

    renderPage();

    await userEvent.type(await screen.findByLabelText(/coupon code/i), 'SAVE10');
    await userEvent.click(screen.getByRole('button', { name: /apply/i }));

    expect(await screen.findByText(/minimum order of/i)).toBeInTheDocument();
  });

  it('shows an applied coupon with a way to remove it', async () => {
    mock.onGet('/checkout').reply(200, checkout({
      appliedCoupon: { code: 'SAVE10', _id: 'c1' },
      couponDiscount: 150
    }));

    renderPage();

    expect(await screen.findByText('SAVE10 applied')).toBeInTheDocument();
    expect(screen.getByText('−₹150')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument();
  });

  it('sends an empty cart to the shop rather than an empty checkout', async () => {
    mock.onGet('/checkout').reply(200, checkout({ cartItems: [], totalItemCount: 0, total: 0 }));

    renderPage();

    expect(await screen.findByText(/your cart is empty/i)).toBeInTheDocument();
  });

  it('does not offer PayPal', async () => {
    // Its client id was always empty, so the button could never work. Dropped
    // rather than ported half-wired.
    mock.onGet('/checkout').reply(200, checkout());

    renderPage();

    await screen.findByText('₹2,000');
    expect(screen.queryByText(/paypal/i)).not.toBeInTheDocument();
  });
});
