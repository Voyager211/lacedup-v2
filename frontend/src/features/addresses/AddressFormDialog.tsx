import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  useAddAddressMutation,
  useGetStatesDistrictsQuery,
  useUpdateAddressMutation
} from './address.api';
import { addressSchema, type AddressValues } from '@/lib/schemas';
import Modal from '@/components/Modal';
import Button from '@/components/Button';
import { SelectField, TextField } from '@/components/form/TextField';
import { useToast } from '@/components/toast';
import type { AddressLine } from '@/features/checkout/checkout.api';

/**
 * Add or edit an address.
 *
 * Replaces `partials/addresses.ejs` - 927 lines included by both the checkout
 * page and the address book, each wiring it up slightly differently. One
 * dialog, one schema, two callers.
 *
 * The state and district lists are fetched, not bundled. The old form shipped
 * ~700 districts as a JavaScript literal on every page that included it, while
 * the same data was already available from an endpoint.
 *
 * Geoapify autocomplete is deliberately not carried over: it needed an API key
 * in the page, and a state/district pair plus a validated pincode is what the
 * backend actually stores.
 */
const ADDRESS_TYPES = [
  { value: 'Home', label: 'Home' },
  { value: 'Work', label: 'Work' },
  { value: 'Other', label: 'Other' }
];

export interface AddressFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing; absent when adding. */
  address?: AddressLine | null;
  onSaved?: () => void;
}

const AddressFormDialog = ({ open, onOpenChange, address, onSaved }: AddressFormDialogProps) => {
  const toast = useToast();
  const { data: statesDistricts } = useGetStatesDistrictsQuery();
  const [addAddress] = useAddAddressMutation();
  const [updateAddress] = useUpdateAddressMutation();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm<AddressValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: { addressType: 'Home' }
  });

  // Reset when the dialog opens so an edit never inherits the previous
  // address's values, and a fresh add never inherits an edit's.
  useEffect(() => {
    if (!open) return;

    reset(
      address
        ? {
            name: address.name,
            phone: address.phone,
            altPhone: address.altPhone ?? '',
            addressType: (address.addressType as AddressValues['addressType']) ?? 'Home',
            landMark: address.landMark,
            city: address.city,
            district: address.district ?? '',
            state: address.state,
            pincode: address.pincode
          }
        : { addressType: 'Home' }
    );
  }, [open, address, reset]);

  const selectedState = watch('state');

  const stateOptions = useMemo(
    () =>
      Object.values(statesDistricts ?? {})
        .map((entry) => ({ value: entry.name, label: entry.name }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [statesDistricts]
  );

  const districtOptions = useMemo(() => {
    const entry = Object.values(statesDistricts ?? {}).find(
      (candidate) => candidate.name === selectedState
    );

    return (entry?.districts ?? []).map((district) => ({ value: district, label: district }));
  }, [statesDistricts, selectedState]);

  const onSubmit = async (values: AddressValues) => {
    try {
      if (address?._id) await updateAddress({ addressId: address._id, address: values }).unwrap();
      else await addAddress(values).unwrap();

      toast.success(address ? 'Address updated' : 'Address added');
      onOpenChange(false);
      onSaved?.();
    } catch (caught) {
      toast.fromError(caught, 'Could not save that address.');
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={address ? 'Edit address' : 'Add an address'}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button loading={isSubmitting} onClick={handleSubmit(onSubmit)}>
            {address ? 'Save changes' : 'Add address'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Full name"
          required
          autoComplete="name"
          error={errors.name?.message}
          {...register('name')}
        />

        <TextField
          label="Phone"
          required
          inputMode="numeric"
          autoComplete="tel"
          error={errors.phone?.message}
          {...register('phone')}
        />

        <TextField
          label="Alternate phone"
          inputMode="numeric"
          hint="Optional"
          error={errors.altPhone?.message}
          {...register('altPhone')}
        />

        <SelectField
          label="Address type"
          required
          options={ADDRESS_TYPES}
          error={errors.addressType?.message}
          {...register('addressType')}
        />

        <TextField
          label="Landmark"
          required
          containerClassName="sm:col-span-2"
          error={errors.landMark?.message}
          {...register('landMark')}
        />

        <SelectField
          label="State"
          required
          placeholder="Select a state…"
          options={stateOptions}
          error={errors.state?.message}
          {...register('state', {
            // Districts belong to a state, so keeping the old one after a
            // change would submit a mismatched pair.
            onChange: () => setValue('district', '')
          })}
        />

        <SelectField
          label="District"
          required
          placeholder={selectedState ? 'Select a district…' : 'Choose a state first'}
          options={districtOptions}
          disabled={districtOptions.length === 0}
          error={errors.district?.message}
          {...register('district')}
        />

        <TextField
          label="City"
          required
          autoComplete="address-level2"
          error={errors.city?.message}
          {...register('city')}
        />

        <TextField
          label="Pincode"
          required
          inputMode="numeric"
          autoComplete="postal-code"
          error={errors.pincode?.message}
          {...register('pincode')}
        />
      </form>
    </Modal>
  );
};

export default AddressFormDialog;
