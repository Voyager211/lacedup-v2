import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, SquarePen } from 'lucide-react';
import { useGetAdminRecordQuery, useGetCatalogProductsQuery } from './admin.api';
import ResourceFormDialog from './ResourceFormDialog';
import { StatusCell } from './ResourceListPage';
import { CATALOG, CatalogImage, type CatalogConfig } from './catalogConfig';
import Badge from '@/components/Badge';
import EmptyState from '@/components/EmptyState';
import PageHeader, { HeaderAction } from '@/components/PageHeader';
import Pagination from '@/components/Pagination';
import QueryBoundary from '@/components/QueryBoundary';
import { Skeleton, SkeletonTable } from '@/components/Skeleton';
import { RowNumber, RowNumberHeader, useRowLink } from '@/components/table';
import { usePageCrumb } from '@/components/layout/crumbLabel';
import { formatINR } from '@/lib/format';
import { cn } from '@/lib/cn';

/**
 * A category's or a brand's own page: its artwork, its offer, and every
 * product under it with the price it sells at.
 *
 * One component for both, like the list, since the two differ only in names
 * and which offer field they carry.
 *
 * Prices come from the server. This page's offer is one of four that compete
 * to set each price and the largest wins, so a product here can be selling at
 * a price some other offer set - only the server's figure says which.
 *
 * The products page is in the URL (`?page=2`), as on every list, so coming
 * back from a product lands where it was opened from.
 */

const priceRange = (min: number, max: number) =>
  min === max ? formatINR(min) : `${formatINR(min)} – ${formatINR(max)}`;

