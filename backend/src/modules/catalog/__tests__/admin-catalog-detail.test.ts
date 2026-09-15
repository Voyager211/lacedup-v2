import request from 'supertest';
import * as db from '../../../common/testing/db';
import app from '../../../app';
import User from '../../users/user.model';
import Product from '../product.model';
import Category from '../category.model';
import Brand from '../brand.model';

/**
 * GET /api/admin/{brands,categories}/api/:id/products.
 *
 * The brand and category detail pages list the products under them with the
 * price each one actually sells at. That price is not stored - it comes from
 * the largest of four competing offers, one of which is the offer the page is
 * about - so the computed figures are asserted here rather than left for the
 * client to work out and get wrong.
 */

const ADMIN = {
  name: 'Catalog Admin',
  email: 'catalog-detail-admin@example.com',
  password: 'CorrectHorse1!',
  role: 'admin' as const
};

const SHOPPER = {
  name: 'Catalog Shopper',
  email: 'catalog-detail-shopper@example.com',
  password: 'CorrectHorse1!'
};

const signIn = async (path: string, email: string, password: string): Promise<string[]> => {
  const res = await request(app).post(path).type('form').send({ email, password });
  return ([] as string[]).concat(res.headers['set-cookie'] ?? []);
};

const MISSING = '507f1f77bcf86cd799439011';

describe('admin brand and category detail', () => {
  let cookies: string[];
  let brandId: string;
  let otherBrandId: string;
  let categoryId: string;

  const makeProduct = (name: string, brand: string, overrides: Record<string, unknown> = {}) => {
    const slug = name.toLowerCase().replace(/\s+/g, '-');

    return Product.create({
      productName: name,
      slug,
      description: 'For the catalog detail test.',
      features: 'Light, Grippy',
      brand,
      category: categoryId,
      regularPrice: 12000,
      mainImage: `/uploads/${slug}.jpg`,
      variants: [
        { size: 'UK 8', stock: 4, basePrice: 10000, sku: `${slug}-8` },
        { size: 'UK 9', stock: 0, basePrice: 11000, sku: `${slug}-9` }
      ],
      ...overrides
    });
  };

  beforeAll(async () => {
    await db.connect();
  });

  afterAll(async () => {
    await db.disconnect();
  });

  beforeEach(async () => {
    await Promise.all([
      User.deleteMany({}),
      Product.deleteMany({}),
      Category.deleteMany({}),
      Brand.deleteMany({})
    ]);

    await User.create({ ...ADMIN, isVerified: true });
    await User.create({ ...SHOPPER, isVerified: true });

    // The brand offer is the largest, so it is the one that sets the price.
    const brand = await Brand.create({ name: 'Detailwear', brandOffer: 20 });
    const otherBrand = await Brand.create({ name: 'Elsewhere', brandOffer: 0 });
    const category = await Category.create({ name: 'Trail', categoryOffer: 5 });

    brandId = String(brand._id);
    otherBrandId = String(otherBrand._id);
    categoryId = String(category._id);

    // Eleven live products puts one on a second page of ten.
    for (let n = 1; n <= 11; n += 1) {
      await makeProduct(`Detail Shoe ${n}`, brandId);
    }

    await makeProduct('Deleted Shoe', brandId, { isDeleted: true });
    await makeProduct('Other Brand Shoe', otherBrandId);

    cookies = await signIn('/api/admin/login', ADMIN.email, ADMIN.password);
  });

  it('pages through only that brand, leaving out deleted products', async () => {
    const first = await request(app)
      .get(`/api/admin/brands/api/${brandId}/products`)
      .set('Cookie', cookies);

    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ currentPage: 1, totalPages: 2, totalRecords: 11 });
    expect(first.body.products).toHaveLength(10);

    const second = await request(app)
      .get(`/api/admin/brands/api/${brandId}/products?page=2`)
      .set('Cookie', cookies);

    expect(second.body.products).toHaveLength(1);

    const names = [...first.body.products, ...second.body.products].map(
      (product: { productName: string }) => product.productName
    );

    expect(names).not.toContain('Deleted Shoe');
    expect(names).not.toContain('Other Brand Shoe');
  });

  it('prices each product with the winning offer, as a range across its variants', async () => {
    const res = await request(app)
      .get(`/api/admin/brands/api/${brandId}/products`)
      .set('Cookie', cookies);

    // 20% off base prices of 10,000 and 11,000.
    expect(res.body.products[0]).toMatchObject({
      regularPrice: 12000,
      minPrice: 8000,
      maxPrice: 8800,
      totalStock: 4,
      isListed: true
    });
  });

  it('lists a category across brands, with its own offer where that is the largest', async () => {
    const res = await request(app)
      .get(`/api/admin/categories/api/${categoryId}/products`)
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.totalRecords).toBe(12);

    const other = res.body.products.find(
      (product: { productName: string }) => product.productName === 'Other Brand Shoe'
    );

    // No brand offer on this one, so the category's 5% wins.
    expect(other).toMatchObject({ minPrice: 9500, maxPrice: 10450 });
  });

  it('answers a brand that does not exist with a 404', async () => {
    const res = await request(app)
      .get(`/api/admin/brands/api/${MISSING}/products`)
      .set('Cookie', cookies);

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false });
  });

  it('answers a malformed id with a 404 rather than a CastError 500', async () => {
    const products = await request(app)
      .get('/api/admin/categories/api/not-an-id/products')
      .set('Cookie', cookies);

    const record = await request(app).get('/api/admin/brands/api/not-an-id').set('Cookie', cookies);

    expect(products.status).toBe(404);
    expect(record.status).toBe(404);
  });

  it('is not readable with a shopper session', async () => {
    const shopper = await signIn('/api/login', SHOPPER.email, SHOPPER.password);

    const res = await request(app)
      .get(`/api/admin/brands/api/${brandId}/products`)
      .set('Cookie', shopper);

    expect(res.status).not.toBe(200);
  });
});
