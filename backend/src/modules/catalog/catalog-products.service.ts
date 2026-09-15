import mongoose from 'mongoose';
import Product from './product.model';
import { getPagination } from '../../common/utils/pagination.util';
import { withPricing } from './pricing.util';

/**
 * The products under one brand or one category, for the admin detail pages.
 *
 * Not the admin product list with a filter, for two reasons. That list sends
 * the stored documents, and the price a product sells at is not stored - it is
 * derived from the largest of four offers, and the brand or category offer
 * these pages are about is one of them. And its `totalRecords` counts every
 * product in the catalogue whatever the filter, which is the wrong number for
 * a page about a subset.
 */

export const CATALOG_PRODUCTS_PER_PAGE = 10;

export interface CatalogProductRow {
  _id: string;
  productName: string;
  mainImage: string;
  regularPrice: number;
  /** The cheapest and dearest variant after offers - equal when every variant costs the same. */
  minPrice: number;
  maxPrice: number;
  totalStock: number;
  isListed: boolean;
}

export const listCatalogProducts = async (
  field: 'brand' | 'category',
  id: string,
  page: number
) => {
  const filter: Record<string, any> = {
    [field]: new mongoose.Types.ObjectId(id),
    isDeleted: false
  };

  const { data, totalPages, totalRecords } = await getPagination(
    // Both populated: the pricing reads the brand and category offers off them.
    Product.find(filter).populate('brand').populate('category').sort({ createdAt: -1 }),
    Product,
    filter,
    page,
    CATALOG_PRODUCTS_PER_PAGE
  );

  const products: CatalogProductRow[] = data.map((product) => {
    const priced = withPricing(product);
    const finalPrices: number[] = (priced.variants ?? []).map(
      (variant: { finalPrice: number }) => variant.finalPrice
    );
    const prices = finalPrices.length > 0 ? finalPrices : [product.regularPrice];

    return {
      _id: String(product._id),
      productName: product.productName,
      mainImage: product.mainImage,
      regularPrice: product.regularPrice,
      minPrice: Math.min(...prices),
      maxPrice: Math.max(...prices),
      totalStock: product.totalStock,
      isListed: product.isListed
    };
  });

  return { products, currentPage: page, totalPages, totalRecords };
};
