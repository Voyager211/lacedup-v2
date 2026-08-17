import request from 'supertest';
import * as db from '../../../common/testing/db';
import app from '../../../app';
import Product from '../product.model';
import Category from '../category.model';
import Brand from '../brand.model';

/**
 * What the storefront endpoints say about price.
 *
 * The arithmetic has always been on the product model. Almost none of it
 * reached the client: `/api/shop` sent a bare finalPrice per variant,
 * `/api/product/:slug` sent no per-variant price at all, `/api/home-sections`
 * sent neither, and none of the three named the offer or the saving. So the
 * landing page showed regular prices for products the shop page showed
 * discounted, and the detail page could not say why a price was what it was.
 *
 * These pin the shape all three now share, and the two arithmetic decisions
 * that are easy to get wrong:
 *
 *  - the offer applies to the *base* price, not the regular price;
 *  - the saving is measured against the *regular* price, not the base price.
 */

const REGULAR = 12000;
const BASE_8 = 10000;
const BASE_9 = 11000;

describe('storefront pricing contract', () => {
  beforeAll(async () => {
    await db.connect();
  });

  afterAll(async () => {
    await db.disconnect();
  });

  beforeEach(async () => {
    await Promise.all([Product.deleteMany({}), Category.deleteMany({}), Brand.deleteMany({})]);
  });

  const seed = async (offers: {
    categoryOffer?: number;
    brandOffer?: number;
    productOffer?: number;
    variantOffer?: number;
  }) => {
    const brand = await Brand.create({ name: 'Testwear', brandOffer: offers.brandOffer ?? 0 });
    const category = await Category.create({
      name: 'Gym Sneakers',
      categoryOffer: offers.categoryOffer ?? 0
    });

    await Product.create({
      productName: 'Pricing Test Shoe',
      slug: 'pricing-test-shoe',
      description: 'For the pricing contract test.',
      features: 'Breathable, Cushioned',
      brand: brand._id,
      category: category._id,
      regularPrice: REGULAR,
      productOffer: offers.productOffer ?? 0,
      mainImage: '/uploads/main.jpg',
      variants: [
        {
          size: 'UK 8',
          stock: 10,
          basePrice: BASE_8,
          sku: 'PTS-8',
          variantSpecificOffer: offers.variantOffer ?? 0
        },
        { size: 'UK 9', stock: 4, basePrice: BASE_9, sku: 'PTS-9' }
      ]
    });
  };

  const detail = () => request(app).get('/api/product/pricing-test-shoe');

  it('prices every variant on the detail page, which sent no variant price at all', async () => {
    await seed({ categoryOffer: 20 });

    const res = await detail();
    const variant = res.body.product.variants[0];

    expect(res.status).toBe(200);
    // The offer comes off the base price, not the regular price.
    expect(variant.basePrice).toBe(BASE_8);
    expect(variant.finalPrice).toBe(8000);
  });

  it('names the offer that won, so the badge can say whose it is', async () => {
    await seed({ categoryOffer: 20, brandOffer: 5, productOffer: 5 });

    const variant = (await detail()).body.product.variants[0];

    expect(variant.offerPercent).toBe(20);
    expect(variant.offerSource).toBe('category');
    // The category's own name - "20% off for all Gym Sneakers", not "category".
    expect(variant.offerName).toBe('Gym Sneakers');
  });

  it('names a brand offer after the brand', async () => {
    await seed({ brandOffer: 25, categoryOffer: 10 });

    const variant = (await detail()).body.product.variants[0];

    expect(variant.offerSource).toBe('brand');
    expect(variant.offerName).toBe('Testwear');
  });

  it('calls a product or variant offer what it is, since neither has a name', async () => {
    await seed({ productOffer: 30 });
    expect((await detail()).body.product.variants[0].offerName).toBe('Product');

    await Product.deleteMany({});
    await Category.deleteMany({});
    await Brand.deleteMany({});
    await seed({ variantOffer: 30 });

    const variants = (await detail()).body.product.variants;
    expect(variants[0].offerSource).toBe('variant');
    expect(variants[0].offerName).toBe('Variant');
    // The offer is on one variant only - the other must not inherit it.
    expect(variants[1].offerSource).toBe('none');
    expect(variants[1].offerName).toBeNull();
  });

  it('says there is no offer rather than pretending to a zero-percent one', async () => {
    await seed({});

    const variant = (await detail()).body.product.variants[0];

    expect(variant.offerPercent).toBe(0);
    expect(variant.offerSource).toBe('none');
    expect(variant.offerName).toBeNull();
    // Still discounted: the base price is below the regular price.
    expect(variant.totalDiscount).toBe(REGULAR - BASE_8);
  });

  it('measures the saving against the regular price, not the base price', async () => {
    // 20% off a 10,000 base is 8,000. Against the 12,000 regular price that is
    // a 4,000 saving and 33%, not the 2,000 and 20% the offer alone suggests.
    await seed({ categoryOffer: 20 });

    const variant = (await detail()).body.product.variants[0];

    expect(variant.totalDiscount).toBe(4000);
    expect(Math.round(variant.totalDiscountPercent)).toBe(33);
  });

  it('sends the same fields on the shop list', async () => {
    await seed({ brandOffer: 20 });

    const res = await request(app).get('/api/shop');
    const variant = res.body.products[0].variants[0];

    expect(variant).toMatchObject({
      finalPrice: 8000,
      offerPercent: 20,
      offerSource: 'brand',
      offerName: 'Testwear'
    });
  });

  it('sends them on the home sections too, which sent no prices whatsoever', async () => {
    await seed({ brandOffer: 20 });

    const res = await request(app).get('/api/home-sections');
    const product = res.body.newArrivals[0];

    expect(product.averageFinalPrice).toBe((8000 + BASE_9 * 0.8) / 2);
    expect(product.variants[0].offerSource).toBe('brand');
  });

  it('averages across variants, so the card price is not one variant', async () => {
    await seed({});

    const res = await detail();

    expect(res.body.product.averageFinalPrice).toBe((BASE_8 + BASE_9) / 2);
  });
});

