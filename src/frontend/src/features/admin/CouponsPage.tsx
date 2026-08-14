import { useState } from 'react';
import ResourceListPage, { StatusCell } from './ResourceListPage';
import ResourceFormDialog, { type FieldDefinition } from './ResourceFormDialog';
import { formatDate, formatINR } from '@/lib/format';
import type { AdminRecord } from './admin.api';

/**
 * Coupons.
 *
 * The EJS page rendered these as a card grid rather than a table; a table is
 * used here because the interesting columns - value, window, usage - line up
 * for comparison, which is what an admin actually does with a coupon list.
 *
 * The form deliberately does not restate the server's rules (date window,
 * usage and per-user limits, minimum order value). It validates presence and
 * shows what the server says, so the two cannot disagree.
 */
const COUPON_FIELDS: FieldDefinition[] = [
  { name: 'code', label: 'Code', required: true, half: true, hint: 'Shown to shoppers in capitals' },
  { name: 'name', label: 'Name', required: true, half: true },
  { name: 'description', label: 'Description', type: 'textarea' },
  {
    name: 'discountType',
    label: 'Discount type',
    type: 'select',
    required: true,
    half: true,
    options: [
      { value: 'percentage', label: 'Percentage' },
      { value: 'fixed', label: 'Fixed amount' }
    ]
  },
  { name: 'discountValue', label: 'Discount value', type: 'number', required: true, half: true },
  {
    name: 'maximumDiscountAmount',
    label: 'Maximum discount',
    type: 'number',
    half: true,
    hint: 'Caps a percentage discount'
  },
  { name: 'minimumOrderValue', label: 'Minimum order value', type: 'number', half: true },
  { name: 'usageLimit', label: 'Total uses', type: 'number', half: true },
  { name: 'userLimit', label: 'Uses per shopper', type: 'number', half: true },
  { name: 'validFrom', label: 'Valid from', type: 'datetime-local', required: true, half: true },
  { name: 'validTo', label: 'Valid until', type: 'datetime-local', required: true, half: true },
  { name: 'isActive', label: 'Active', type: 'checkbox' }
];

const CouponsPage = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminRecord | null>(null);

  const open = (record: AdminRecord | null) => {
    setEditing(record);
    setDialogOpen(true);
  };

  return (
    <>
      <ResourceListPage
        resource="coupons"
        title="Coupons"
        singular="Coupon"
        searchPlaceholder="Search by code or name…"
        filters={[
          {
            name: 'status',
            label: 'Status',
            allLabel: 'All',
            options: [
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
              // The server derives this one from validTo, so it is not the
              // inverse of `isActive`.
              { value: 'expired', label: 'Expired' }
            ]
          }
        ]}
        onCreate={() => open(null)}
        onEdit={open}
        columns={[
          {
            header: 'Code',
            cell: (record) => (
              <span className="font-mono font-medium">{String(record.code ?? '')}</span>
            )
          },
          { header: 'Name', cell: (record) => String(record.name ?? '') },
          {
            header: 'Discount',
            cell: (record) =>
              record.discountType === 'percentage'
                ? `${Number(record.discountValue ?? 0)}%`
                : formatINR(Number(record.discountValue ?? 0))
          },
          {
            header: 'Valid until',
            cell: (record) => formatDate(record.validTo as string)
          },
          {
            header: 'Used',
            cell: (record) => {
              const used = Number(record.usedCount ?? (record.usedBy as unknown[])?.length ?? 0);
              const limit = Number(record.usageLimit ?? 0);
              return limit > 0 ? `${used} / ${limit}` : String(used);
            }
          },
          { header: 'Status', cell: (record) => <StatusCell record={record} /> }
        ]}
      />

      <ResourceFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        resource="coupons"
        record={editing}
        title={editing ? 'Edit coupon' : 'Add coupon'}
        fields={COUPON_FIELDS}
      />
    </>
  );
};

export default CouponsPage;
