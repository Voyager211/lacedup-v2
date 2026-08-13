import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BsBagCheck, BsSearch, BsX } from 'react-icons/bs';
import { useGetFilteredOrdersQuery, useGetOrdersQuery, type Order } from './orders.api';
import Badge, { ORDER_STATUS_TONE } from '@/components/Badge';
import EmptyState from '@/components/EmptyState';
import Pagination from '@/components/Pagination';
import QueryBoundary from '@/components/QueryBoundary';
import { SkeletonText } from '@/components/Skeleton';
import { formatDate, formatINR } from '@/lib/format';
import { ORDER_STATUS, type OrderStatus } from '@/types/domain';
import { cn } from '@/lib/cn';

/**
 * Order history.
 *
 * Filters live in the URL, as on the shop page, so a filtered view can be
 * linked and the back button works.
 *
 * Two requests rather than one: `/orders` carries the reason enums and the
 * first page, `/orders/filtered` serves every page after that. Splitting them
 * keeps the enums out of every pagination response.
 */

const STATUS_FILTERS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All orders' },
  ...Object.values(ORDER_STATUS).map((status) => ({ value: status, label: status }))
];

const OrderCard = ({ order }: { order: Order }) => {
  const itemCount = order.items?.length ?? 0;
  const preview = order.items?.slice(0, 3) ?? [];

  return (
    <li className="rounded-lg border border-line bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            to={`/orders/${order.orderId}`}
            className="font-mono font-medium text-ink hover:text-brand"
          >
            {order.orderId}
          </Link>
          <p className="mt-0.5 text-sm text-ink-muted">
            Placed {formatDate(order.createdAt)} · {itemCount}{' '}
            {itemCount === 1 ? 'item' : 'items'}
          </p>
        </div>

        <Badge tone={ORDER_STATUS_TONE[order.status as OrderStatus] ?? 'secondary'}>
          {order.status}
        </Badge>
      </div>

      <div className="mt-4 flex items-center gap-3">
        {preview.map((item) => (
          <img
            key={item._id}
            src={item.productId?.mainImage}
            alt=""
            loading="lazy"
            className="size-14 rounded-md object-cover"
          />
        ))}
        {itemCount > preview.length && (
          <span className="text-sm text-ink-muted">+{itemCount - preview.length} more</span>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
        <span className="font-semibold text-ink">
          {formatINR(order.finalAmount ?? order.totalAmount ?? 0)}
        </span>
        <Link
          to={`/orders/${order.orderId}`}
          className="text-sm font-medium text-brand hover:underline"
        >
          View details
        </Link>
      </div>
    </li>
  );
};

const OrdersPage = () => {
  const [params, setParams] = useSearchParams();

  const page = Number(params.get('page')) || 1;
  const status = params.get('status') ?? '';
  const searchParam = params.get('search') ?? '';

  const [search, setSearch] = useState(searchParam);

  // Debounced into the URL, so the query and the address bar stay in step
  // without a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search === searchParam) return;

      const next = new URLSearchParams(params);
      if (search) next.set('search', search);
      else next.delete('search');
      next.delete('page');
      setParams(next, { replace: true });
    }, 400);

    return () => clearTimeout(timer);
  }, [search, searchParam, params, setParams]);

  // The first unfiltered page comes with the reason enums attached; anything
  // filtered or paged goes to the lighter endpoint.
  const isDefaultView = page === 1 && !status && !searchParam;

  const initial = useGetOrdersQuery(undefined, { skip: !isDefaultView });
  const filtered = useGetFilteredOrdersQuery(
    { page, status, search: searchParam },
    { skip: isDefaultView }
  );

  const data = isDefaultView ? initial.data : filtered.data;
  const isLoading = isDefaultView ? initial.isLoading : filtered.isLoading;
  const isFetching = isDefaultView ? initial.isFetching : filtered.isFetching;
  const error = isDefaultView ? initial.error : filtered.error;
  const refetch = isDefaultView ? initial.refetch : filtered.refetch;

  const orders = data?.orders ?? [];

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 font-heading text-3xl font-semibold text-ink">Your orders</h1>

      <div className="mb-6 flex flex-wrap gap-3">
        <div className="relative min-w-0 flex-1">
          <label htmlFor="order-search" className="sr-only">
            Search your orders
          </label>
          <BsSearch
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted"
            aria-hidden="true"
          />
          <input
            id="order-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by order number or product"
            className="w-full rounded-md border border-line py-2 pl-10 pr-9 text-sm"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-ink-muted hover:bg-card"
            >
              <BsX className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>

        <div>
          <label htmlFor="order-status" className="sr-only">
            Filter by status
          </label>
          <select
            id="order-status"
            value={status}
            onChange={(event) => setFilter('status', event.target.value)}
            className="rounded-md border border-line px-3 py-2 text-sm"
          >
            {STATUS_FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <QueryBoundary
        isLoading={isLoading}
        error={error}
        isEmpty={orders.length === 0}
        skeleton={<SkeletonText lines={8} />}
        empty={
          status || searchParam ? (
            <EmptyState
              title="No orders match that"
              message="Try clearing the filter or searching for something else."
            />
          ) : (
            <EmptyState
              icon={<BsBagCheck className="size-14" />}
              title="No orders yet"
              message="When you place one, it will show up here."
              action={
                <Link
                  to="/shop"
                  className="rounded-md bg-brand px-5 py-2.5 font-medium text-white hover:bg-brand-hover"
                >
                  Start shopping
                </Link>
              }
            />
          )
        }
        onRetry={refetch}
      >
        <ul className={cn('space-y-4', isFetching && 'opacity-60 transition-opacity')}>
          {orders.map((order) => (
            <OrderCard key={order._id} order={order} />
          ))}
        </ul>

        {(data?.totalPages ?? 0) > 1 && (
          <Pagination
            className="mt-8"
            currentPage={data?.currentPage ?? 1}
            totalPages={data?.totalPages ?? 1}
            disabled={isFetching}
            onPageChange={(next) => {
              setFilter('page', String(next));
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}
      </QueryBoundary>
    </div>
  );
};

export default OrdersPage;
