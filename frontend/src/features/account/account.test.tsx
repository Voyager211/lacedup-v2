import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import MockAdapter from 'axios-mock-adapter';
import { api as client } from '@/api/client';
import { createStore } from '@/app/store';
import { ConfirmProvider } from '@/components/confirm/ConfirmProvider';
import { Toaster } from '@/components/toast';
import WalletPage from './WalletPage';
import ReferralsPage from './ReferralsPage';
import ChangePasswordPage from './ChangePasswordPage';
import AddressBookPage from '@/features/addresses/AddressBookPage';

const renderAt = (element: React.ReactNode, entry = '/x', path = '/x') => {
  const router = createMemoryRouter(
    [
      { path, element },
      { path: '/profile', element: <p>profile page</p> },
      { path: '/orders', element: <p>orders page</p> },
      { path: '/addresses', element: <p>addresses page</p> },
      { path: '/wallet', element: <p>wallet page</p> },
      { path: '/referrals', element: <p>referrals page</p> },
      { path: '/profile/change-password', element: <p>password page</p> }
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
  mock.onGet('/states-districts').reply(200, {});
});

afterEach(() => mock.restore());

describe('WalletPage', () => {
  const wallet = (overrides: Record<string, unknown> = {}) => ({
    success: true,
    wallet: { balance: 2500 },
    transactions: [
      {
        transactionId: 't1',
        type: 'credit',
        amount: 500,
        description: 'Refund for ORD000123',
        status: 'completed',
        date: '2026-03-09T10:30:00Z'
      }
    ],
    currentPage: 1,
    totalPages: 1,
    totalTransactions: 1,
    ...overrides
  });

  it('shows the balance and the transaction list', async () => {
    mock.onGet('/wallet').reply(200, wallet());

    renderAt(<WalletPage />);

    expect(await screen.findByText('₹2,500')).toBeInTheDocument();
    expect(screen.getByText('Refund for ORD000123')).toBeInTheDocument();
    expect(screen.getByText('+₹500')).toBeInTheDocument();
  });

  it('signs a debit differently from a credit', async () => {
    mock.onGet('/wallet').reply(200, {
      ...wallet(),
      transactions: [
        { transactionId: 't2', type: 'debit', amount: 300, description: 'Order payment', date: '2026-03-09T10:30:00Z' }
      ]
    });

    renderAt(<WalletPage />);

    expect(await screen.findByText('−₹300')).toBeInTheDocument();
  });

  it('rejects an amount outside the server limits before requesting anything', async () => {
    mock.onGet('/wallet').reply(200, wallet());
    mock.onPost('/wallet/topup/create-order').reply(200, {});

    renderAt(<WalletPage />);

    await userEvent.click(await screen.findByRole('button', { name: /add money/i }));

    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Amount'), '99999');
    await userEvent.click(within(dialog).getByRole('button', { name: /continue to payment/i }));

    // The exact toast wording - the dialog's own description also mentions the
    // range, so a loose matcher hits both.
    expect(await screen.findByText('Enter an amount between ₹1 and ₹50,000')).toBeInTheDocument();
    expect(mock.history.post).toHaveLength(0);
  });

  it('offers no PayPal top-up', async () => {
    // The EJS page called /wallet/topup/capture-paypal, which has never
    // existed on the server.
    mock.onGet('/wallet').reply(200, wallet());

    renderAt(<WalletPage />);

    await screen.findByText('₹2,500');
    expect(screen.queryByText(/paypal/i)).not.toBeInTheDocument();
  });

  it('shows an empty state rather than a bare list', async () => {
    mock.onGet('/wallet').reply(200, { ...wallet(), transactions: [], totalTransactions: 0 });

    renderAt(<WalletPage />);

    expect(await screen.findByText(/no transactions yet/i)).toBeInTheDocument();
  });
});

describe('ReferralsPage', () => {
  const referrals = (overrides: Record<string, unknown> = {}) => ({
    success: true,
    referredUsers: [
      { _id: 'u2', name: 'Friend One', email: 'friend@example.com', createdAt: '2026-03-09T10:30:00Z' }
    ],
    referralTransactions: [
      {
        transactionId: 'r1',
        type: 'credit',
        amount: 300,
        description: 'Referral reward',
        date: '2026-03-09T10:30:00Z'
      }
    ],
    totalEarnings: 300,
    referralLink: 'http://localhost:3000/signup?ref=ABC123',
    referralCode: 'ABC123',
    totalReferrals: 1,
    referralsCurrentPage: 1,
    referralsTotalPages: 2,
    earningsCurrentPage: 1,
    earningsTotalPages: 1,
    totalEarningsCount: 1,
    ...overrides
  });

  it('shows the code, the link and the totals', async () => {
    mock.onGet('/referrals').reply(200, referrals());

    renderAt(<ReferralsPage />);

    expect(await screen.findByText('ABC123')).toBeInTheDocument();
    expect(screen.getByText('₹300')).toBeInTheDocument();
    expect(screen.getByLabelText(/invite link/i)).toHaveValue(
      'http://localhost:3000/signup?ref=ABC123'
    );
  });

  it('pages the referred list through the endpoint that was never mounted before', async () => {
    // getPaginatedReferrals existed as a handler all along but had no route,
    // so page 2 has never worked for anyone until now.
    mock.onGet('/referrals').reply(200, referrals());
    mock.onGet('/referrals/referred-users').reply(200, {
      success: true,
      data: {
        referredUsers: [
          { _id: 'u3', name: 'Friend Two', email: 'two@example.com', createdAt: '2026-03-09T10:30:00Z' }
        ],
        currentPage: 2,
        totalPages: 2
      }
    });

    renderAt(<ReferralsPage />);

    await screen.findByText('Friend One');
    await userEvent.click(screen.getByRole('button', { name: 'Page 2' }));

    expect(await screen.findByText('Friend Two')).toBeInTheDocument();
    expect(mock.history.get.some((r) => r.url === '/referrals/referred-users')).toBe(true);
  });

  it('invites sharing when nobody has been referred', async () => {
    mock.onGet('/referrals').reply(200, {
      ...referrals(),
      referredUsers: [],
      totalReferrals: 0,
      referralsTotalPages: 0
    });

    renderAt(<ReferralsPage />);

    expect(await screen.findByText(/nobody yet/i)).toBeInTheDocument();
  });
});

describe('ChangePasswordPage', () => {
  it('enforces the new-password rules before sending', async () => {
    renderAt(<ChangePasswordPage />);

    await userEvent.type(screen.getByLabelText('Current password'), 'oldpassword1');
    await userEvent.type(screen.getByLabelText('New password'), 'short1');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'short1');
    await userEvent.click(screen.getByRole('button', { name: /change password/i }));

    expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument();
    expect(mock.history.post).toHaveLength(0);
  });

  it('refuses a change to the same password', async () => {
    renderAt(<ChangePasswordPage />);

    await userEvent.type(screen.getByLabelText('Current password'), 'samepassword1');
    await userEvent.type(screen.getByLabelText('New password'), 'samepassword1');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'samepassword1');
    await userEvent.click(screen.getByRole('button', { name: /change password/i }));

    expect(await screen.findByText(/must be different/i)).toBeInTheDocument();
  });

  it('puts a wrong current password on that field', async () => {
    mock.onPost('/profile/change-password').reply(400, {
      success: false,
      message: 'Your current password is incorrect'
    });

    renderAt(<ChangePasswordPage />);

    await userEvent.type(screen.getByLabelText('Current password'), 'wrongpassword1');
    await userEvent.type(screen.getByLabelText('New password'), 'newpassword1');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'newpassword1');
    await userEvent.click(screen.getByRole('button', { name: /change password/i }));

    expect(await screen.findByText(/current password is incorrect/i)).toBeInTheDocument();
  });
});

