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
import OrdersPage from './OrdersPage';
import OrderDetailsPage from './OrderDetailsPage';

const CANCELLATION_REASONS = ['Ordered by mistake', 'Changed my mind'];
const RETURN_REASONS = ['Size too small', 'Item damaged or defective'];

const order = (overrides: Record<string, unknown> = {}) => ({
  _id: 'o1',
  orderId: 'ORD000123',
  status: 'Pending',
  paymentStatus: 'Pending',
  paymentMethod: 'cod',
  subtotal: 2000,
  totalDiscount: 500,
  shipping: 0,
  finalAmount: 1500,
  createdAt: '2026-03-09T10:30:00Z',
  items: [
    {
      _id: 'item1',
      productId: { _id: 'p1', productName: 'Air Max 90', slug: 'air-max-90', mainImage: '/i.jpg' },
      size: 'UK 8',
      quantity: 1,
      price: 1500,
      totalPrice: 1500,
      status: 'Pending'
    }
  ],
  ...overrides
});

const renderAt = (element: React.ReactNode, entry: string, path: string) => {
  const router = createMemoryRouter(
    [
      { path, element },
      { path: '/orders', element: <p>orders page</p> },
      { path: '/shop', element: <p>shop page</p> },
      { path: '/product/:slug', element: <p>product page</p> }
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
  mock.onGet('/cart/count').reply(200, { count: 0 });
});

afterEach(() => mock.restore());

describe('OrdersPage', () => {
  const listResponse = {
    success: true,
    orders: [order()],
    currentPage: 1,
    totalPages: 2,
    totalOrders: 12,
    hasPrevPage: false,
    hasNextPage: true,
    cancellationReasons: CANCELLATION_REASONS,
    returnReasons: RETURN_REASONS
  };

  it('loads the first page from /orders, which carries the reason lists', async () => {
    mock.onGet('/orders').reply(200, listResponse);

    renderAt(<OrdersPage />, '/orders-list', '/orders-list');

    expect(await screen.findByText('ORD000123')).toBeInTheDocument();
    expect(mock.history.get.some((r) => r.url === '/orders')).toBe(true);
    expect(mock.history.get.some((r) => r.url === '/orders/filtered')).toBe(false);
  });

  it('switches to the filtered endpoint once a filter is applied', async () => {
    // The unfiltered first page carries the enums; every other view uses the
    // lighter endpoint.
    mock.onGet('/orders/filtered').reply(200, { data: { ...listResponse, orders: [order()] } });

    renderAt(<OrdersPage />, '/orders-list?status=Delivered', '/orders-list');

    await screen.findByText('ORD000123');

    const request = mock.history.get.find((r) => r.url === '/orders/filtered');
    expect(request?.params).toMatchObject({ status: 'Delivered' });
  });

  it('reads paging from the URL, so a page can be linked', async () => {
    mock.onGet('/orders/filtered').reply(200, { data: { ...listResponse, currentPage: 2 } });

    renderAt(<OrdersPage />, '/orders-list?page=2', '/orders-list');

    await screen.findByText('ORD000123');

    const request = mock.history.get.find((r) => r.url === '/orders/filtered');
    expect(request?.params).toMatchObject({ page: 2 });
  });

  it('offers a way to shop when there are no orders at all', async () => {
    mock.onGet('/orders').reply(200, { ...listResponse, orders: [], totalOrders: 0, totalPages: 0 });

    renderAt(<OrdersPage />, '/orders-list', '/orders-list');

    expect(await screen.findByText(/no orders yet/i)).toBeInTheDocument();
  });

  it('distinguishes "no orders" from "nothing matched"', async () => {
    mock.onGet('/orders/filtered').reply(200, {
      data: { ...listResponse, orders: [], totalOrders: 0, totalPages: 0 }
    });

    renderAt(<OrdersPage />, '/orders-list?status=Delivered', '/orders-list');

    expect(await screen.findByText(/no orders match that/i)).toBeInTheDocument();
  });

  it('shows the order status as a badge', async () => {
    mock.onGet('/orders').reply(200, listResponse);

    renderAt(<OrdersPage />, '/orders-list', '/orders-list');

    expect(await screen.findByText('Pending')).toBeInTheDocument();
  });
});

describe('OrderDetailsPage', () => {
  const detailsResponse = (overrides: Record<string, unknown> = {}) => ({
    success: true,
    order: order(overrides),
    cancellationReasons: CANCELLATION_REASONS,
    returnReasons: RETURN_REASONS
  });

  it('offers cancel on a pending order, but not return', async () => {
    // The server only allows cancellation while Pending or Processing, and
    // return only once Delivered. Offering a button the server will refuse is
    // worse than not offering it.
    mock.onGet('/orders/ORD000123').reply(200, detailsResponse());

    renderAt(<OrderDetailsPage />, '/orders/ORD000123', '/orders/:orderId');

    expect(await screen.findByRole('button', { name: /cancel order/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /return order/i })).not.toBeInTheDocument();
  });

  it('offers return on a delivered order, but not cancel', async () => {
    mock.onGet('/orders/ORD000123').reply(200, detailsResponse({ status: 'Delivered' }));

    renderAt(<OrderDetailsPage />, '/orders/ORD000123', '/orders/:orderId');

    expect(await screen.findByRole('button', { name: /return order/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cancel order/i })).not.toBeInTheDocument();
  });

  it('offers neither on a cancelled order', async () => {
    mock.onGet('/orders/ORD000123').reply(200, detailsResponse({ status: 'Cancelled' }));

    renderAt(<OrderDetailsPage />, '/orders/ORD000123', '/orders/:orderId');

    await screen.findByText('Order ORD000123');
    expect(screen.queryByRole('button', { name: /cancel order/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /return order/i })).not.toBeInTheDocument();
  });

  it('asks for a reason before cancelling, using the server list', async () => {
    mock.onGet('/orders/ORD000123').reply(200, detailsResponse());
    mock.onPatch('/orders/ORD000123').reply(200, { success: true, message: 'Order cancelled' });

    renderAt(<OrderDetailsPage />, '/orders/ORD000123', '/orders/:orderId');

    await userEvent.click(await screen.findByRole('button', { name: /cancel order/i }));

    const dialog = await screen.findByRole('dialog');
    const select = within(dialog).getByRole('combobox');

    // Exactly the reasons the server sent - not a hardcoded client copy.
    for (const reason of CANCELLATION_REASONS) {
      expect(within(select).getByRole('option', { name: reason })).toBeInTheDocument();
    }

    await userEvent.selectOptions(select, 'Ordered by mistake');
    await userEvent.click(within(dialog).getByRole('button', { name: /cancel order/i }));

    await vi.waitFor(() => {
      const request = mock.history.patch.find((r) => r.url === '/orders/ORD000123');
      expect(JSON.parse(String(request?.data))).toEqual({ reason: 'Ordered by mistake' });
    });
  });

  it('sends nothing when the reason prompt is dismissed', async () => {
    mock.onGet('/orders/ORD000123').reply(200, detailsResponse());

    renderAt(<OrderDetailsPage />, '/orders/ORD000123', '/orders/:orderId');

    await userEvent.click(await screen.findByRole('button', { name: /cancel order/i }));

    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /keep it/i }));

    expect(mock.history.patch).toHaveLength(0);
  });

  it('cancels a single item against the item endpoint', async () => {
    mock.onGet('/orders/ORD000123').reply(200, detailsResponse());
    mock.onPatch('/orders/ORD000123/items/item1').reply(200, { success: true });

    renderAt(<OrderDetailsPage />, '/orders/ORD000123', '/orders/:orderId');

    await userEvent.click(await screen.findByRole('button', { name: /cancel this item/i }));

    const dialog = await screen.findByRole('dialog');
    await userEvent.selectOptions(within(dialog).getByRole('combobox'), 'Changed my mind');
    await userEvent.click(within(dialog).getByRole('button', { name: /cancel item/i }));

    await vi.waitFor(() => {
      expect(mock.history.patch.some((r) => r.url === '/orders/ORD000123/items/item1')).toBe(true);
    });
  });

  it('offers no actions on an item that is already settled', async () => {
    mock.onGet('/orders/ORD000123').reply(
      200,
      detailsResponse({
        items: [{ ...order().items[0], status: 'Cancelled' }]
      })
    );

    renderAt(<OrderDetailsPage />, '/orders/ORD000123', '/orders/:orderId');

    await screen.findByText('Order ORD000123');
    expect(screen.queryByRole('button', { name: /cancel this item/i })).not.toBeInTheDocument();
  });

  it('explains a partially delivered order instead of leaving it unexplained', async () => {
    // The server refuses order-level transitions on partial states, which in
    // the admin UI shows as an empty dropdown with no reason given.
    mock.onGet('/orders/ORD000123').reply(
      200,
      detailsResponse({ status: 'Partially Delivered' })
    );

    renderAt(<OrderDetailsPage />, '/orders/ORD000123', '/orders/:orderId');

    expect(await screen.findByText(/actions are per item/i)).toBeInTheDocument();
  });

  it('surfaces a refusal in the server own words', async () => {
    mock.onGet('/orders/ORD000123').reply(200, detailsResponse());
    mock.onPatch('/orders/ORD000123').reply(400, {
      success: false,
      message: 'This order has already been shipped and cannot be cancelled'
    });

    renderAt(<OrderDetailsPage />, '/orders/ORD000123', '/orders/:orderId');

    await userEvent.click(await screen.findByRole('button', { name: /cancel order/i }));

    const dialog = await screen.findByRole('dialog');
    await userEvent.selectOptions(within(dialog).getByRole('combobox'), 'Ordered by mistake');
    await userEvent.click(within(dialog).getByRole('button', { name: /cancel order/i }));

    expect(await screen.findByText(/already been shipped/i)).toBeInTheDocument();
  });
});
