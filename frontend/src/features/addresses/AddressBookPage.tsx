import { useState } from 'react';
import { BsGeoAlt, BsPlus } from 'react-icons/bs';
import {
  useDeleteAddressMutation,
  useGetAddressesQuery,
  useSetDefaultAddressMutation
} from './address.api';
import AddressFormDialog from './AddressFormDialog';
import { AccountLayout } from '@/features/account/AccountNav';
import Button from '@/components/Button';
import EmptyState from '@/components/EmptyState';
import QueryBoundary from '@/components/QueryBoundary';
import { SkeletonText } from '@/components/Skeleton';
import { useConfirm } from '@/components/confirm/useConfirm';
import { useToast } from '@/components/toast';
import { cn } from '@/lib/cn';
import type { AddressLine } from '@/features/checkout/checkout.api';

/**
 * The address book.
 *
 * Reuses the dialog checkout uses, so adding an address behaves identically in
 * both places - the EJS pages shared a partial but wired it up differently.
 *
 * Pagination is gone. The server paginated at two per page, which is almost
 * certainly unintended and made a handful of addresses feel like a filing
 * cabinet. The list endpoint returns them all.
 */
const AddressBookPage = () => {
  const toast = useToast();
  const confirm = useConfirm();

  const { data, isLoading, error, refetch } = useGetAddressesQuery();
  const [deleteAddress] = useDeleteAddressMutation();
  const [setDefault] = useSetDefaultAddressMutation();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AddressLine | null>(null);

  const addresses = data?.addresses ?? [];

  const openAdd = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (address: AddressLine) => {
    setEditing(address);
    setDialogOpen(true);
  };

  return (
    <AccountLayout title="Your addresses">
      <div className="mb-4 flex justify-end">
        <Button icon={<BsPlus className="size-4" aria-hidden="true" />} onClick={openAdd}>
          Add an address
        </Button>
      </div>

      <QueryBoundary
        isLoading={isLoading}
        error={error}
        isEmpty={addresses.length === 0}
        skeleton={<SkeletonText lines={6} />}
        empty={
          <EmptyState
            icon={<BsGeoAlt className="size-14" />}
            title="No addresses yet"
            message="Add one and it will be ready at checkout."
            action={<Button onClick={openAdd}>Add an address</Button>}
          />
        }
        onRetry={refetch}
      >
        <ul className="grid gap-4 sm:grid-cols-2">
          {addresses.map((address, index) => (
            <li
              key={address._id ?? index}
              className={cn(
                'rounded-lg border bg-white p-5',
                address.isDefault ? 'border-brand' : 'border-line'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-ink">{address.name}</p>
                <span className="rounded bg-card px-2 py-0.5 text-xs text-ink-muted">
                  {address.addressType}
                </span>
              </div>

              {address.isDefault && (
                <p className="mt-1 text-xs font-medium text-brand">Default address</p>
              )}

              <p className="mt-2 text-sm text-ink-muted">
                {address.landMark}, {address.city}
                <br />
                {address.district && `${address.district}, `}
                {address.state} — {address.pincode}
                <br />
                {address.phone}
              </p>

              <div className="mt-4 flex flex-wrap gap-3 border-t border-line pt-3 text-sm">
                <button
                  type="button"
                  onClick={() => openEdit(address)}
                  className="text-ink-muted hover:text-brand"
                >
                  Edit
                </button>

                {!address.isDefault && address._id && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await setDefault(address._id!).unwrap();
                        toast.success('Default address updated');
                      } catch (caught) {
                        toast.fromError(caught, 'Could not update that.');
                      }
                    }}
                    className="text-ink-muted hover:text-brand"
                  >
                    Make default
                  </button>
                )}

                {address._id && (
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await confirm({
                        title: 'Delete this address?',
                        message: 'You can always add it again later.',
                        confirmLabel: 'Delete',
                        tone: 'danger'
                      });
                      if (!ok) return;

                      try {
                        await deleteAddress(address._id!).unwrap();
                        toast.success('Address deleted');
                      } catch (caught) {
                        toast.fromError(caught, 'Could not delete that address.');
                      }
                    }}
                    className="text-ink-muted hover:text-danger"
                  >
                    Delete
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </QueryBoundary>

      <AddressFormDialog open={dialogOpen} onOpenChange={setDialogOpen} address={editing} />
    </AccountLayout>
  );
};

export default AddressBookPage;