/**
 * Search, filters and paging have to agree with each other, because the client
 * sends them as one object and reads one count back.
 *
 * The size filter is here because it was dead: the controller read a repeated
 * `size`, which is what the EJS page sent, while the React page sends `sizes`
 * as one comma-separated value. /api/shop?sizes=UK+10 returned the entire
 * catalogue and nothing failed.
 */
describe('shop filtering contract', () => {
  beforeAll(async () => {
    await db.connect();
  });

  afterAll(async () => {
    await db.disconnect();
  });

  beforeEach(async () => {
    await Promise.all([Product.deleteMany({}), Category.deleteMany({}), Brand.deleteMany({})]);

    const brand = await Brand.create({ name: 'Testwear' });
    const category = await Category.create({ name: 'Gym Sneakers' });

    const make = (name: string, slug: string, sizes: string[], price: number) =>
      Product.create({
        productName: name,
        slug,
        description: 'For the filter contract test.',
        features: 'Breathable',
        brand: brand._id,
        category: category._id,
        regularPrice: price,
        mainImage: '/uploads/main.jpg',
        variants: sizes.map((size, index) => ({
          size,
          stock: 5,
          // The schema requires the base price to be strictly below the
          // regular price - the regular price is what gets struck through.
          basePrice: price - 1000,
          sku: `${slug}-${index}`
        }))
      });

    await make('Alpha Runner', 'alpha-runner', ['UK 8'], 5000);
    await make('Beta Trainer', 'beta-trainer', ['UK 9', 'UK 10'], 9000);
    await make('Gamma Court', 'gamma-court', ['UK 10'], 12000);
  });

  const shop = (queryString = '') => request(app).get(`/api/shop${queryString}`);

  it('filters by a comma-separated `sizes`, which was being ignored', async () => {
    const res = await shop('?sizes=UK 10');

    expect(res.status).toBe(200);
    expect(res.body.pagination.totalProducts).toBe(2);
    expect(res.body.products.map((p: { slug: string }) => p.slug).sort()).toEqual([
      'beta-trainer',
      'gamma-court'
    ]);
  });

  it('still accepts the repeated `size` the old page sent', async () => {
    const res = await shop('?size=UK 8&size=UK 9');

    expect(res.body.pagination.totalProducts).toBe(2);
  });

  it('treats several comma-separated sizes as any-of', async () => {
    const res = await shop('?sizes=UK 8,UK 9');

    expect(res.body.pagination.totalProducts).toBe(2);
  });

  it('ignores a trailing comma rather than filtering on an empty size', async () => {
    const res = await shop('?sizes=UK 10,');

    expect(res.body.pagination.totalProducts).toBe(2);
  });

  it('narrows the count as well as the rows when searching', async () => {
    // A count that ignores the search reads as a bug the moment a shopper
    // types: 1 card on screen, 3 in the heading.
    const res = await shop('?q=alpha');

    expect(res.body.products).toHaveLength(1);
    expect(res.body.pagination.totalProducts).toBe(1);
  });

  it('combines search, filter and price into one query rather than the last one wins', async () => {
    const both = await shop('?q=trainer&sizes=UK 10&minPrice=8000');
    expect(both.body.pagination.totalProducts).toBe(1);

    // Each clause has to bite: the same search with a size it does not have
    // must find nothing.
    const neither = await shop('?q=trainer&sizes=UK 8');
    expect(neither.body.pagination.totalProducts).toBe(0);
  });

  it('pages a filtered set, not the whole catalogue', async () => {
    const res = await shop('?sizes=UK 10&page=2');

    expect(res.body.pagination.currentPage).toBe(2);
    expect(res.body.pagination.totalProducts).toBe(2);
    // Two matches at 12 a page: page 2 is past the end and holds nothing.
    expect(res.body.products).toHaveLength(0);
  });
});
