import { useState } from 'react';
import ResourceListPage, { StatusCell } from './ResourceListPage';
import ResourceFormDialog, { type FieldDefinition } from './ResourceFormDialog';
import type { AdminRecord, ResourceKey } from './admin.api';

/**
 * Categories and brands.
 *
 * Two 1,800-line EJS pages that were structurally identical - same table, same
 * modals, same cropper, same twelve SweetAlert calls. One component, two
 * configurations.
 *
 * The `%` offer applies to every product in the category or brand, and the
 * largest applicable offer wins at checkout - which is why it belongs on this
 * form rather than only on products.
 */

const OFFER_FIELD: FieldDefinition = {
  name: 'categoryOffer',
  label: 'Offer (%)',
  type: 'number',
  hint: 'Applied to every product in this category. The largest applicable offer wins.',
  min: 0,
  max: 100
};

const catalogFields = (offerName: string): FieldDefinition[] => [
  { name: 'name', label: 'Name', required: true },
  { name: 'description', label: 'Description', type: 'textarea' },
  { ...OFFER_FIELD, name: offerName }
];

const STATUS_FILTER = {
  name: 'status',
  label: 'Status',
  allLabel: 'All',
  options: [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' }
  ]
};

const CatalogPage = ({
  resource,
  title,
  singular,
  subtitle,
  offerField
}: {
  resource: Extract<ResourceKey, 'categories' | 'brands'>;
  title: string;
  singular: string;
  subtitle: string;
  offerField: string;
}) => {
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
        columns={[
          { header: 'Name', cell: (record) => <span className="font-medium">{String(record.name ?? '')}</span> },
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
        fields={catalogFields(offerField)}
      />
    </>
  );
};

export const CategoriesPage = () => (
  <CatalogPage
    resource="categories"
    title="Categories"
    singular="Category"
    subtitle="Organize and manage product categories"
    offerField="categoryOffer"
  />
);

export const BrandsPage = () => (
  <CatalogPage
    resource="brands"
    title="Brands"
    singular="Brand"
    subtitle="Organize and manage product brands"
    offerField="brandOffer"
  />
);
