import { ImageOff } from 'lucide-react';
import type { CatalogResource } from './admin.api';
import type { FieldDefinition } from './ResourceFormDialog';
import { cloudinaryUrl } from '@/lib/cloudinary';
import { cn } from '@/lib/cn';

/**
 * What differs between categories and brands, in one place.
 *
 * The list, the detail page and the edit dialog on each read from here, so a
 * label or a field cannot be one thing on the list and another on the page it
 * opens.
 */
export interface CatalogConfig {
  resource: CatalogResource;
  /** "Categories" */
  title: string;
  /** "Category" */
  singular: string;
  subtitle: string;
  offerField: 'categoryOffer' | 'brandOffer';
  /** The list route. A detail page is this plus the id. */
  path: string;
  fields: FieldDefinition[];
}

/**
 * The create/edit form.
 *
 * Built once per resource rather than on every render: the dialog resets its
 * values whenever its field list changes identity, so a fresh array per render
 * would wipe whatever was being typed the moment the page behind it refetched.
 *
 * The `%` offer applies to every product in the category or brand, and the
 * largest applicable offer wins at checkout - which is why it belongs on this
 * form rather than only on products.
 */
const fieldsFor = (singular: string, offerField: CatalogConfig['offerField']): FieldDefinition[] => [
  { name: 'name', label: 'Name', required: true },
  {
    name: 'image',
    label: 'Image',
    type: 'image',
    // What the create and update endpoints read.
    uploadAs: 'base64Image',
    hint: 'Saved as an 800×800 WebP.'
  },
  { name: 'description', label: 'Description', type: 'textarea' },
  {
    name: offerField,
    label: 'Offer (%)',
    type: 'number',
    hint: `Applied to every product in this ${singular.toLowerCase()}. The largest applicable offer wins.`,
    min: 0,
    max: 100
  }
];

export const CATALOG: Record<CatalogResource, CatalogConfig> = {
  categories: {
    resource: 'categories',
    title: 'Categories',
    singular: 'Category',
    subtitle: 'Organize and manage product categories',
    offerField: 'categoryOffer',
    path: '/admin/categories',
    fields: fieldsFor('Category', 'categoryOffer')
  },
  brands: {
    resource: 'brands',
    title: 'Brands',
    singular: 'Brand',
    subtitle: 'Organize and manage product brands',
    offerField: 'brandOffer',
    path: '/admin/brands',
    fields: fieldsFor('Brand', 'brandOffer')
  }
};

/**
 * Catalog artwork, or a placeholder where there is none.
 *
 * `width` is the pixel width to ask Cloudinary for - about twice the rendered
 * size, for high-density screens. Images stored anywhere else pass through.
 */
export const CatalogImage = ({
  src,
  width,
  className
}: {
  src: unknown;
  width: number;
  className?: string;
}) =>
  typeof src === 'string' && src ? (
    <img
      src={cloudinaryUrl(src, { width })}
      alt=""
      loading="lazy"
      className={cn('shrink-0 bg-card object-cover', className)}
    />
  ) : (
    <span
      aria-hidden="true"
      className={cn('flex shrink-0 items-center justify-center bg-card text-ink-muted', className)}
    >
      <ImageOff className="size-[40%] max-h-8 max-w-8" strokeWidth={1.5} />
    </span>
  );
