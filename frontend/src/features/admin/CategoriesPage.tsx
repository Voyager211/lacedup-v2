import { useState } from 'react';
import ResourceListPage, { StatusCell } from './ResourceListPage';
import ResourceFormDialog from './ResourceFormDialog';
import { CATALOG, CatalogImage, type CatalogConfig } from './catalogConfig';
import type { AdminRecord } from './admin.api';

/**
 * Categories and brands.
 *
 * Two 1,800-line EJS pages that were structurally identical - same table, same
 * modals, same cropper, same twelve SweetAlert calls. One component, two
 * configurations, which live in catalogConfig so the detail pages share them.
 */

const STATUS_FILTER = {
  name: 'status',
  label: 'Status',
  allLabel: 'All',
  options: [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' }
  ]
};

const CatalogPage = ({ config }: { config: CatalogConfig }) => {
  const { resource, title, singular, subtitle, offerField, path, fields } = config;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminRecord | null>(null);

  const open = (record: AdminRecord | null) => {
    setEditing(record);
    setDialogOpen(true);
  };

  return (
    <>
      <ResourceListPage
        resource={resource}
        title={title}
        singular={singular}
        subtitle={subtitle}
        filters={[STATUS_FILTER]}
        onCreate={() => open(null)}
        onEdit={open}
        rowHref={(record) => `${path}/${record._id}`}
        columns={[
          {
            header: 'Name',
            cell: (record) => (
              <div className="flex items-center gap-3">
                <CatalogImage src={record.image} width={80} className="size-10 rounded" />
                <span className="font-medium">{String(record.name ?? '')}</span>
              </div>
            )
          },
          {
            header: 'Offer',
            cell: (record) => {
              const offer = Number(record[offerField] ?? 0);
              return offer > 0 ? `${offer}%` : <span className="text-ink-muted">—</span>;
            }
          },
          { header: 'Status', cell: (record) => <StatusCell record={record} /> }
        ]}
      />

      <ResourceFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        resource={resource}
        record={editing}
        title={editing ? `Edit ${singular.toLowerCase()}` : `Add ${singular.toLowerCase()}`}
        fields={fields}
      />
    </>
  );
};

export const CategoriesPage = () => <CatalogPage config={CATALOG.categories} />;

export const BrandsPage = () => <CatalogPage config={CATALOG.brands} />;
