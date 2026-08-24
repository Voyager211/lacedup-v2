import { useState } from 'react';
import { BsWallet2 } from 'react-icons/bs';
import {
  useCreateTopupOrderMutation,
  useGetWalletQuery,
  useVerifyTopupMutation
} from './account.api';
import { AccountLayout } from './AccountNav';
import { useRazorpay } from '@/features/checkout/useRazorpay';
import Badge from '@/components/Badge';
import Button from '@/components/Button';
import EmptyState from '@/components/EmptyState';
import Modal from '@/components/Modal';
import Pagination from '@/components/Pagination';
import QueryBoundary from '@/components/QueryBoundary';
import { SkeletonText } from '@/components/Skeleton';
import { TextField } from '@/components/form/TextField';
import { useToast } from '@/components/toast';
import { formatDate, formatINR } from '@/lib/format';

/**
 * The wallet.
 *
 * Top-up reuses `useRazorpay` from checkout - the same sheet, the same
 * dismissal handling - against the wallet's own create/verify pair.
 *
 * The EJS page also called `POST /wallet/topup/capture-paypal`, which has
 * never existed on the server (docs/defects.md). Razorpay is the only path
 * offered here.
 */

const MIN_TOPUP = 1;
const MAX_TOPUP = 50000;

const WalletPage = () => {
  const toast = useToast();
  const openRazorpay = useRazorpay();

  const [page, setPage] = useState(1);
  const { data, isLoading, isFetching, error, refetch } = useGetWalletQuery(page);

  const [createTopup] = useCreateTopupOrderMutation();
  const [verifyTopup] = useVerifyTopupMutation();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);

  const topUp = async () => {
    const value = Number(amount);

    if (!Number.isFinite(value) || value < MIN_TOPUP || value > MAX_TOPUP) {
      toast.error(`Enter an amount between ${formatINR(MIN_TOPUP)} and ${formatINR(MAX_TOPUP)}`);
      return;
    }

    setBusy(true);

    try {
      const created = await createTopup({ amount: value }).unwrap();

      await openRazorpay({
        orderId: created.razorpayOrderId,
        amount: Math.round(created.amount * 100),
        currency: created.currency,
        keyId: created.keyId,

        onSuccess: async (response) => {
          try {
            await verifyTopup({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              transactionId: created.transactionId
            }).unwrap();

            toast.success(`${formatINR(value)} added to your wallet`);
            setDialogOpen(false);
            setAmount('');
          } catch {
            toast.error(
              'We could not confirm that top-up',
              'If you were charged, the balance will update shortly.'
            );
          } finally {
            setBusy(false);
          }
        },

        onDismiss: (reason) => {
          setBusy(false);
          if (reason === 'unavailable') toast.error('The payment window could not be opened');
          else toast.info('Top-up cancelled');
        }
      });
    } catch (caught) {
      setBusy(false);
      toast.fromError(caught, 'Could not start that top-up.');
    }
  };

  const transactions = data?.transactions ?? [];

  return (
    <AccountLayout title="Your wallet">
      <div className="rounded-lg border border-line bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-ink-muted">Balance</p>
            <p className="mt-1 font-heading text-3xl font-semibold text-ink">
              {formatINR(data?.wallet?.balance ?? 0)}
            </p>
          </div>

          <Button onClick={() => setDialogOpen(true)}>Add money</Button>
        </div>
      </div>

      <section className="mt-6">
        <h2 className="mb-3 font-heading text-lg font-semibold text-ink">Transactions</h2>

        <QueryBoundary
          isLoading={isLoading}
          error={error}
          isEmpty={transactions.length === 0}
          skeleton={<SkeletonText lines={6} />}
          empty={
            <EmptyState
              icon={<BsWallet2 className="size-14" />}
              title="No transactions yet"
              message="Top-ups, refunds and payments will appear here."
            />
          }
          onRetry={refetch}
        >
          <ul className="divide-y divide-line rounded-lg border border-line bg-white">
            {transactions.map((entry) => (
              <li key={entry.transactionId} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="truncate text-ink">{entry.description ?? 'Transaction'}</p>
                  <p className="mt-0.5 text-sm text-ink-muted">
                    {formatDate(entry.date)}
                    {entry.status && entry.status !== 'completed' && (
                      <Badge className="ml-2" size="sm" tone="warning">
                        {entry.status}
                      </Badge>
                    )}
                  </p>
                </div>

                <p
                  className={
                    entry.type === 'credit'
                      ? 'shrink-0 font-semibold text-success'
                      : 'shrink-0 font-semibold text-ink'
                  }
                >
                  {entry.type === 'credit' ? '+' : '−'}
                  {formatINR(entry.amount)}
                </p>
              </li>
            ))}
          </ul>

          {(data?.totalPages ?? 0) > 1 && (
            <Pagination
              className="mt-6"
              currentPage={data?.currentPage ?? 1}
              totalPages={data?.totalPages ?? 1}
              disabled={isFetching}
              onPageChange={setPage}
            />
          )}
        </QueryBoundary>
      </section>

      <Modal
        open={dialogOpen}
        onOpenChange={(next) => !busy && setDialogOpen(next)}
        // Closing mid-payment would leave the sheet orphaned behind a dead dialog.
        dismissible={!busy}
        title="Add money"
        description={`Between ${formatINR(MIN_TOPUP)} and ${formatINR(MAX_TOPUP)}.`}
        size="sm"
        footer={
          <>
            <Button variant="outline" disabled={busy} onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button loading={busy} onClick={topUp}>
              Continue to payment
            </Button>
          </>
        }
      >
        <TextField
          label="Amount"
          type="number"
          inputMode="numeric"
          min={MIN_TOPUP}
          max={MAX_TOPUP}
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="500"
        />
      </Modal>
    </AccountLayout>
  );
};

export default WalletPage;
