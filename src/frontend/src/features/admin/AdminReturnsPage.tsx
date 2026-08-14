import { useSearchParams } from 'react-router-dom';
import {
  useApproveReturnMutation,
  useGetAdminReturnsQuery,
  useRejectReturnMutation,
  type AdminReturnRow
} from './adminOps.api';
import Badge, { RETURN_STATUS_TONE } from '@/components/Badge';
import EmptyState from '@/components/EmptyState';
import FilterBar from '@/components/FilterBar';
import Pagination from '@/components/Pagination';
import QueryBoundary from '@/components/QueryBoundary';
import { SkeletonTable } from '@/components/Skeleton';
import { useConfirm, usePrompt } from '@/components/confirm/useConfirm';
import { useToast } from '@/components/toast';
import { formatDate, formatINR } from '@/lib/format';
import { RETURN_STATUS, type ReturnStatus } from '@/types/domain';
import { cn } from '@/lib/cn';

/**
 * Return requests.
 *
 * This was the one EJS page that used `filters-bar`, so it is the component's
 * second consumer here and the reason its contract was worth porting.
 *
 * Approving is consequential - it refunds to the shopper's wallet and returns
 * the stock - so it is confirmed, and rejecting asks for a reason the shopper
 * will see.
 */
const REJECTION_REASONS = [
  'Item shows signs of wear',
  'Returned outside the return window',
  'Item does not match what was ordered',
  'Packaging or tags missing',
  'Other'
];

const AdminReturnsPage = () => {
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const confirm = useConfirm();
  const prompt = usePrompt();

  const page = Number(params.get('page')) || 1;
  const search = params.get('search') ?? '';
  const status = params.get('status') ?? '';

  const { data, isLoading, isFetching, error, refetch } = useGetAdminReturnsQuery({
    page,
    search,
    status
  });

  const [approveReturn] = useApproveReturnMutation();
  const [rejectReturn] = useRejectReturnMutation();

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next);
  };

  const onApprove = async (row: AdminReturnRow) => {
    const amount = Number(row.refundAmount ?? row.totalPrice ?? 0);

    const ok = await confirm({
      title: 'Approve this return?',
      message: `${formatINR(amount)} goes back to the shopper's wallet and the stock is returned.`,
      confirmLabel: 'Approve'
    });

    if (!ok) return;

    try {
      await approveReturn({ returnId: row._id }).unwrap();
      toast.success('Return approved');
    } catch (caught) {
      toast.fromError(caught, 'Could not approve that return.');
    }
  };

  const onReject = async (row: AdminReturnRow) => {
    const reason = await prompt({
      title: 'Reject this return?',
      message: 'The shopper is told why, so choose the closest reason.',
      options: REJECTION_REASONS,
      confirmLabel: 'Reject',
      tone: 'danger',
      requiredMessage: 'Choose a reason — the shopper sees it.'
    });

    if (!reason) return;

    try {
      await rejectReturn({ returnId: row._id, reason }).unwrap();
      toast.success('Return rejected');
    } catch (caught) {
      toast.fromError(caught, 'Could not reject that return.');
    }
  };

  const returns = data?.returns ?? [];

  return (
    <div>
      <h1 className="mb-5 font-heading text-2xl font-semibold text-ink">Returns</h1>

      <FilterBar
        search={search}
        onSearchChange={(value) => setParam('search', value)}
        searchPlaceholder="Search by order or customer…"
        filters={[
          {
            name: 'status',
            label: 'Status',
            allLabel: 'All',
            options: Object.values(RETURN_STATUS).map((value) => ({ value, label: value }))
          }
        ]}
        values={{ status }}
        onFilterChange={setParam}
        onReset={() => setParams({})}
      />

      <QueryBoundary
        isLoading={isLoading}
        error={error}
        isEmpty={returns.length === 0}
        skeleton={<SkeletonTable rows={6} columns={5} />}
        empty={<EmptyState title="No return requests" message="Nothing is waiting on a decision." />}
        onRetry={refetch}
      >
        <div className={cn('overflow-x-auto rounded-lg border border-line bg-white', isFetching && 'opacity-60')}>
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-card/50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium text-ink">Order</th>
                <th className="px-4 py-3 font-medium text-ink">Reason</th>
                <th className="px-4 py-3 font-medium text-ink">Refund</th>
                <th className="px-4 py-3 font-medium text-ink">Requested</th>
                <th className="px-4 py-3 font-medium text-ink">Status</th>
                <th className="px-4 py-3 text-right font-medium text-ink">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-line">
              {returns.map((row) => {
                const pending = row.status === RETURN_STATUS.PENDING;

                return (
                  <tr key={row._id} className="hover:bg-card/40">
                    <td className="px-4 py-3 font-mono text-ink">
                      {String(row.orderId ?? row.returnId ?? '—')}
                    </td>
                    <td className="max-w-xs px-4 py-3 text-ink-muted">
                      <span className="line-clamp-2">{row.reason ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-ink">
                      {formatINR(Number(row.refundAmount ?? row.totalPrice ?? 0))}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {formatDate(row.requestDate ?? row.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        size="sm"
                        tone={RETURN_STATUS_TONE[row.status as ReturnStatus] ?? 'secondary'}
                      >
                        {row.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {pending ? (
                        <div className="flex justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => onApprove(row)}
                            className="text-ink-muted hover:text-success"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => onReject(row)}
                            className="text-ink-muted hover:text-danger"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        // Already decided - the decision is not reversible from
                        // here, so no buttons rather than ones that fail.
                        <p className="text-right text-ink-muted">Decided</p>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {(data?.totalPages ?? 0) > 1 && (
          <Pagination
            className="mt-6"
            currentPage={data?.currentPage ?? 1}
            totalPages={data?.totalPages ?? 1}
            disabled={isFetching}
            onPageChange={(next) => setParam('page', String(next))}
          />
        )}
      </QueryBoundary>
    </div>
  );
};

export default AdminReturnsPage;
