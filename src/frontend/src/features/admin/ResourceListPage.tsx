import { useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BsPlus } from 'react-icons/bs';
import {
  useDeleteAdminRecordMutation,
  useGetAdminListQuery,
  useToggleAdminRecordMutation,
  type AdminRecord,
  type ResourceKey
} from './admin.api';
import Badge from '@/components/Badge';
import Button from '@/components/Button';
import EmptyState from '@/components/EmptyState';
import FilterBar, { type FilterDefinition } from '@/components/FilterBar';
import Pagination from '@/components/Pagination';
import QueryBoundary from '@/components/QueryBoundary';
import { SkeletonTable } from '@/components/Skeleton';
import { useConfirm } from '@/components/confirm/useConfirm';
import { useToast } from '@/components/toast';
import { cn } from '@/lib/cn';

/**
 * One admin list page, configured four times.
 *
 * Products, categories, brands and coupons were four EJS pages of ~1,700 lines
 * each doing the same thing: search, filter, paginate, toggle, delete. Around
 * 6,700 lines of near-duplicate script; this is the shape they share.
 *
 * State lives in the URL, as everywhere else, so a filtered admin view can be
 * linked to a colleague.
 */

export interface Column {
  header: string;
  /** Rendered per row. Given the whole record so it can compose cells. */
  cell: (record: AdminRecord) => ReactNode;
  className?: string;
}

export interface ResourceListPageProps {
  resource: ResourceKey;
  title: string;
  /** Used in confirmations: "Delete this category?" */
  singular: string;
  columns: Column[];
  filters?: FilterDefinition[];
  searchPlaceholder?: string;
  /** Opens the create form - a dialog for most, a route for products. */
  onCreate: () => void;
  /** Omitted where editing happens on its own page. */
  onEdit?: (record: AdminRecord) => void;
  /** Extra per-row actions, e.g. "View" on products. */
  rowActions?: (record: AdminRecord) => ReactNode;
}

/** Categories and brands use isActive; products use isListed. */
const isEnabled = (record: AdminRecord): boolean =>
  record.isActive ?? record.isListed ?? true;

const ResourceListPage = ({
  resource,
  title,
  singular,
  columns,
  filters,
  searchPlaceholder,
  onCreate,
  onEdit,
  rowActions
}: ResourceListPageProps) => {
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const confirm = useConfirm();

  const page = Number(params.get('page')) || 1;
  const q = params.get('q') ?? '';
  const status = params.get('status') ?? '';

  const { data, isLoading, isFetching, error, refetch } = useGetAdminListQuery({
    resource,
    query: { page, q, status }
  });

  const [toggleRecord] = useToggleAdminRecordMutation();
  const [deleteRecord] = useDeleteAdminRecordMutation();
  const [busyId, setBusyId] = useState<string | null>(null);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next);
  };

  const items = data?.items ?? [];

  const onToggle = async (record: AdminRecord) => {
    setBusyId(record._id);

    try {
      await toggleRecord({ resource, id: record._id }).unwrap();
      toast.success(isEnabled(record) ? `${singular} deactivated` : `${singular} activated`);
    } catch (caught) {
      toast.fromError(caught, `Could not update that ${singular.toLowerCase()}.`);
    } finally {
      setBusyId(null);
    }
  };

  const onDelete = async (record: AdminRecord) => {
    const ok = await confirm({
      title: `Delete this ${singular.toLowerCase()}?`,
      message: 'It is hidden rather than erased, so this can be undone in the database.',
      confirmLabel: 'Delete',
      tone: 'danger'
    });

    if (!ok) return;

    try {
      await deleteRecord({ resource, id: record._id }).unwrap();
      toast.success(`${singular} deleted`);
    } catch (caught) {
      toast.fromError(caught, `Could not delete that ${singular.toLowerCase()}.`);
    }
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-ink">{title}</h1>
          {data && (
            <p className="mt-0.5 text-sm text-ink-muted" aria-live="polite">
              {data.totalRecords} total
            </p>
          )}
        </div>
      </div>

      <FilterBar
        search={q}
        onSearchChange={(value) => setParam('q', value)}
        searchPlaceholder={searchPlaceholder ?? `Search ${title.toLowerCase()}…`}
        filters={filters ?? []}
        values={{ status }}
        onFilterChange={setParam}
        onReset={() => setParams({})}
        actions={
          <Button icon={<BsPlus className="size-4" aria-hidden="true" />} onClick={onCreate}>
            Add {singular.toLowerCase()}
          </Button>
        }
      />

      <QueryBoundary
        isLoading={isLoading}
        error={error}
        isEmpty={items.length === 0}
        skeleton={<SkeletonTable rows={6} columns={columns.length + 1} />}
        empty={
          q || status ? (
            <EmptyState
              title="Nothing matched"
              message="Try a different search or clear the filters."
              action={<Button variant="outline" onClick={() => setParams({})}>Clear filters</Button>}
            />
          ) : (
            <EmptyState
              title={`No ${title.toLowerCase()} yet`}
              action={<Button onClick={onCreate}>Add {singular.toLowerCase()}</Button>}
            />
          )
        }
        onRetry={refetch}
      >
        <div className={cn('overflow-x-auto rounded-lg border border-line bg-white', isFetching && 'opacity-60')}>
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-card/50 text-left">
              <tr>
                {columns.map((column) => (
                  <th key={column.header} className={cn('px-4 py-3 font-medium text-ink', column.className)}>
                    {column.header}
                  </th>
                ))}
                <th className="px-4 py-3 text-right font-medium text-ink">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-line">
              {items.map((record) => {
                const enabled = isEnabled(record);

                return (
                  <tr key={record._id} className="hover:bg-card/40">
                    {columns.map((column) => (
                      <td key={column.header} className={cn('px-4 py-3 text-ink', column.className)}>
                        {column.cell(record)}
                      </td>
                    ))}

                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {rowActions?.(record)}

                        {onEdit && (
                          <button
                            type="button"
                            onClick={() => onEdit(record)}
                            className="text-ink-muted hover:text-brand"
                          >
                            Edit
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => onToggle(record)}
                          disabled={busyId === record._id}
                          className="text-ink-muted hover:text-ink disabled:opacity-50"
                        >
                          {enabled ? 'Deactivate' : 'Activate'}
                        </button>

                        <button
                          type="button"
                          onClick={() => onDelete(record)}
                          className="text-ink-muted hover:text-danger"
                        >
                          Delete
                        </button>
                      </div>
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

export default ResourceListPage;

/** Shared status cell, since all four resources have one. */
export const StatusCell = ({ record }: { record: AdminRecord }) => (
  <Badge tone={isEnabled(record) ? 'success' : 'secondary'} size="sm">
    {isEnabled(record) ? 'Active' : 'Inactive'}
  </Badge>
);
