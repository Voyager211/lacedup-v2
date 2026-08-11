const {
  validateProductAvailability,
  validateCartItem
} = require('../cart.validation');

const product = (overrides = {}) => ({
  _id: 'p1',
  productName: 'Test Sneaker',
  isListed: true,
  isDeleted: false,
  category: { name: 'Shoes', isActive: true, isDeleted: false },
  brand: { name: 'TestBrand', isActive: true, isDeleted: false },
  variants: [],
  ...overrides
});

describe('validateProductAvailability', () => {
  it('accepts a listed product with an active category and brand', () => {
    expect(validateProductAvailability(product())).toEqual({ isValid: true, reason: null });
  });

  it('rejects an unlisted product', () => {
    const result = validateProductAvailability(product({ isListed: false }));
    expect(result.isValid).toBe(false);
    expect(result.reason).toMatch(/no longer available/i);
  });

  it('rejects a soft-deleted product', () => {
    expect(validateProductAvailability(product({ isDeleted: true })).isValid).toBe(false);
  });

  it('rejects a null product instead of throwing', () => {
    expect(validateProductAvailability(null).isValid).toBe(false);
    expect(validateProductAvailability(undefined).isValid).toBe(false);
  });

  // A product can be perfectly fine itself while its category or brand has been
  // disabled by an admin - it must not remain purchasable in that case.
  it('rejects a product whose category was deactivated', () => {
    const result = validateProductAvailability(
      product({ category: { name: 'Shoes', isActive: false, isDeleted: false } })
    );
    expect(result.isValid).toBe(false);
    expect(result.reason).toMatch(/category/i);
  });

  it('rejects a product whose category was deleted', () => {
    expect(
      validateProductAvailability(
        product({ category: { name: 'Shoes', isActive: true, isDeleted: true } })
      ).isValid
    ).toBe(false);
  });

  it('rejects a product whose brand was deactivated', () => {
    const result = validateProductAvailability(
      product({ brand: { name: 'TestBrand', isActive: false, isDeleted: false } })
    );
    expect(result.isValid).toBe(false);
    expect(result.reason).toMatch(/brand/i);
  });

  it('accepts a product with no category or brand populated', () => {
    expect(
      validateProductAvailability(product({ category: null, brand: null })).isValid
    ).toBe(true);
  });
});

describe('validateCartItem', () => {
  it('accepts an item whose product and variant are both available', () => {
    const item = {
      productId: product({ variants: [{ _id: 'v1', size: 'UK 9', stock: 5 }] }),
      variantId: 'v1',
      size: 'UK 9',
      quantity: 2
    };
    expect(validateCartItem(item).isValid).toBe(true);
  });

  it('propagates the product-level reason and includes item details', () => {
    const item = {
      productId: product({ isListed: false }),
      variantId: 'v1',
      size: 'UK 9',
      quantity: 2
    };
    const result = validateCartItem(item);

    expect(result.isValid).toBe(false);
    expect(result.details).toMatchObject({
      productName: 'Test Sneaker',
      size: 'UK 9',
      quantity: 2
    });
  });

  // Variants are removable independently of the product, so a cart can hold a
  // reference to a size that no longer exists.
  it('rejects an item whose variant no longer exists on the product', () => {
    const item = {
      productId: product({ variants: [{ _id: 'v2', size: 'UK 10', stock: 3 }] }),
      variantId: 'v1',
      size: 'UK 9',
      quantity: 1
    };
    const result = validateCartItem(item);

    expect(result.isValid).toBe(false);
    expect(result.reason).toMatch(/variant/i);
  });

  it('reports "Unknown Product" rather than throwing when the product is missing', () => {
    const result = validateCartItem({ productId: null, size: 'UK 9', quantity: 1 });

    expect(result.isValid).toBe(false);
    expect(result.details.productName).toBe('Unknown Product');
  });
});
