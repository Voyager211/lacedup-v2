import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import MockAdapter from 'axios-mock-adapter';
import { api as client } from '@/api/client';
import { createStore } from '@/app/store';
import ProductCard from './ProductCard';
import ShopPage, { SORT_OPTIONS } from './ShopPage';
import ProductDetailsPage from './ProductDetailsPage';
import LandingPage from './LandingPage';
import type { Product } from '@/types/catalog';

const product = (overrides: Partial<Product> = {}): Product => ({
  _id: 'p1',
  productName: 'Air Max 90',
  slug: 'air-max-90',
  regularPrice: 2000,
  variants: [
    // Stock is comfortably above the low-stock threshold, so the default
    // fixture exercises the plain "In stock" state.
    { _id: 'v1', size: 'UK 8', stock: 12, basePrice: 2000, finalPrice: 1500 },
    { _id: 'v2', size: 'UK 9', stock: 0, basePrice: 2000, finalPrice: 1500 }
  ],
  totalStock: 12,
  mainImage: '/uploads/air-max-90.jpg',
  brand: { _id: 'b1', name: 'Nike' },
  category: { _id: 'c1', name: 'Running' },
  averageFinalPrice: 1500,
  averageRating: 4.5,
  totalReviews: 12,
  ...overrides
});

const renderAt = (element: React.ReactNode, entry = '/', path = '/') => {
  const router = createMemoryRouter(
    [
      { path, element },
      { path: '/shop', element: <p>shop page</p> },
      { path: '/product/:slug', element: <p>product page</p> }
    ],
    { initialEntries: [entry] }
  );

  render(
    <Provider store={createStore()}>
      <RouterProvider router={router} />
    </Provider>
  );

  return router;
};

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(client);
});

afterEach(() => mock.restore());

describe('ProductCard', () => {
  it('shows the server-computed price, not a recomputed one', () => {
    // The EJS card recalculated the price in the template, which is how the
    // displayed price could disagree with what the cart charged.
    renderAt(<ProductCard product={product()} />);

    expect(screen.getByText('₹1,500')).toBeInTheDocument();
    expect(screen.getByText('₹2,000')).toBeInTheDocument();
  });

  it('derives the discount from the two prices', () => {
    renderAt(<ProductCard product={product()} />);
    expect(screen.getByText('25% off')).toBeInTheDocument();
  });

  it('shows no discount when there is no saving', () => {
    // Priced from the variants, so the fixture has to say so there - the card
    // averages the variants rather than trusting a top-level figure that can
    // disagree with them.
    renderAt(
      <ProductCard
        product={product({
          averageFinalPrice: 2000,
          variants: [{ _id: 'v1', size: 'UK 8', stock: 12, basePrice: 2000, finalPrice: 2000 }]
        })}
      />
    );

    expect(screen.queryByText(/% off/)).not.toBeInTheDocument();
  });

  it('marks a sold-out product', () => {
    renderAt(<ProductCard product={product({ totalStock: 0 })} />);

    expect(screen.getByText('Sold out')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add air max 90 to your cart/i })).toBeDisabled();
  });

  it('links to the product by slug', () => {
    renderAt(<ProductCard product={product()} />);

    expect(screen.getByRole('link', { name: 'Air Max 90' })).toHaveAttribute(
      'href',
      '/product/air-max-90'
    );
  });

  it('hides the rating when nobody has reviewed it', () => {
    renderAt(<ProductCard product={product({ totalReviews: 0, averageRating: 0 })} />);
    expect(screen.queryByText('4.5')).not.toBeInTheDocument();
  });
});

