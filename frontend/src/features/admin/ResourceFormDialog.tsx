import { useEffect, useState } from 'react';
import {
  useCreateAdminRecordMutation,
  useUpdateAdminRecordMutation,
  type AdminRecord,
  type ResourceKey
} from './admin.api';
import Modal from '@/components/Modal';
import Button from '@/components/Button';
import { SelectField, TextAreaField, TextField } from '@/components/form/TextField';
import { useToast } from '@/components/toast';

/**
 * A create/edit dialog described by a field list.
 *
 * Categories, brands and coupons each had their own add and edit modals - six
 * modals across three pages, all doing the same thing with different labels.
 * This is one dialog and three field lists.
 *
 * Validation is deliberately thin here and the server's message is what gets
 * shown: these forms are small, and duplicating the coupon rules (date window,
 * usage limits, minimum order value) client-side would create exactly the
 * drift the storefront schemas were written to avoid.
 */
export interface FieldDefinition {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'textarea' | 'select' | 'date' | 'datetime-local' | 'checkbox';
  required?: boolean;
  hint?: string;
  options?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
  /** Half-width on wider screens. */
  half?: boolean;
}

export interface ResourceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resource: ResourceKey;
  record: AdminRecord | null;
  title: string;
  fields: FieldDefinition[];
}

/** `datetime-local` needs `YYYY-MM-DDTHH:mm`, which an ISO string is not. */
const toInputValue = (value: unknown, type: FieldDefinition['type']): string => {
  if (value == null) return '';

  if (type === 'date' || type === 'datetime-local') {
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return '';

    const iso = new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString();
    return type === 'date' ? iso.slice(0, 10) : iso.slice(0, 16);
  }

  return String(value);
};

const ResourceFormDialog = ({
  open,
  onOpenChange,
  resource,
  record,
  title,
  fields
}: ResourceFormDialogProps) => {
  const toast = useToast();
  const [createRecord, { isLoading: isCreating }] = useCreateAdminRecordMutation();
  const [updateRecord, { isLoading: isUpdating }] = useUpdateAdminRecordMutation();

  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [error, setError] = useState<string | null>(null);

  // Reset on open so an edit never inherits the previous record's values, and
  // a create never inherits an edit's.
  useEffect(() => {
    if (!open) return;

    setError(null);
    setValues(
      Object.fromEntries(
        fields.map((field) => [
          field.name,
          field.type === 'checkbox'
            ? Boolean(record?.[field.name] ?? true)
            : toInputValue(record?.[field.name], field.type)
        ])
      )
    );
  }, [open, record, fields]);

  const submit = async () => {
    setError(null);

    const missing = fields.find(
      (field) => field.required && !String(values[field.name] ?? '').trim()
    );

    if (missing) {
      setError(`${missing.label} is required.`);
      return;
    }

    try {
      if (record?._id) {
        await updateRecord({ resource, id: record._id, body: values }).unwrap();
        toast.success('Saved');
      } else {
        await createRecord({ resource, body: values }).unwrap();
        toast.success('Created');
      }

      onOpenChange(false);
    } catch (caught) {
      // The server's own wording - it knows the rules this form does not
      // duplicate.
      setError(
        String(
          (caught as { data?: { message?: string; error?: string } })?.data?.message ??
            (caught as { data?: { error?: string } })?.data?.error ??
            'Could not save that.'
        )
      );
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button loading={isCreating || isUpdating} onClick={submit}>
            {record ? 'Save changes' : 'Create'}
          </Button>
        </>
      }
    >
      {error && (
        <p role="alert" className="mb-4 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((field) => {
          const value = values[field.name];
          const containerClassName = field.half ? undefined : 'sm:col-span-2';

          const onChange = (next: string | boolean) =>
            setValues((current) => ({ ...current, [field.name]: next }));

          if (field.type === 'checkbox') {
            return (
              <label
                key={field.name}
                className="flex items-center gap-2 text-sm text-ink sm:col-span-2"
              >
                <input
                  type="checkbox"
                  checked={Boolean(value)}
                  onChange={(event) => onChange(event.target.checked)}
                />
                {field.label}
              </label>
            );
          }

          if (field.type === 'textarea') {
            return (
              <TextAreaField
                key={field.name}
                label={field.label}
                required={field.required}
                hint={field.hint}
                containerClassName={containerClassName}
                value={String(value ?? '')}
                onChange={(event) => onChange(event.target.value)}
              />
            );
          }

          if (field.type === 'select') {
            return (
              <SelectField
                key={field.name}
                label={field.label}
                required={field.required}
                hint={field.hint}
                options={field.options ?? []}
                containerClassName={containerClassName}
                value={String(value ?? '')}
                onChange={(event) => onChange(event.target.value)}
              />
            );
          }

          return (
            <TextField
              key={field.name}
              label={field.label}
              type={field.type ?? 'text'}
              required={field.required}
              hint={field.hint}
              min={field.min}
              max={field.max}
              containerClassName={containerClassName}
              value={String(value ?? '')}
              onChange={(event) => onChange(event.target.value)}
            />
          );
        })}
      </div>
    </Modal>
  );
};

export default ResourceFormDialog;
