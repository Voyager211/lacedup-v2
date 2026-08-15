import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BsPencil, BsArrowLeft } from 'react-icons/bs';
import { useGetAdminProductDetailQuery } from './admin.api';
import Badge from '@/components/Badge';
import Button from '@/components/Button';
import QueryBoundary from '@/components/QueryBoundary';
import { Skeleton } from '@/components/Skeleton';
import { formatINR } from '@/lib/format';
import { cn } from '@/lib/cn';
import { ROW_HOVER, RowNumber, RowNumberHeader } from '@/components/table';

/**
 * The admin product detail view - read-only.
 *
 * Its reason to exist is the offer maths. A variant's price can be set by four
 * competing offers (product, brand, category, variant-specific) and the highest
 * wins; the controller resolves that and sends both the winning percentage and
 * its source per variant. This page shows the result and the workings, so an
 * admin can answer "why is this shoe selling at that price" without reading
 * code. Everything here is server-computed - nothing is recalculated client
 * side, or the page could disagree with the storefront.
 *
 * Editing lives in `<ProductFormPage>`; this page only links to it.
 */

const OFFER_TONE: Record<string, 'primary' | 'info' | 'success' | 'warning'> = {
  Product: 'primary',
  Brand: 'info',
  Category: 'success',
  Variant: 'warning'
};

const stockTone = (stock: number) =>
  stock === 0 ? 'danger' : stock <= 5 ? 'warning' : 'success';

