import { useNavigate } from 'react-router-dom';
import { ACTION_ICONS, RowAction } from '@/components/table';
import ResourceListPage, { StatusCell } from './ResourceListPage';
import { formatINR } from '@/lib/format';


/**
 * Products.
 *
 * The only one of the four whose create and edit are full pages rather than a
 * dialog - it carries variants and a three-to-six image upload, which is more
 * than a modal should hold.
 */
const ProductsPage = () => {
  const navigate = useNavigate();

  return (
    <ResourceListPage
      resource="products"
      title="Products"
      singular="Product"
      subtitle="Manage your product inventory"
      searchPlaceholder="Search by name…"
      filters={[
        {
          name: 'status',
          label: 'Status',
          allLabel: 'All',
          options: [
            { value: 'listed', label: 'Listed' },
            { value: 'unlisted', label: 'Unlisted' }
          ]
        }
      ]}
      onCreate={() => navigate('/admin/products/add')}
      onEdit={(record) => navigate(`/admin/products/${record._id}/edit`)}
      rowActions={(record) => (
        <RowAction
          icon={ACTION_ICONS.view}
          label="View product"
          onClick={() => navigate(`/admin/products/${record._id}`)}
        />
      )}
      columns={[
        {
          header: 'Product',
          cell: (record) => (
            <div className="flex items-center gap-3">
              {typeof record.mainImage === 'string' && (
                <img
                  src={record.mainImage}
                  alt=""
                  loading="lazy"
                  className="size-10 shrink-0 rounded object-cover"
                />
              )}
              <span className="font-medium">{String(record.productName ?? '')}</span>
            </div>
          )
        },
        {
          header: 'Brand',
          cell: (record) => {
            const brand = record.brand as { name?: string } | null;
            return brand?.name ?? <span className="text-ink-muted">—</span>;
          }
        },
        {
          header: 'Price',
          cell: (record) => formatINR(Number(record.regularPrice ?? 0))
        },
        {
          header: 'Stock',
          cell: (record) => {
            const stock = Number(record.totalStock ?? 0);
            return (
              <span className={stock === 0 ? 'font-medium text-danger' : undefined}>
                {stock === 0 ? 'Out of stock' : stock}
              </span>
            );
          }
        },
        { header: 'Status', cell: (record) => <StatusCell record={record} /> }
      ]}
    />
  );
};

export default ProductsPage;
