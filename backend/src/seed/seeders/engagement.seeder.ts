import { faker } from '@faker-js/faker';
import Cart from '../../modules/cart/cart.model';
import Subscriber from '../../modules/content/subscriber.model';
import Review from '../../modules/reviews/review.model';
import Wishlist from '../../modules/wishlist/wishlist.model';
import { PRODUCTS, finalPrice, getProduct, productId, variantId, variantSku } from '../data/catalog';
import { DAY, daysBefore, userId } from '../data/people';
import { seedWorld } from '../data/world';
import { insertMissing, type Seeder } from '../runner';
import { seedId } from '../seed-id';

const CARTS: Record<string, Array<{ product: string; size: string; quantity: number }>> = {
  shopper: [
    { product: 'on-cloud-5', size: '10', quantity: 1 },
    { product: 'adidas-stan-smith', size: '9', quantity: 2 }
  ],
  'user-2': [{ product: 'gg-superstar', size: '7', quantity: 1 }],
  'user-3': [
    { product: 'nike-court-vision', size: '10', quantity: 1 },
    { product: 'keds-champion', size: '8', quantity: 1 }
  ]
};

export const shoppingSeeder: Seeder = {
  name: 'shopping',
  models: [Cart, Wishlist],
  run: async ({ log }) => {
    const { now, people } = seedWorld();

    // Cart prices are what the cart controller stores: the variant's current final price.
    const carts = await insertMissing(
      Cart,
      Object.entries(CARTS).map(([userKey, lines]) => ({
        _id: seedId(`cart:${userKey}`),
        userId: userId(userKey),
        items: lines.map((line, index) => {
          const product = getProduct(line.product);
          const price = finalPrice(product, line.size);
          return {
            _id: seedId(`cart-item:${userKey}:${index}`),
            productId: productId(product.key),
            variantId: variantId(product.key, line.size),
            sku: variantSku(product, line.size),
            size: line.size,
            quantity: line.quantity,
            price,
            totalPrice: price * line.quantity,
            status: 'active'
          };
        }),
        appliedCoupon: null,
        createdAt: daysBefore(now, 2)
      }))
    );

    const listed = PRODUCTS.filter((p) => p.isListed);
    const wishes: Record<string, string[]> = {
      shopper: ['gg-superstar', 'nike-aj1-dior', 'dg-daymaster']
    };
    for (const user of people.filter((p) => ['user-1', 'user-2', 'user-3', 'user-4', 'user-5'].includes(p.key))) {
      wishes[user.key] = faker.helpers.arrayElements(listed, { min: 1, max: 3 }).map((p) => p.key);
    }

    const wishlists = await insertMissing(
      Wishlist,
      Object.entries(wishes).map(([userKey, productKeys]) => ({
        _id: seedId(`wishlist:${userKey}`),
        userId: userId(userKey),
        products: productKeys.map((key, index) => ({
          _id: seedId(`wishlist-item:${userKey}:${index}`),
          productId: productId(key),
          addedAt: daysBefore(now, faker.number.int({ min: 1, max: 30 }))
        })),
        createdAt: daysBefore(now, 30)
      }))
    );

    log(`${carts} carts, ${wishlists} wishlists inserted`);
  }
};

const TITLES: Record<number, string[]> = {
  5: ['Best pair I own', 'Worth every rupee', 'Incredibly comfortable', 'Exactly as pictured'],
  4: ['Really good, runs a little small', 'Solid everyday pair', 'Great quality for the price'],
  3: ['Decent, not amazing', 'Okay for the price', 'Comfort could be better'],
  2: ['Not what I expected', 'Sole wore out quickly']
};

