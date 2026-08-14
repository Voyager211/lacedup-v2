import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BsPlus, BsTrash } from 'react-icons/bs';
import {
  useCreateAdminRecordMutation,
  useGetAdminRecordQuery,
  useUpdateAdminRecordMutation
} from './admin.api';
import { useGetFilterOptionsQuery } from '@/features/catalog/catalog.api';
import Button from '@/components/Button';
import QueryBoundary from '@/components/QueryBoundary';
import { SkeletonText } from '@/components/Skeleton';
import ImageUploader from '@/components/form/ImageUploader';
import { SelectField, TextAreaField, TextField } from '@/components/form/TextField';
import { useToast } from '@/components/toast';
import { formatINR } from '@/lib/format';

/**
 * Add or edit a product.
 *
 * One component for both, where the EJS admin had two pages of ~1,500 lines
 * each - add-product and edit-product - differing mainly in whether the fields
 * started populated.
 *
 * Two server rules are mirrored here because breaking either produces a
 * rejection the shopper never sees and the admin has to decode:
 *
 *   - every variant's base price must be *below* the regular price, since the
 *     regular price is what gets struck through;
 *   - between three and six images.
 *
 * The server still enforces both. This only avoids inviting the rejection.
 */

interface VariantDraft {
  size: string;
  stock: string;
  basePrice: string;
  variantSpecificOffer: string;
}

const emptyVariant = (): VariantDraft => ({
  size: '',
  stock: '0',
  basePrice: '',
  variantSpecificOffer: '0'
});

const ProductFormPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const isEdit = Boolean(id);

  const { data: options } = useGetFilterOptionsQuery();
  const existing = useGetAdminRecordQuery(
    { resource: 'products', id: id ?? '' },
    { skip: !isEdit }
  );

  const [createRecord, { isLoading: isCreating }] = useCreateAdminRecordMutation();
  const [updateRecord, { isLoading: isUpdating }] = useUpdateAdminRecordMutation();

  const [productName, setProductName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [regularPrice, setRegularPrice] = useState('');
  const [productOffer, setProductOffer] = useState('0');
  const [features, setFeatures] = useState('');
  const [variants, setVariants] = useState<VariantDraft[]>([emptyVariant()]);
  const [images, setImages] = useState<string[]>([]);
  const [mainIndex, setMainIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Populate once the record arrives.
  useEffect(() => {
    const product = existing.data;
    if (!product) return;

    setProductName(String(product.productName ?? ''));
    setDescription(String(product.description ?? ''));
    setCategory(String((product.category as { _id?: string })?._id ?? product.category ?? ''));
    setBrand(String((product.brand as { _id?: string })?._id ?? product.brand ?? ''));
    setRegularPrice(String(product.regularPrice ?? ''));
    setProductOffer(String(product.productOffer ?? 0));
    setFeatures(
      Array.isArray(product.features) ? product.features.join(', ') : String(product.features ?? '')
    );

    const incoming = (product.variants as VariantDraft[] | undefined) ?? [];
    setVariants(
      incoming.length > 0
        ? incoming.map((variant) => ({
            size: String(variant.size ?? ''),
            stock: String(variant.stock ?? 0),
            basePrice: String(variant.basePrice ?? ''),
            variantSpecificOffer: String(variant.variantSpecificOffer ?? 0)
          }))
        : [emptyVariant()]
    );

    const main = String(product.mainImage ?? '');
    const subs = (product.subImages as string[] | undefined) ?? [];
    setImages([main, ...subs].filter(Boolean));
    setMainIndex(0);
  }, [existing.data]);

  const setVariant = (index: number, patch: Partial<VariantDraft>) =>
    setVariants((current) =>
      current.map((variant, i) => (i === index ? { ...variant, ...patch } : variant))
    );

  const validate = (): string | null => {
    if (!productName.trim()) return 'Give the product a name.';
    if (!category) return 'Choose a category.';
    if (!brand) return 'Choose a brand.';

    const price = Number(regularPrice);
    if (!Number.isFinite(price) || price <= 0) return 'Enter a regular price above zero.';

    if (variants.length === 0) return 'Add at least one size.';

    // Field problems are reported before the image requirement: fixing a typed
    // value is quicker than going to find photos, so it is the more useful
    // thing to be told first.
    for (const [index, variant] of variants.entries()) {
      if (!variant.size.trim()) return `Variant ${index + 1} needs a size.`;

      const base = Number(variant.basePrice);
      if (!Number.isFinite(base) || base <= 0) {
        return `Variant ${index + 1} (${variant.size}) needs a base price.`;
      }

      // The server refuses this, and its message is long; saying it here saves
      // a round trip and reads better.
      if (base >= price) {
        return `Variant ${index + 1} (${variant.size}): base price ${formatINR(base)} must be below the regular price ${formatINR(price)}.`;
      }
    }

    if (images.length < 3) {
      return `Add at least 3 images — there ${images.length === 1 ? 'is' : 'are'} ${images.length}.`;
    }

    if (images.length > 6) return 'Six images is the maximum.';

    return null;
  };

  const submit = async () => {
    const problem = validate();
    setError(problem);
    if (problem) return;

    // Images are ordered so the chosen main one is first, which is how the
    // server splits mainImage from subImages.
    const ordered = [images[mainIndex], ...images.filter((_, i) => i !== mainIndex)].filter(
      Boolean
    ) as string[];

    const body = {
      productName,
      description,
      category,
      brand,
      regularPrice,
      productOffer,
      features,
      // The server JSON.parses this one out of the body.
      variants: JSON.stringify(
        variants.map((variant) => ({
          size: variant.size,
          stock: Number(variant.stock) || 0,
          basePrice: Number(variant.basePrice),
          variantSpecificOffer: Number(variant.variantSpecificOffer) || 0
        }))
      ),
      base64Images: ordered,
      mainImageIndex: '0'
    };

    try {
      if (isEdit && id) await updateRecord({ resource: 'products', id, body }).unwrap();
      else await createRecord({ resource: 'products', body }).unwrap();

      toast.success(isEdit ? 'Product updated' : 'Product added');
      navigate('/admin/products');
    } catch (caught) {
      setError(
        String(
          (caught as { data?: { message?: string } })?.data?.message ??
            'Could not save that product.'
        )
      );
    }
  };

  return (
    <div className="max-w-3xl">
      <h1 className="mb-6 font-heading text-2xl font-semibold text-ink">
        {isEdit ? 'Edit product' : 'Add product'}
      </h1>

      <QueryBoundary
        isLoading={isEdit && existing.isLoading}
        error={isEdit ? existing.error : undefined}
        skeleton={<SkeletonText lines={10} />}
        onRetry={existing.refetch}
      >
        <div className="space-y-6 rounded-lg border border-line bg-white p-6">
          {error && (
            <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Product name"
              required
              containerClassName="sm:col-span-2"
              value={productName}
              onChange={(event) => setProductName(event.target.value)}
            />

            <TextAreaField
              label="Description"
              containerClassName="sm:col-span-2"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />

            <SelectField
              label="Category"
              required
              placeholder="Choose a category…"
              options={(options?.categories ?? []).map((c) => ({ value: c._id, label: c.name }))}
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            />

            <SelectField
              label="Brand"
              required
              placeholder="Choose a brand…"
              options={(options?.brands ?? []).map((b) => ({ value: b._id, label: b.name }))}
              value={brand}
              onChange={(event) => setBrand(event.target.value)}
            />

            <TextField
              label="Regular price"
              type="number"
              required
              hint="Shown struck through — every variant must be cheaper"
              value={regularPrice}
              onChange={(event) => setRegularPrice(event.target.value)}
            />

            <TextField
              label="Product offer (%)"
              type="number"
              min={0}
              max={100}
              value={productOffer}
              onChange={(event) => setProductOffer(event.target.value)}
            />

            <TextField
              label="Features"
              hint="Comma separated"
              containerClassName="sm:col-span-2"
              value={features}
              onChange={(event) => setFeatures(event.target.value)}
            />
          </div>

          <ImageUploader
            value={images}
            onChange={setImages}
            mainIndex={mainIndex}
            onMainIndexChange={setMainIndex}
          />

          <section>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-ink">Sizes</p>
              <Button
                size="sm"
                variant="outline"
                icon={<BsPlus className="size-4" aria-hidden="true" />}
                onClick={() => setVariants((current) => [...current, emptyVariant()])}
              >
                Add size
              </Button>
            </div>

            <ul className="space-y-3">
              {variants.map((variant, index) => (
                <li key={index} className="grid gap-3 rounded-md border border-line p-3 sm:grid-cols-5">
                  <TextField
                    label="Size"
                    value={variant.size}
                    onChange={(event) => setVariant(index, { size: event.target.value })}
                  />
                  <TextField
                    label="Stock"
                    type="number"
                    min={0}
                    value={variant.stock}
                    onChange={(event) => setVariant(index, { stock: event.target.value })}
                  />
                  <TextField
                    label="Base price"
                    type="number"
                    value={variant.basePrice}
                    onChange={(event) => setVariant(index, { basePrice: event.target.value })}
                  />
                  <TextField
                    label="Offer (%)"
                    type="number"
                    min={0}
                    max={100}
                    value={variant.variantSpecificOffer}
                    onChange={(event) =>
                      setVariant(index, { variantSpecificOffer: event.target.value })
                    }
                  />

                  <div className="flex items-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={variants.length === 1}
                      icon={<BsTrash className="size-4" aria-hidden="true" />}
                      onClick={() =>
                        setVariants((current) => current.filter((_, i) => i !== index))
                      }
                    >
                      Remove
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <div className="flex gap-3 border-t border-line pt-5">
            <Button loading={isCreating || isUpdating} onClick={submit}>
              {isEdit ? 'Save changes' : 'Add product'}
            </Button>
            <Button variant="outline" onClick={() => navigate('/admin/products')}>
              Cancel
            </Button>
          </div>
        </div>
      </QueryBoundary>
    </div>
  );
};

export default ProductFormPage;