describe('AddressBookPage', () => {
  const addresses = {
    addresses: [
      {
        _id: 'a1',
        name: 'Alice Example',
        phone: '9876543210',
        addressType: 'Home',
        landMark: 'Near the park',
        city: 'Kochi',
        district: 'Ernakulam',
        state: 'Kerala',
        pincode: '682001',
        isDefault: true
      }
    ]
  };

  it('marks the default address', async () => {
    mock.onGet('/addresses').reply(200, addresses);

    renderAt(<AddressBookPage />);

    expect(await screen.findByText('Default address')).toBeInTheDocument();
  });

  it('offers no "make default" on the address that already is', async () => {
    mock.onGet('/addresses').reply(200, addresses);

    renderAt(<AddressBookPage />);

    await screen.findByText('Alice Example');
    expect(screen.queryByRole('button', { name: /make default/i })).not.toBeInTheDocument();
  });

  it('asks before deleting', async () => {
    mock.onGet('/addresses').reply(200, addresses);

    renderAt(<AddressBookPage />);

    await userEvent.click(await screen.findByRole('button', { name: /delete/i }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(mock.history.delete).toHaveLength(0);
  });

  it('invites adding one when the book is empty', async () => {
    mock.onGet('/addresses').reply(200, { addresses: [] });

    renderAt(<AddressBookPage />);

    expect(await screen.findByText(/no addresses yet/i)).toBeInTheDocument();
  });
});
