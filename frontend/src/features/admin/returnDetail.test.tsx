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
import AdminReturnDetailsPage from './AdminReturnDetailsPage';

const renderAt = (entry: string) => {
  const router = createMemoryRouter(
    [
      { path: '/admin/returns/:returnId', element: <AdminReturnDetailsPage /> },
      { path: '/admin/orders/:orderId', element: <p>admin order details</p> },
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

const details = (
  overrides: Record<string, unknown> = {},
  order: Record<string, unknown> | null = {
    orderId: 'ORD000123',
    status: 'Delivered',
    paymentMethod: 'upi',
    paymentStatus: 'Completed',
    createdAt: '2026-03-01T10:30:00Z'
  }
) => ({
  success: true,
  data: {
    return: {
      _id: 'r1',
      returnId: 'RET000042',
      orderId: 'ORD000123',
      status: 'Pending',
      reason: 'Size too small',
      productName: 'Air Max 90',
      productImage: '/uploads/am90.jpg',
      sku: 'AM90-8',
      size: 'UK 8',
      quantity: 1,
      price: 1500,
      totalPrice: 1500,
      refundStatus: 'Pending',
      requestDate: '2026-03-09T10:30:00Z',
      userId: { _id: 'u1', name: 'Alice Example', email: 'alice@example.com' },
      productId: { _id: 'p1', productName: 'Air Max 90' },
      ...overrides
    },
    order
  }
});

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(client);
});

afterEach(() => mock.restore());

describe('AdminReturnDetailsPage', () => {
  it('fetches the return named in the URL and lays out the item, customer and order', async () => {
    mock.onGet('/admin/returns/api/RET000042').reply(200, details());

    renderAt('/admin/returns/RET000042');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Return #RET000042' })
    ).toBeInTheDocument();

    // The heading names the return from the URL before it loads, so wait on
    // the content rather than the heading.
    expect(await screen.findByText('Size too small')).toBeInTheDocument();
    expect(screen.getByText('Alice Example')).toBeInTheDocument();
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'ORD000123' })).toHaveAttribute(
      'href',
      '/admin/orders/ORD000123'
    );
    expect(screen.getByRole('link', { name: 'Air Max 90' })).toHaveAttribute(
      'href',
      '/admin/products/p1'
    );
  });

  it('approves by _id after confirming, naming the refund', async () => {
    mock.onGet('/admin/returns/api/RET000042').reply(200, details());
    mock.onPatch('/admin/returns/r1/approve').reply(200, { success: true });

    renderAt('/admin/returns/RET000042');

    await userEvent.click(await screen.findByRole('button', { name: 'Approve return' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/₹1,500 goes back/i)).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Approve' }));

    await vi.waitFor(() => {
      expect(mock.history.patch.some((r) => r.url === '/admin/returns/r1/approve')).toBe(true);
    });
  });

  it('rejects with the chosen reason, sent as rejectionReason', async () => {
    mock.onGet('/admin/returns/api/RET000042').reply(200, details());
    mock.onPatch('/admin/returns/r1/reject').reply(200, { success: true });

    renderAt('/admin/returns/RET000042');

    await userEvent.click(await screen.findByRole('button', { name: 'Reject return' }));

    const dialog = await screen.findByRole('dialog');
    await userEvent.selectOptions(within(dialog).getByRole('combobox'), 'Packaging or tags missing');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reject' }));

    await vi.waitFor(() => expect(mock.history.patch).toHaveLength(1));

    expect(mock.history.patch[0]!.url).toBe('/admin/returns/r1/reject');
    expect(JSON.parse(mock.history.patch[0]!.data)).toEqual({
      rejectionReason: 'Packaging or tags missing'
    });
  });

  it('says what was decided instead of offering the decision again', async () => {
    mock.onGet('/admin/returns/api/RET000042').reply(
      200,
      details({
        status: 'Rejected',
        rejectedAt: '2026-03-10T10:30:00Z',
        rejectionReason: 'Item shows signs of wear'
      })
    );

    renderAt('/admin/returns/RET000042');

    expect(await screen.findByText(/Rejected on .*Item shows signs of wear/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve return' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reject return' })).not.toBeInTheDocument();
  });

  it('says how much went back on an approved return', async () => {
    mock.onGet('/admin/returns/api/RET000042').reply(
      200,
      details({
        status: 'Approved',
        approvedAt: '2026-03-10T10:30:00Z',
        refundAmount: 1400,
        refundMethod: 'Wallet',
        refundStatus: 'Processed'
      })
    );

    renderAt('/admin/returns/RET000042');

    expect(
      await screen.findByText(/₹1,400 was refunded to the shopper's wallet/)
    ).toBeInTheDocument();
    expect(screen.getByText('Refund Processed')).toBeInTheDocument();
  });

  it('keeps the page when the order it came from no longer exists', async () => {
    mock.onGet('/admin/returns/api/RET000042').reply(200, details({}, null));

    renderAt('/admin/returns/RET000042');

    expect(await screen.findByText(/no longer exists/)).toBeInTheDocument();
    expect(screen.getByText('Size too small')).toBeInTheDocument();
  });
});