const AdminProductDetailPage = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useGetAdminProductDetailQuery(id, { skip: !id });

  const [active, setActive] = useState(0);

  const product = data?.product;
  const images = data?.allImages ?? [];
  const offers = data?.activeOffers ?? [];
  const variants = product?.variants ?? [];

  const totalStock = variants.reduce((sum, variant) => sum + Number(variant.stock ?? 0), 0);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            to="/admin/products"
            className="text-ink-muted transition-colors hover:text-ink"
            aria-label="Back to products"
          >
            <BsArrowLeft className="size-5" aria-hidden="true" />
          </Link>
          <h1 className="font-heading text-2xl font-semibold text-ink">
            {product?.productName ?? 'Product'}
          </h1>
        </div>

        {product && (
          <Button
            size="sm"
            icon={<BsPencil className="size-4" aria-hidden="true" />}
            onClick={() => navigate(`/admin/products/${product._id}/edit`)}
          >
            Edit
          </Button>
        )}
      </div>

      <QueryBoundary
        isLoading={isLoading}
        error={error}
        skeleton={
          <div className="grid gap-6 lg:grid-cols-2">
            <Skeleton className="aspect-square w-full" />
            <div className="space-y-3">
              {[0, 1, 2, 3, 4].map((row) => (
                <Skeleton key={row} className="h-6 w-full" />
              ))}
            </div>
          </div>
        }
        onRetry={refetch}
      >
        {product && (
          <>
            <div className="grid gap-6 lg:grid-cols-2">
              <section>
                <div className="overflow-hidden rounded-lg border border-line bg-white">
                  <img
                    src={images[active] ?? product.mainImage}
                    alt={product.productName}
                    className="aspect-square w-full object-contain"
                  />
                </div>

                {images.length > 1 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {images.map((image, index) => (
                      <button
                        key={image}
                        type="button"
                        onClick={() => setActive(index)}
                        aria-label={`Image ${index + 1}`}
                        aria-current={index === active}
                        className={cn(
                          'size-16 overflow-hidden rounded border bg-white transition-colors',
                          index === active ? 'border-brand' : 'border-line hover:border-ink-muted'
                        )}
                      >
                        <img src={image} alt="" className="size-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </section>

              <section className="space-y-5">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-line bg-white p-5 text-sm">
                  <dt className="text-ink-muted">Brand</dt>
                  <dd className="text-ink">{product.brand?.name ?? '—'}</dd>

                  <dt className="text-ink-muted">Category</dt>
                  <dd className="text-ink">{product.category?.name ?? '—'}</dd>

                  <dt className="text-ink-muted">Regular price</dt>
                  <dd className="text-ink">{formatINR(product.regularPrice)}</dd>

                  <dt className="text-ink-muted">Total stock</dt>
                  <dd>
                    <Badge size="sm" tone={stockTone(totalStock)}>
                      {totalStock} in stock
                    </Badge>
                  </dd>

                  <dt className="text-ink-muted">Status</dt>
                  <dd>
                    <Badge size="sm" tone={product.isListed === false ? 'secondary' : 'success'}>
                      {product.isListed === false ? 'Unlisted' : 'Listed'}
                    </Badge>
                  </dd>

                  <dt className="text-ink-muted">Sold</dt>
                  <dd className="text-ink">{product.sold ?? 0}</dd>
                </dl>

                <section className="rounded-lg border border-line bg-white p-5">
                  <h2 className="mb-3 font-heading text-lg font-semibold text-ink">Active offers</h2>

                  {offers.length === 0 ? (
                    <p className="text-sm text-ink-muted">
                      No offers apply — every variant sells at its base price.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {/* Sorted highest-first by the controller: the first one
                          is the one that wins wherever it applies. */}
                      {offers.map((offer) => (
                        <li key={`${offer.type}-${offer.name}`} className="flex items-center gap-2 text-sm">
                          <Badge size="sm" tone={OFFER_TONE[offer.type] ?? 'secondary'}>
                            {offer.type}
                          </Badge>
                          <span className="text-ink">{offer.label}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {product.description && (
                  <section className="rounded-lg border border-line bg-white p-5">
                    <h2 className="mb-2 font-heading text-lg font-semibold text-ink">Description</h2>
                    <p className="whitespace-pre-line text-sm text-ink-muted">
                      {product.description}
                    </p>
                  </section>
                )}
              </section>
            </div>

            <section className="mt-6">
              <h2 className="mb-3 font-heading text-lg font-semibold text-ink">Variants</h2>

              {variants.length === 0 ? (
                <p className="rounded-lg border border-line bg-white p-5 text-sm text-ink-muted">
                  No variants
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-line bg-white">
                  <table className="w-full text-sm">
                    <thead className="border-b border-line bg-card/50 text-left">
                      <tr>
                        <RowNumberHeader />
                        <th className="px-4 py-3 font-medium text-ink">Size</th>
                        <th className="px-4 py-3 font-medium text-ink">SKU</th>
                        <th className="px-4 py-3 font-medium text-ink">Stock</th>
                        <th className="px-4 py-3 text-right font-medium text-ink">Base price</th>
                        <th className="px-4 py-3 font-medium text-ink">Offer applied</th>
                        <th className="px-4 py-3 text-right font-medium text-ink">Selling price</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-line">
                      {variants.map((variant, index) => (
                        <tr key={variant._id} className={ROW_HOVER}>
                          <RowNumber index={index} perPage={variants.length} />
                          <td className="px-4 py-3 text-ink">{variant.size}</td>
                          <td className="px-4 py-3 font-mono text-xs text-ink-muted">
                            {variant.sku ?? '—'}
                          </td>
                          <td className="px-4 py-3">
                            <Badge size="sm" tone={stockTone(Number(variant.stock ?? 0))}>
                              {variant.stock}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right text-ink-muted">
                            {formatINR(variant.basePrice)}
                          </td>
                          <td className="px-4 py-3">
                            {variant.appliedOffer ? (
                              <span className="flex items-center gap-2">
                                <Badge size="sm" tone={OFFER_TONE[variant.offerSource ?? ''] ?? 'secondary'}>
                                  {variant.offerSource}
                                </Badge>
                                <span className="text-ink-muted">{variant.appliedOffer}%</span>
                              </span>
                            ) : (
                              <span className="text-ink-muted">None</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-ink">
                            {formatINR(variant.calculatedFinalPrice ?? variant.basePrice)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </QueryBoundary>
    </div>
  );
};

export default AdminProductDetailPage;
