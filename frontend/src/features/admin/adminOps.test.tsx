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
import AdminOrdersPage from './AdminOrdersPage';
import AdminOrderDetailsPage from './AdminOrderDetailsPage';
import AdminReturnsPage from './AdminReturnsPage';
import AdminUsersPage from './AdminUsersPage';

const renderAt = (element: React.ReactNode, entry: string, path: string) => {
  const router = createMemoryRouter(
    [
      { path, element },
      { path: '/admin/orders', element: <p>admin orders list</p> },
      { path: '/admin/orders/:orderId', element: <p>admin order details</p> }
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

describe('AdminOrdersPage', () => {
  const orders = {
    success: true,
    data: {
      orders: [
        {
          _id: 'o1',
          orderId: 'ORD000123',
          customerName: 'Alice Example',
          productName: 'Air Max 90',
          size: 'UK 8',
          quantity: 1,
          totalPrice: 1500,
          status: 'Pending',
          paymentStatus: 'Pending',
          paymentMethod: 'cod',
          orderDate: '2026-03-09T10:30:00Z'
        }
      ],
      currentPage: 1,
      totalPages: 2
    }
  };

  it('says the list is item-level, since the row count differs from the order count', async () => {
    mock.onGet('/admin/orders/api/filtered').reply(200, orders);

    renderAt(<AdminOrdersPage />, '/admin/orders-x', '/admin/orders-x');

    expect(await screen.findByText('ORD000123')).toBeInTheDocument();
    expect(screen.getByText(/one row per item/i)).toBeInTheDocument();
  });

  it('reads its filters from the URL', async () => {
    mock.onGet('/admin/orders/api/filtered').reply(200, orders);

    renderAt(
      <AdminOrdersPage />,
      '/admin/orders-x?status=Delivered&paymentStatus=Completed&page=2',
      '/admin/orders-x'
    );

    await screen.findByText('ORD000123');

    const request = mock.history.get.find((r) => r.url === '/admin/orders/api/filtered');
    expect(request?.params).toMatchObject({
      status: 'Delivered',
      paymentStatus: 'Completed',
      page: 2
    });
  });
});

describe('AdminOrderDetailsPage', () => {
  const details = (status = 'Processing') => ({
    success: true,
    order: {
      _id: 'o1',
      orderId: 'ORD000123',
      status,
      paymentStatus: 'Completed',
      paymentMethod: 'upi',
      createdAt: '2026-03-09T10:30:00Z',
      items: [
        {
          _id: 'i1',
          productName: 'Air Max 90',
          size: 'UK 8',
          quantity: 1,
          totalPrice: 1500,
          status: 'Processing'
        }
      ]
    }
  });

  it('offers only the transitions the server allows', async () => {
    mock.onGet('/admin/orders/api/ORD000123').reply(200, details());
    mock.onGet('/admin/orders/ORD000123/transitions').reply(200, {
      success: true,
      currentStatus: 'Processing',
      allowedTransitions: ['Shipped', 'Cancelled']
    });

    renderAt(<AdminOrderDetailsPage />, '/admin/orders/ORD000123', '/admin/orders/:orderId');

    await userEvent.click(await screen.findByRole('button', { name: /change order status/i }));

    const dialog = await screen.findByRole('dialog');
    const select = within(dialog).getByLabelText('New status');

    expect(within(select).getByRole('option', { name: 'Shipped' })).toBeInTheDocument();
    expect(within(select).getByRole('option', { name: 'Cancelled' })).toBeInTheDocument();
    expect(within(select).queryByRole('option', { name: 'Delivered' })).not.toBeInTheDocument();
  });

  it('explains a partially delivered order instead of showing an empty dropdown', async () => {
    // The server returns no transitions for the partial states. The EJS admin
    // rendered that as an empty dropdown with no reason given, which looks
    // broken rather than deliberate.
    mock.onGet('/admin/orders/api/ORD000123').reply(200, details('Partially Delivered'));
    mock.onGet('/admin/orders/ORD000123/transitions').reply(200, {
      success: true,
      currentStatus: 'Partially Delivered',
      allowedTransitions: []
    });

    renderAt(<AdminOrderDetailsPage />, '/admin/orders/ORD000123', '/admin/orders/:orderId');

    expect(await screen.findByText(/items in this order are at different stages/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /change order status/i })).not.toBeInTheDocument();
  });

  it('updates an item against the item endpoint', async () => {
    mock.onGet('/admin/orders/api/ORD000123').reply(200, details());
    mock.onGet('/admin/orders/ORD000123/transitions').reply(200, {
      success: true,
      allowedTransitions: ['Shipped']
    });
    mock.onPatch('/admin/orders/ORD000123/items/i1/status').reply(200, { success: true });

    renderAt(<AdminOrderDetailsPage />, '/admin/orders/ORD000123', '/admin/orders/:orderId');

    const select = await screen.findByLabelText(/change status for this item/i);
    await userEvent.selectOptions(select, 'Shipped');

    await vi.waitFor(() => {
      expect(
        mock.history.patch.some((r) => r.url === '/admin/orders/ORD000123/items/i1/status')
      ).toBe(true);
    });
  });

  it('offers no changes on an item that is already cancelled', async () => {
    mock.onGet('/admin/orders/api/ORD000123').reply(200, {
      success: true,
      order: { ...details().order, items: [{ ...details().order.items[0], status: 'Cancelled' }] }
    });
    mock.onGet('/admin/orders/ORD000123/transitions').reply(200, { allowedTransitions: [] });

    renderAt(<AdminOrderDetailsPage />, '/admin/orders/ORD000123', '/admin/orders/:orderId');

    expect(await screen.findByText('No further changes')).toBeInTheDocument();
  });
});

describe('AdminReturnsPage', () => {
  const returns = (status = 'Pending') => ({
    success: true,
    data: {
      returns: [
        {
          _id: 'r1',
          orderId: 'ORD000123',
          status,
          reason: 'Size too small',
          refundAmount: 1500,
          requestDate: '2026-03-09T10:30:00Z'
        }
      ],
      currentPage: 1,
      totalPages: 1
    }
  });

  it('confirms an approval, naming the refund amount', async () => {
    mock.onGet('/admin/returns/api/filtered').reply(200, returns());

    renderAt(<AdminReturnsPage />, '/admin/returns-x', '/admin/returns-x');

    await userEvent.click(await screen.findByRole('button', { name: /approve return/i }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/₹1,500 goes back/i)).toBeInTheDocument();
    expect(mock.history.patch).toHaveLength(0);
  });

  it('requires a reason to reject, because the shopper is told it', async () => {
    mock.onGet('/admin/returns/api/filtered').reply(200, returns());

    renderAt(<AdminReturnsPage />, '/admin/returns-x', '/admin/returns-x');

    await userEvent.click(await screen.findByRole('button', { name: /reject return/i }));

    const dialog = await screen.findByRole('dialog');
    // The dialog's own confirm button is still labelled "Reject"; only the row
    // action was renamed when it became an icon.
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reject' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/choose a reason/i);
    expect(mock.history.patch).toHaveLength(0);
  });

  it('offers no decision on a return already decided', async () => {
    mock.onGet('/admin/returns/api/filtered').reply(200, returns('Approved'));

    renderAt(<AdminReturnsPage />, '/admin/returns-x', '/admin/returns-x');

    expect(await screen.findByText('Decided')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /approve return/i })).not.toBeInTheDocument();
  });
});