const COMMENTS: Record<number, string[]> = {
  5: [
    'Wore them all day on my feet at work and had zero discomfort. Delivery was quick too.',
    'The finish is premium and they look even better in person. Already planning a second colour.',
    'True to size, great cushioning, and the packaging was spotless.'
  ],
  4: [
    'Love the look and the build. Order half a size up if you have wide feet.',
    'Comfortable after a couple of days of breaking in. Laces could be better.',
    'Good value. The colour is slightly darker than the photos.'
  ],
  3: [
    'They look good but the insole is quite flat for long walks.',
    'Fine for casual wear. Took a while to arrive.',
    'Average comfort, nice design. Would buy on sale.'
  ],
  2: [
    'The stitching near the toe started coming loose after a month.',
    'Much stiffer than I expected and they pinch at the heel.'
  ]
};

const REVIEW_IMAGES = ['/uploads/reviews/1770361341569-0-82xa7.webp', '/uploads/reviews/1770361341570-1-8egqem.webp'];

export const reviewsSeeder: Seeder = {
  name: 'reviews',
  models: [Review],
  run: async ({ log }) => {
    const { now, people, commerce } = seedWorld();
    const docs: Array<Record<string, unknown>> = [];
    const reviewed = new Set<string>();

    const add = (userKey: string, productKey: string, verified: boolean, at: Date) => {
      const key = `${userKey}:${productKey}`;
      if (reviewed.has(key)) return;
      reviewed.add(key);

      const rating = faker.helpers.weightedArrayElement([
        { weight: 50, value: 5 },
        { weight: 30, value: 4 },
        { weight: 15, value: 3 },
        { weight: 5, value: 2 }
      ]);

      docs.push({
        _id: seedId(`review:${key}`),
        user: userId(userKey),
        product: productId(productKey),
        rating,
        title: faker.helpers.arrayElement(TITLES[rating]!),
        comment: faker.helpers.arrayElement(COMMENTS[rating]!),
        images: [],
        isVerifiedPurchase: verified,
        helpfulVotes: faker.number.int({ min: 0, max: 24 }),
        isHidden: false,
        createdAt: at
      });
    };

    // Verified: backed by a delivered item in the buyer's order history.
    for (const purchase of commerce.purchases) {
      if (purchase.userKey === 'shopper' || faker.number.int({ min: 0, max: 9 }) < 7) {
        add(purchase.userKey, purchase.productKey, true, new Date(Math.min(purchase.deliveredAt.getTime() + 2 * DAY, now.getTime())));
      }
    }

    const verifiedCount = docs.length;
    const customers = people.filter((p) => p.role === 'user' && !p.isBlocked);

    for (const product of PRODUCTS.filter((p) => p.isListed)) {
      for (const reviewer of faker.helpers.arrayElements(customers, { min: 0, max: 2 })) {
        const ageDays = Math.floor((now.getTime() - reviewer.createdAt.getTime()) / DAY);
        add(reviewer.key, product.key, false, daysBefore(now, faker.number.int({ min: 2, max: Math.min(80, ageDays - 1) })));
      }
    }

    const showcase = docs.find((doc) => String(doc._id) === String(seedId('review:shopper:on-cloud-5')));
    if (showcase) Object.assign(showcase, { rating: 5, title: TITLES[5]![2], comment: COMMENTS[5]![0], images: REVIEW_IMAGES });

    // One moderated review, so the hidden state has something to show.
    const hidden = docs[verifiedCount];
    if (hidden) Object.assign(hidden, { rating: 2, title: 'Check my profile for deals', comment: 'Cheaper copies available, message me.', isHidden: true });

    const inserted = await insertMissing(Review, docs);
    log(`${inserted} of ${docs.length} inserted`);
  }
};

export const subscribersSeeder: Seeder = {
  name: 'subscribers',
  models: [Subscriber],
  run: async ({ log }) => {
    const { now } = seedWorld();

    const docs = Array.from({ length: 10 }, (_, i) => ({
      _id: seedId(`subscriber:${i}`),
      email: faker.internet.email({ provider: 'example.com' }).toLowerCase(),
      consented: faker.datatype.boolean({ probability: 0.8 }),
      createdAt: daysBefore(now, faker.number.int({ min: 1, max: 120 }))
    }));

    const inserted = await insertMissing(Subscriber, docs);
    log(`${inserted} of ${docs.length} inserted`);
  }
};
