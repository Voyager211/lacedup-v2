import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import MockAdapter from 'axios-mock-adapter';
import { api as client } from '@/api/client';
import { createStore } from '@/app/store';
import { Toaster } from '@/components/toast';
import { bootstrapSession } from '@/features/auth/authSlice';
import { productPricing } from '@/lib/pricing';
import OfferBadges, { offerLabel } from './OfferBadges';
import ProductCard from './ProductCard';
import type { Product } from '@/types/catalog';

/**
 * The two arithmetic decisions the whole display rests on:
 *
 *  - the offer comes off the *base* price;
 *  - the saving is measured against the *regular* price.
 *
 * Get the second wrong and a 20% offer on a base price already below the
 * regular price reports 20% when the shopper is actually saving a third.
 */

const priced = (overrides: Partial<Product> = {}): Product =>
  ({
    _id: 'p1',
    productName: 'Air Max 90',
    slug: 'air-max-90',
    regularPrice: 12000,
    totalStock: 14,
    mainImage: '/img.jpg',
    variants: [
      {
        _id: 'v1',
        size: 'UK 8',
        stock: 10,
        basePrice: 10000,
        finalPrice: 8000,
        offerPercent: 20,
        offerSource: 'category',
        offerName: 'Gym Sneakers',
        totalDiscount: 4000,
        totalDiscountPercent: 33.33
      },
      {
        _id: 'v2',
        size: 'UK 9',
        stock: 4,
        basePrice: 11000,
        finalPrice: 8800,
        offerPercent: 20,
        offerSource: 'category',
        offerName: 'Gym Sneakers',
        totalDiscount: 3200,
        totalDiscountPercent: 26.67
      }
    ],
    ...overrides
  }) as Product;

describe('productPricing', () => {
  it('averages the base and final prices across variants', () => {
    const pricing = productPricing(priced());

    expect(pricing.averageBasePrice).toBe(10500);
    expect(pricing.averageFinalPrice).toBe(8400);
  });

  it('measures the average discount against the regular price', () => {
    // (12000 - 8400) / 12000 = 30%. Against the average base price it would
    // read 20%, which is the offer rather than the saving.
    expect(productPricing(priced()).averageDiscountPercent).toBe(30);
  });

  it('names the offer when every variant is under the same one', () => {
    expect(productPricing(priced()).offer).toEqual({
      percent: 20,
      source: 'category',
      name: 'Gym Sneakers'
    });
  });

  it('names no offer when the variants disagree', () => {
    // A variant-specific offer can leave two variants under different offers,
    // and there is no honest single badge for that.
    const mixed = priced();
    mixed.variants[1] = {
      ...mixed.variants[1]!,
      offerPercent: 5,
      offerSource: 'variant',
      offerName: 'Variant'
    };

    expect(productPricing(mixed).offer).toBeNull();
  });

  it('falls back to the regular price for a product with no variants', () => {
    const pricing = productPricing(priced({ variants: [] }));

    expect(pricing.averageFinalPrice).toBe(12000);
    expect(pricing.averageDiscountPercent).toBe(0);
  });
});

describe('offerLabel', () => {
  it('reads a category or brand offer as covering everything under it', () => {
    expect(offerLabel({ percent: 20, source: 'category', name: 'Gym Sneakers' })).toBe(
      '20% off for all Gym Sneakers Sneakers!'
    );
    expect(offerLabel({ percent: 15, source: 'brand', name: 'Nike' })).toBe(
      '15% off for all Nike Sneakers!'
    );
  });

  it('reads a product or variant offer as covering only this one', () => {
    expect(offerLabel({ percent: 10, source: 'product', name: 'Product' })).toBe(
      '10% off on this Product!'
    );
  });
});