describe('ShopPage', () => {
  const shopResponse = {
    success: true,
    products: [product()],
    pagination: {
      totalPages: 3,
      totalProducts: 30,
      currentPage: 1,
      hasNextPage: true,
      hasPrevPage: false
    },
    totalProductCount: 30
  };

  beforeEach(() => {
    mock.onGet('/shop').reply(200, shopResponse);
    mock.onGet('/catalog/filters').reply(200, {
      success: true,
      categories: [{ _id: 'c1', name: 'Running' }],
      brands: [{ _id: 'b1', name: 'Nike' }],
      sizes: ['UK 8', 'UK 9']
    });
  });

  it('reads its filters from the URL, so a filtered view is linkable', async () => {
    // The EJS page kept filters in a JS object and pushed nothing to the
    // address bar - a filtered view could not be shared or bookmarked.
    renderAt(<ShopPage />, '/shop?category=c1&sort=price-low', '/shop');

    await screen.findByText('Air Max 90');

    const request = mock.history.get.find((entry) => entry.url === '/shop');
    expect(request?.params).toMatchObject({ category: 'c1', sort: 'price-low' });
  });

  it('omits empty filters from the request', async () => {
    renderAt(<ShopPage />, '/shop', '/shop');
    await screen.findByText('Air Max 90');

    const request = mock.history.get.find((entry) => entry.url === '/shop');
    expect(request?.params).not.toHaveProperty('category');
    expect(request?.params).not.toHaveProperty('q');
  });

  it('writes a chosen filter into the URL', async () => {
    const router = renderAt(<ShopPage />, '/shop', '/shop');
    await screen.findByText('Air Max 90');

    await userEvent.selectOptions(screen.getByLabelText('Brand'), 'b1');

    await vi.waitFor(() => {
      expect(router.state.location.search).toContain('brand=b1');
    });
  });

  it('returns to page 1 when a filter changes', async () => {
    // Page 4 of a different filter is meaningless.
    const router = renderAt(<ShopPage />, '/shop?page=4', '/shop');
    await screen.findByText('Air Max 90');

    await userEvent.selectOptions(screen.getByLabelText('Category'), 'c1');

    await vi.waitFor(() => {
      expect(router.state.location.search).not.toContain('page=4');
    });
  });

  it('shows the active filters as removable chips', async () => {
    renderAt(<ShopPage />, '/shop?category=c1', '/shop');

    expect(await screen.findByRole('button', { name: /Running/ })).toBeInTheDocument();
  });

  it('only offers sort values the backend actually understands', async () => {
    // shop.controller.ts falls through to `newest` for an unrecognised key, so
    // a wrong value produces a control that silently does nothing rather than
    // an error. Three of these were wrong on the first pass.
    const accepted = [
      'newest',
      'popularity',
      'rating',
      'priceLow',
      'priceHigh',
      'nameAZ',
      'nameZA',
      'featured',
      'price-low',
      'price-high',
      'name-az',
      'name-za'
    ];

    for (const option of SORT_OPTIONS) {
      expect(accepted).toContain(option.value);
    }
  });

  it('reports the total count in the title bar', async () => {
    renderAt(<ShopPage />, '/shop', '/shop');

    // Waits for the count: the bar renders before the request answers.
    await screen.findByText('Air Max 90');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Products (30)');
  });

  it('opens the filters on demand, not by default', async () => {
    renderAt(<ShopPage />, '/shop', '/shop');

    const toggle = await screen.findByRole('button', { name: /view filters/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    // Mounted but hidden - it has to stay in the tree to animate on the way out.
    expect(screen.getByLabelText('Category')).not.toBeVisible();

    await userEvent.click(toggle);

    expect(screen.getByLabelText('Category')).toBeVisible();
    expect(screen.getByRole('button', { name: /hide filters/i })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
  });

  it('searches from the title bar, and pages back to one when it does', async () => {
    // Search, filters and paging are all the same URL object - a new search
    // landing the shopper on page 4 of the previous one is the bug this avoids.
    const router = renderAt(<ShopPage />, '/shop?page=3', '/shop');

    await screen.findByRole('heading', { level: 1 });
    await userEvent.type(screen.getByLabelText('Search the shop'), 'air');

    await vi.waitFor(() => {
      expect(router.state.location.search).toContain('q=air');
    });
    expect(router.state.location.search).not.toContain('page=3');
  });

  it('offers a way out when nothing matches', async () => {
    mock.onGet('/shop').reply(200, {
      ...shopResponse,
      products: [],
      pagination: { ...shopResponse.pagination, totalPages: 0, totalProducts: 0 }
    });

    renderAt(<ShopPage />, '/shop?q=zzz', '/shop');

    expect(await screen.findByText(/nothing matched those filters/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /clear filters/i }).length).toBeGreaterThan(0);
  });

  it('surfaces a failed request instead of spinning forever', async () => {
    mock.onGet('/shop').reply(500, { message: 'Something went wrong' });

    renderAt(<ShopPage />, '/shop', '/shop');

    expect(await screen.findByText(/didn't load/i)).toBeInTheDocument();
  });
});

describe('ProductDetailsPage', () => {
  const details = {
    success: true,
    product: product(),
    reviews: [],
    relatedProducts: [],
    averageRating: 4.5,
    totalReviews: 12,
    ratingCounts: {},
    ratingBreakdown: {},
    averageFinalPrice: 1500,
    isInWishlist: false,
    userWishlistProductIds: []
  };

  it('renders features from the comma-separated string the schema stores', async () => {
    // `features` is a required String on the model - the EJS page splits it on
    // commas. Treating it as an array threw "features.map is not a function"
    // on every product that had any.
    mock
      .onGet('/product/air-max-90')
      .reply(200, { ...details, product: product({ features: 'Breathable, Cushioned sole' }) });

    renderAt(<ProductDetailsPage />, '/product/air-max-90', '/product/:slug');

    expect(await screen.findByText('Breathable')).toBeInTheDocument();
    expect(screen.getByText('Cushioned sole')).toBeInTheDocument();
  });

  it('shows no features section when the string is empty', async () => {
    mock
      .onGet('/product/air-max-90')
      .reply(200, { ...details, product: product({ features: '' }) });

    renderAt(<ProductDetailsPage />, '/product/air-max-90', '/product/:slug');

    await screen.findByRole('button', { name: 'UK 8' });
    expect(screen.queryByText('Features')).not.toBeInTheDocument();
  });

  it('opens with no size chosen, showing the average across sizes', async () => {
    // It used to default to the first buyable variant, which showed one size's
    // price as though it were the product's - and let the shopper add to the
    // cart without ever choosing.
    mock.onGet('/product/air-max-90').reply(200, details);

    renderAt(<ProductDetailsPage />, '/product/air-max-90', '/product/:slug');

    expect(await screen.findByRole('button', { name: 'UK 8' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    expect(screen.getByRole('button', { name: 'Select a size' })).toBeDisabled();
    expect(screen.getByText(/choose a size/i)).toBeInTheDocument();
  });

  it('switches from the average to that size once one is picked', async () => {
    mock.onGet('/product/air-max-90').reply(200, details);

    renderAt(<ProductDetailsPage />, '/product/air-max-90', '/product/:slug');

    await userEvent.click(await screen.findByRole('button', { name: 'UK 8' }));

    expect(screen.getByRole('button', { name: 'UK 8' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('In stock')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add to cart' })).toBeEnabled();
  });

  it('disables a size with no stock', async () => {
    mock.onGet('/product/air-max-90').reply(200, details);

    renderAt(<ProductDetailsPage />, '/product/air-max-90', '/product/:slug');

    expect(await screen.findByRole('button', { name: 'UK 9' })).toBeDisabled();
  });

  it('uses the selected variant price, which the server computed', async () => {
    mock.onGet('/product/air-max-90').reply(200, {
      ...details,
      product: product({
        variants: [
          { _id: 'v1', size: 'UK 8', stock: 12, basePrice: 2000, finalPrice: 1500 },
          { _id: 'v3', size: 'UK 10', stock: 8, basePrice: 2000, finalPrice: 1000 }
        ]
      })
    });

    renderAt(<ProductDetailsPage />, '/product/air-max-90', '/product/:slug');

    await userEvent.click(await screen.findByRole('button', { name: 'UK 10' }));

    expect(screen.getByText('₹1,000')).toBeInTheDocument();
  });

  it('warns when a size is nearly gone', async () => {
    mock.onGet('/product/air-max-90').reply(200, {
      ...details,
      product: product({
        variants: [{ _id: 'v1', size: 'UK 8', stock: 2, basePrice: 2000, finalPrice: 1500 }]
      })
    });

    renderAt(<ProductDetailsPage />, '/product/air-max-90', '/product/:slug');

    await userEvent.click(await screen.findByRole('button', { name: 'UK 8' }));

    expect(screen.getByText(/only 2 left/i)).toBeInTheDocument();
  });

  it('cannot add to cart when the selected size is gone', async () => {
    mock.onGet('/product/air-max-90').reply(200, {
      ...details,
      product: product({
        totalStock: 0,
        variants: [{ _id: 'v2', size: 'UK 9', stock: 0, basePrice: 2000, finalPrice: 1500 }]
      })
    });

    renderAt(<ProductDetailsPage />, '/product/air-max-90', '/product/:slug');

    // The size button is disabled, so it cannot be chosen - and the cart button
    // stays shut either way.
    expect(await screen.findByRole('button', { name: 'UK 9' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Select a size' })).toBeDisabled();
  });

  it('explains why a withdrawn product is unavailable', async () => {
    // The endpoint answers 404 with a reason - withdrawn, or its category
    // disabled - which the HTML page already distinguished.
    mock.onGet('/product/gone').reply(404, {
      success: false,
      message: 'This product is no longer available as its category has been disabled.'
    });

    renderAt(<ProductDetailsPage />, '/product/gone', '/product/:slug');

    expect(await screen.findByText(/category has been disabled/i)).toBeInTheDocument();
  });
});

describe('LandingPage', () => {
  it('renders each section from the single home request', async () => {
    mock.onGet('/home-sections').reply(200, {
      success: true,
      newArrivals: [product()],
      bestSellers: [product({ _id: 'p2', productName: 'Ultraboost', slug: 'ultraboost' })],
      categories: [{ _id: 'c1', name: 'Running', image: '/img.jpg' }],
      brands: [{ _id: 'b1', name: 'Nike' }]
    });

    renderAt(<LandingPage />, '/', '/');

    expect(await screen.findByRole('heading', { name: 'New arrivals' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Best sellers' })).toBeInTheDocument();
    expect(screen.getByText('Ultraboost')).toBeInTheDocument();
  });

  it('omits a section with nothing in it rather than showing an empty row', async () => {
    mock.onGet('/home-sections').reply(200, {
      success: true,
      newArrivals: [product()],
      bestSellers: [],
      categories: [],
      brands: []
    });

    renderAt(<LandingPage />, '/', '/');

    await screen.findByRole('heading', { name: 'New arrivals' });
    expect(screen.queryByRole('heading', { name: 'Best sellers' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Shop by Brands' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Shop by Category' })).not.toBeInTheDocument();
  });

  it('links category cards into the shop with that filter applied', async () => {
    mock.onGet('/home-sections').reply(200, {
      success: true,
      newArrivals: [],
      bestSellers: [],
      categories: [{ _id: 'c1', name: 'Running', image: '/img.jpg' }],
      brands: []
    });

    renderAt(<LandingPage />, '/', '/');

    await screen.findByRole('heading', { name: 'Shop by Category' });
    expect(screen.getByRole('link', { name: 'Running' })).toHaveAttribute(
      'href',
      '/shop?category=c1'
    );
  });

  it('shows the brand mark, which never rendered while the client read `logo`', async () => {
    // The schema stores it as `image`; BrandRef said `logo`, so every card fell
    // through to its text fallback.
    mock.onGet('/home-sections').reply(200, {
      success: true,
      newArrivals: [],
      bestSellers: [],
      categories: [],
      brands: [{ _id: 'b1', name: 'Nike', image: '/uploads/brands/nike.webp' }]
    });

    renderAt(<LandingPage />, '/', '/');

    await screen.findByRole('heading', { name: 'Shop by Brands' });
    expect(screen.getByRole('img', { name: 'Nike' })).toHaveAttribute(
      'src',
      '/uploads/brands/nike.webp'
    );
  });

  it('scrolls the category carousel rather than paging it', async () => {
    mock.onGet('/home-sections').reply(200, {
      success: true,
      newArrivals: [],
      bestSellers: [],
      categories: [
        { _id: 'c1', name: 'Running', image: '/a.jpg' },
        { _id: 'c2', name: 'Gym', image: '/b.jpg' }
      ],
      brands: []
    });

    renderAt(<LandingPage />, '/', '/');

    await screen.findByRole('heading', { name: 'Shop by Category' });

    // Both are in the DOM at once - it is a scrolling track, not a slideshow
    // that mounts one slide at a time.
    expect(screen.getByRole('link', { name: 'Running' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Gym' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'More categories' })).toBeInTheDocument();
  });

  it('says what the community section collects before it collects it', async () => {
    mock.onGet('/home-sections').reply(200, {
      success: true,
      newArrivals: [],
      bestSellers: [],
      categories: [],
      brands: []
    });

    renderAt(<LandingPage />, '/', '/');

    expect(
      screen.getByRole('heading', { name: 'Join Our Sneaker Community' })
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Your email address')).toBeInTheDocument();
    expect(screen.getByText(/i agree to receive marketing emails/i)).toBeInTheDocument();
  });

  it('still shows the hero when the sections fail to load', async () => {
    mock.onGet('/home-sections').reply(500, { message: 'nope' });

    renderAt(<LandingPage />, '/', '/');

    // The hero sits outside the query boundary, which is the point of the
    // test. It is artwork now rather than a headline and a button, so what
    // proves it rendered is the region and its slides.
    expect(screen.getByRole('region', { name: /featured/i })).toBeInTheDocument();
    expect(await screen.findByText(/didn't load/i)).toBeInTheDocument();
  });
});