describe('AdminUsersPage', () => {
  const users = (isBlocked = false) => ({
    users: [
      {
        _id: 'u1',
        name: 'Alice Example',
        email: 'alice@example.com',
        isBlocked,
        createdAt: '2026-03-09T10:30:00Z'
      }
    ],
    currentPage: 1,
    totalPages: 1
  });

  it('confirms before blocking, and says it takes effect at once', async () => {
    mock.onGet('/admin/users/api').reply(200, users());

    renderAt(<AdminUsersPage />, '/admin/users-x', '/admin/users-x');

    await userEvent.click(await screen.findByRole('button', { name: /block user/i }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/signed out immediately/i)).toBeInTheDocument();
    expect(mock.history.patch).toHaveLength(0);
  });

  it('unblocks without a confirmation, since it is not destructive', async () => {
    mock.onGet('/admin/users/api').reply(200, users(true));
    mock.onPatch('/admin/users/u1/unblock').reply(200, { success: true });

    renderAt(<AdminUsersPage />, '/admin/users-x', '/admin/users-x');

    await userEvent.click(await screen.findByRole('button', { name: /unblock user/i }));

    await vi.waitFor(() => {
      expect(mock.history.patch.some((r) => r.url === '/admin/users/u1/unblock')).toBe(true);
    });
  });
});
