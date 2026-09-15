import { useSearchParams } from 'react-router-dom';
import { useGetAdminReturnsQuery } from './adminOps.api';
import { useReturnDecision } from './useReturnDecision';
import Badge, { RETURN_STATUS_TONE } from '@/components/Badge';
import EmptyState from '@/components/EmptyState';
import FilterBar from '@/components/FilterBar';
import PageHeader from '@/components/PageHeader';
import Pagination from '@/components/Pagination';
import QueryBoundary from '@/components/QueryBoundary';
import { SkeletonTable } from '@/components/Skeleton';
import { formatDate, formatINR } from '@/lib/format';
import { RETURN_STATUS, type ReturnStatus } from '@/types/domain';
import { cn } from '@/lib/cn';
import { Check, X as XIcon } from 'lucide-react';
import { RowAction, RowActions, RowNumber, RowNumberHeader, useRowLink } from '@/components/table';

/**
 * Return requests.
 *
 * This was the one EJS page that used `filters-bar`, so it is the component's
 * second consumer here and the reason its contract was worth porting.
 *
 * A row opens the return's own page. The decision can be made from either,
 * and `useReturnDecision` asks the same questions in both places.
 */
const AdminReturnsPage = () => {
  const [params, setParams] = useSearchParams();
  const rowLink = useRowLink();
  const { approve, reject } = useReturnDecision();

  const page = Number(params.get('page')) || 1;
  const search = params.get('search') ?? '';
  const status = params.get('status') ?? '';

  const { data, isLoading, isFetching, error, refetch } = useGetAdminReturnsQuery({
    page,
    search,
    status
  });

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next);
  };

  const returns = data?.returns ?? [];

  return (
    <div>
      <PageHeader
        title="Return Management"
        count={data?.totalReturns}
        subtitle="Manage and process customer return requests"
      />

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
                <RowNumberHeader />
                <th className="px-4 py-3 font-medium text-ink">Order</th>
                <th className="px-4 py-3 font-medium text-ink">Reason</th>
                <th className="px-4 py-3 font-medium text-ink">Refund</th>
                <th className="px-4 py-3 font-medium text-ink">Requested</th>
                <th className="px-4 py-3 font-medium text-ink">Status</th>
                <th className="px-4 py-3 text-right font-medium text-ink">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-line">
              {returns.map((row, index) => {
                const pending = row.status === RETURN_STATUS.PENDING;

                return (
                  <tr key={row._id} {...rowLink(`/admin/returns/${row.returnId ?? row._id}`)}>
                    <RowNumber index={index} page={data?.currentPage ?? 1} />
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
                        <RowActions>
                          <RowAction
                            icon={Check}
                            label="Approve return"
                            onClick={() => approve(row)}
                          />
                          <RowAction
                            icon={XIcon}
                            label="Reject return"
                            onClick={() => reject(row)}
                            tone="danger"
                          />
                        </RowActions>
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
