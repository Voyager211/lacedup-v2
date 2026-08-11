import type { FilterQuery, Model, Types } from 'mongoose';
import Brand from './brand.model';

// Brand code mappings
export function getBrandCode(brandName: string): string {
  const brandMap: Record<string, string> = {
    Nike: 'NK',
    Adidas: 'AD',
    'New Balance': 'NB',
    'Under Armour': 'UA',
    'Dolce & Gabbana': 'DG',
    Cariuma: 'CA',
    Lacoste: 'LC',
    Keds: 'KD',
    Zara: 'ZR',
    'Golden Goose': 'GG',
    On: 'ON'
  };
  return brandMap[brandName] || brandName.substring(0, 2).toUpperCase();
}

// Generate product code from product name
export function getProductCode(productName: string): string {
  return productName
    .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special characters
    .split(' ')
    .map((word) => word.substring(0, 3)) // Take first 3 chars of each word
    .join('')
    .substring(0, 6) // Limit to 6 characters
    .toUpperCase();
}

// Generate variant code from size
export function getVariantCode(size: string): string {
  return size
    .replace(/[^a-zA-Z0-9]/g, '') // Remove spaces and special chars
    .toUpperCase();
}

type BrandRef = Types.ObjectId | string | { _id: Types.ObjectId };

// Generate base SKU for product
export async function generateBaseSKU(brandId: BrandRef, productName: string): Promise<string> {
  try {
    // Look up brand name from brand collection
    const brand = await Brand.findById(brandId);
    if (!brand) {
      throw new Error('Brand not found');
    }

    const brandCode = getBrandCode(brand.name);
    const productCode = getProductCode(productName);

    return `${brandCode}-${productCode}`;
  } catch (error) {
    throw new Error(`Failed to generate base SKU: ${(error as Error).message}`);
  }
}

// Generate variant SKU
export async function generateVariantSKU(
  brandId: BrandRef,
  productName: string,
  size: string
): Promise<string> {
  try {
    // Look up brand name from brand collection
    const brand = await Brand.findById(brandId);
    if (!brand) {
      throw new Error('Brand not found');
    }

    const brandCode = getBrandCode(brand.name);
    const productCode = getProductCode(productName);
    const variantCode = getVariantCode(size);

    return `${brandCode}-${productCode}-${variantCode}`;
  } catch (error) {
    throw new Error(`Failed to generate variant SKU: ${(error as Error).message}`);
  }
}

// Check if SKU already exists
export async function isSkuUnique(
  sku: string,
  ProductModel: Model<any>,
  excludeProductId?: Types.ObjectId | string | null
): Promise<boolean> {
  const query: FilterQuery<any> = {
    $or: [{ baseSKU: sku }, { 'variants.sku': sku }]
  };

  if (excludeProductId) {
    query._id = { $ne: excludeProductId };
  }

  const existingProduct = await ProductModel.findOne(query);
  return !existingProduct;
}