describe('OfferBadges', () => {
  it('shows one green badge when nothing but the base price is discounting', () => {
    render(<OfferBadges offer={null} extraPercent={17} totalPercent={17} />);

    expect(screen.getByText('17% Off')).toBeInTheDocument();
    expect(screen.queryByText(/extra/i)).not.toBeInTheDocument();
  });

  it('splits a saving into the offer and the part it does not explain', () => {
    // 20% off a 10,000 base is 8,000; against a 12,000 regular price that is
    // 33% in total, of which the offer accounts for 20 and the base price 17.
    render(
      <OfferBadges
        offer={{ percent: 20, source: 'category', name: 'Gym Sneakers' }}
        extraPercent={16.7}
        totalPercent={33.3}
      />
    );

    expect(screen.getByText('20% off for all Gym Sneakers Sneakers!')).toBeInTheDocument();
    expect(screen.getByText('Extra 17% off')).toBeInTheDocument();
    // The combined figure is not shown as a third number - it would read as a
    // discount on top of the two beside it.
    expect(screen.queryByText(/33/)).not.toBeInTheDocument();
  });

  it('drops the extra badge when the base price is the regular price', () => {
    render(
      <OfferBadges
        offer={{ percent: 20, source: 'brand', name: 'Nike' }}
        extraPercent={0}
        totalPercent={20}
      />
    );

    expect(screen.getByText('20% off for all Nike Sneakers!')).toBeInTheDocument();
    expect(screen.queryByText(/extra/i)).not.toBeInTheDocument();
  });

  it('shows nothing at all when nothing is discounted', () => {
    const { container } = render(
      <OfferBadges offer={null} extraPercent={0} totalPercent={0} />
    );

    expect(container).toBeEmptyDOMElement();
  });
});

/**
 * The wishlist card.
 *
 * It is the only card that can put something in the cart directly, which means
 * it is the only one that has to ask for a size.
 */
const SHOPPER = {
  _id: 'u1',
  name: 'Alice',
  email: 'alice@example.com',
  role: 'user' as const,
  isBlocked: false
};

const renderCard = (element: React.ReactNode, signedIn = true) => {
  const router = createMemoryRouter(
    [
      { path: '/wishlist', element },
      { path: '/login', element: <p>login page</p> },
      { path: '/product/:slug', element: <p>product page</p> }
    ],
    { initialEntries: ['/wishlist'] }
  );

  const store = createStore();
  if (signedIn) store.dispatch(bootstrapSession.fulfilled(SHOPPER, 'test', 'user'));

  render(
    <Provider store={store}>
      <RouterProvider router={router} />
      <Toaster />
    </Provider>
  );

  return router;
};

describe('ProductCard on the wishlist', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(client);
  });

  afterEach(() => mock.restore());

  it('refuses to add without a size, and says so', async () => {
    renderCard(<ProductCard product={priced()} onWishlist />);

    await userEvent.click(screen.getByRole('button', { name: /add air max 90 to your cart/i }));

    expect(screen.getByRole('alert')).toHaveTextContent('Select Size First!');
    expect(mock.history.post).toHaveLength(0);
  });

  it('puts the message beside the label, not under the select', async () => {
    // Under the select it would grow the card when it appeared and shove the
    // rest of the grid down.
    renderCard(<ProductCard product={priced()} onWishlist />);

    await userEvent.click(screen.getByRole('button', { name: /add air max 90 to your cart/i }));

    const row = screen.getByText('Size:').parentElement as HTMLElement;
    expect(within(row).getByRole('alert')).toBeInTheDocument();
  });

  it('adds once a size is chosen, and clears the message', async () => {
    mock.onPost('/cart/add').reply(200, { success: true, cartCount: 1 });

    renderCard(<ProductCard product={priced()} onWishlist />);

    await userEvent.click(screen.getByRole('button', { name: /add air max 90 to your cart/i }));
    expect(screen.getByRole('alert')).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Size:'), 'v1');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /add air max 90 to your cart/i }));

    expect(mock.history.post[0]?.url).toBe('/cart/add');
    expect(JSON.parse(mock.history.post[0]?.data)).toMatchObject({
      productId: 'p1',
      variantId: 'v1'
    });
  });

  it('sends a visitor to sign in rather than letting the request 401', async () => {
    const router = renderCard(<ProductCard product={priced()} onWishlist />, false);

    await userEvent.click(screen.getByRole('button', { name: /add air max 90 to your cart/i }));

    expect(router.state.location.pathname).toBe('/login');
    expect(mock.history.post).toHaveLength(0);
  });

  it('sends a visitor to sign in from the wishlist button too', async () => {
    const router = renderCard(<ProductCard product={priced()} />, false);

    await userEvent.click(screen.getByRole('button', { name: /save air max 90/i }));

    expect(router.state.location.pathname).toBe('/login');
  });

  it('opens the product from a card that has no size picker', async () => {
    // Off the wishlist there is nowhere to choose a size, so adding an
    // arbitrary variant on the shopper's behalf would be a guess.
    const router = renderCard(<ProductCard product={priced()} />);

    await userEvent.click(screen.getByRole('button', { name: /add air max 90 to your cart/i }));

    expect(router.state.location.pathname).toBe('/product/air-max-90');
    expect(mock.history.post).toHaveLength(0);
  });
});