const CatalogDetailPage = ({ config }: { config: CatalogConfig }) => {
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const rowLink = useRowLink();
  const [editing, setEditing] = useState(false);

  const page = Number(params.get('page')) || 1;

  const record = useGetAdminRecordQuery({ resource: config.resource, id }, { skip: !id });
  const products = useGetCatalogProductsQuery(
    { resource: config.resource, id, page },
    { skip: !id }
  );

  const item = record.data;
  const name = typeof item?.name === 'string' ? item.name : undefined;
  const description = typeof item?.description === 'string' ? item.description.trim() : '';
  const offer = Number(item?.[config.offerField] ?? 0);
  const rows = products.data?.products ?? [];
  const singular = config.singular.toLowerCase();

  // Names the last crumb, which would otherwise read "Details".
  usePageCrumb(name);

  const goToPage = (next: number) => {
    const nextParams = new URLSearchParams(params);
    nextParams.set('page', String(next));
    setParams(nextParams);
  };

  return (
    <div>
      <PageHeader
        title={name ?? config.singular}
        actions={
          <>
            <HeaderAction
              tone="neutral"
              to={config.path}
              icon={<ArrowLeft className="size-4" aria-hidden="true" />}
            >
              Back to List
            </HeaderAction>

            {item && (
              <HeaderAction
                icon={<SquarePen className="size-4" aria-hidden="true" />}
                onClick={() => setEditing(true)}
              >
                Edit {config.singular}
              </HeaderAction>
            )}
          </>
        }
      />

      <QueryBoundary
        isLoading={record.isLoading}
        error={record.error}
        skeleton={
          <div className="grid gap-6 md:grid-cols-[16rem_minmax(0,1fr)]">
            <Skeleton className="aspect-square w-full" />
            <div className="space-y-3">
              {[0, 1, 2, 3].map((row) => (
                <Skeleton key={row} className="h-6 w-full" />
              ))}
            </div>
          </div>
        }
        onRetry={record.refetch}
      >
        {item && (
          <>
            <div className="grid gap-6 md:grid-cols-[16rem_minmax(0,1fr)]">
              <div className="overflow-hidden rounded-lg border border-line bg-white">
                <CatalogImage src={item.image} width={512} className="aspect-square w-full" />
              </div>

              <section className="space-y-5">
                <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-3 rounded-lg border border-line bg-white p-5 text-sm">
                  <dt className="text-ink-muted">Name</dt>
                  <dd className="font-medium text-ink">{name}</dd>

                  <dt className="text-ink-muted">Active offer</dt>
                  <dd>
                    {offer > 0 ? (
                      <Badge size="sm" tone="success">
                        {offer}% off
                      </Badge>
                    ) : (
                      <span className="text-ink">None</span>
                    )}
                  </dd>

                  <dt className="text-ink-muted">Status</dt>
                  <dd>
                    <StatusCell record={item} />
                  </dd>

                  <dt className="text-ink-muted">Products</dt>
                  <dd className="tabular-nums text-ink">{products.data?.totalRecords ?? '—'}</dd>
                </dl>

                {description && (
                  <section className="rounded-lg border border-line bg-white p-5">
                    <h2 className="mb-2 font-heading text-lg font-semibold text-ink">Description</h2>
                    <p className="whitespace-pre-line text-sm text-ink-muted">{description}</p>
                  </section>
                )}
              </section>
            </div>

            <section className="mt-6">
              <h2 className="mb-3 font-heading text-lg font-semibold text-ink">Products</h2>

              <QueryBoundary
                isLoading={products.isLoading}
                error={products.error}
                isEmpty={rows.length === 0}
                skeleton={<SkeletonTable rows={5} columns={6} />}
                empty={<EmptyState title={`No products in this ${singular} yet`} />}
                onRetry={products.refetch}
              >
                <div
                  className={cn(
                    'overflow-x-auto rounded-lg border border-line bg-white',
                    products.isFetching && 'opacity-60'
                  )}
                >
                  <table className="w-full text-sm">
                    <thead className="border-b border-line bg-card/50 text-left">
                      <tr>
                        <RowNumberHeader />
                        <th className="px-4 py-3 font-medium text-ink">Product</th>
                        <th className="px-4 py-3 text-right font-medium text-ink">Regular price</th>
                        <th className="px-4 py-3 text-right font-medium text-ink">Selling price</th>
                        <th className="px-4 py-3 font-medium text-ink">Stock</th>
                        <th className="px-4 py-3 font-medium text-ink">Status</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-line">
                      {rows.map((product, index) => (
                        <tr key={product._id} {...rowLink(`/admin/products/${product._id}`)}>
                          <RowNumber index={index} page={products.data?.currentPage ?? page} />
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <CatalogImage
                                src={product.mainImage}
                                width={80}
                                className="size-10 rounded"
                              />
                              <span className="font-medium text-ink">{product.productName}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-ink-muted">
                            {formatINR(product.regularPrice)}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-ink">
                            {priceRange(product.minPrice, product.maxPrice)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={
                                product.totalStock === 0 ? 'font-medium text-danger' : 'text-ink'
                              }
                            >
                              {product.totalStock === 0 ? 'Out of stock' : product.totalStock}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <Badge size="sm" tone={product.isListed ? 'success' : 'secondary'}>
                              {product.isListed ? 'Listed' : 'Unlisted'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {(products.data?.totalPages ?? 0) > 1 && (
                  <Pagination
                    className="mt-6"
                    currentPage={products.data?.currentPage ?? 1}
                    totalPages={products.data?.totalPages ?? 1}
                    disabled={products.isFetching}
                    onPageChange={goToPage}
                  />
                )}
              </QueryBoundary>
            </section>

            <ResourceFormDialog
              open={editing}
              onOpenChange={setEditing}
              resource={config.resource}
              record={item}
              title={`Edit ${singular}`}
              fields={config.fields}
            />
          </>
        )}
      </QueryBoundary>
    </div>
  );
};

export const CategoryDetailPage = () => <CatalogDetailPage config={CATALOG.categories} />;

export const BrandDetailPage = () => <CatalogDetailPage config={CATALOG.brands} />;
