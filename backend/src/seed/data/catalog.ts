import slugify from 'slugify';
import { getBrandCode, getProductCode, getVariantCode } from '../../modules/catalog/sku.util';
import { seedId } from '../seed-id';

/**
 * The seeded catalog.
 *
 * Every image is one already committed under backend/public/uploads, and each
 * product's brand and category match what its photos show.
 */

type BrandKey =
  | 'on'
  | 'new-balance'
  | 'under-armour'
  | 'zara'
  | 'dolce-gabbana'
  | 'lacoste'
  | 'golden-goose'
  | 'keds'
  | 'adidas'
  | 'nike'
  | 'cariuma';

type CategoryKey = 'running' | 'luxury' | 'gym' | 'casual' | 'retro';

export interface SeedBrand {
  key: BrandKey;
  name: string;
  description: string;
  image: string;
  offer: number;
}

export interface SeedCategory {
  key: CategoryKey;
  name: string;
  description: string;
  image: string;
  offer: number;
}

export interface SeedVariant {
  size: string;
  stock: number;
  basePrice: number;
  offer: number;
}

export interface SeedProduct {
  key: string;
  name: string;
  brand: BrandKey;
  category: CategoryKey;
  regularPrice: number;
  offer: number;
  description: string;
  features: string;
  images: string[];
  variants: SeedVariant[];
  sold: number;
  isListed: boolean;
  daysAgo: number;
}

const brandImage = (id: string) => `/uploads/brands/brand-${id}.webp`;
const categoryImage = (id: string) => `/uploads/categories/category-${id}.webp`;
const productImages = (...files: string[]) => files.map((file) => `/uploads/products/${file}.webp`);

// Offers are multiples of 5 and base prices multiples of 20, so every final price is a whole rupee.
export const BRANDS: SeedBrand[] = [
  { key: 'adidas', name: 'Adidas', description: 'Three stripes since 1949.', image: brandImage('1769953124086'), offer: 10 },
  { key: 'cariuma', name: 'Cariuma', description: 'Sustainable canvas and leather sneakers.', image: brandImage('1769953164371'), offer: 0 },
  { key: 'dolce-gabbana', name: 'Dolce & Gabbana', description: 'Italian luxury, made in Milan.', image: brandImage('1769952697999'), offer: 0 },
  { key: 'golden-goose', name: 'Golden Goose', description: 'Hand-distressed Italian sneakers.', image: brandImage('1769952875589'), offer: 0 },
  { key: 'keds', name: 'Keds', description: 'The original canvas sneaker.', image: brandImage('1769952961959'), offer: 0 },
  { key: 'lacoste', name: 'Lacoste', description: 'French sportswear with the crocodile.', image: brandImage('1769952741039'), offer: 0 },
  { key: 'new-balance', name: 'New Balance', description: 'Heritage running and lifestyle.', image: brandImage('1769952527986'), offer: 0 },
  { key: 'nike', name: 'Nike', description: 'Just do it.', image: brandImage('1769953141379'), offer: 5 },
  { key: 'on', name: 'On', description: 'Swiss-engineered running shoes.', image: brandImage('1769951323302'), offer: 0 },
  { key: 'under-armour', name: 'Under Armour', description: 'Performance training gear.', image: brandImage('1769952557706'), offer: 0 },
  { key: 'zara', name: 'Zara', description: 'Everyday fashion sneakers.', image: brandImage('1769952642041'), offer: 0 }
];

export const CATEGORIES: SeedCategory[] = [
  { key: 'casual', name: 'Casual Sneakers', description: 'Easy everyday pairs.', image: categoryImage('1769949298860'), offer: 0 },
  { key: 'gym', name: 'Gym Sneakers', description: 'Stable, grippy trainers for lifting and HIIT.', image: categoryImage('1769949278707'), offer: 10 },
  { key: 'luxury', name: 'Luxury Sneakers', description: 'Designer pairs from the fashion houses.', image: categoryImage('1769949261243'), offer: 0 },
  { key: 'retro', name: 'Retro Classics', description: 'Court and terrace icons, reissued.', image: categoryImage('1769949315658'), offer: 0 },
  { key: 'running', name: 'Running Shoes', description: 'Cushioned, breathable, built for miles.', image: categoryImage('1769949220352'), offer: 0 }
];

const SIZES = ['6', '7', '8', '9', '10', '11'];

/** Stock varies by product and size, but never by run. */
const sizes = (
  seed: number,
  basePrice: number,
  overrides: Partial<Record<string, Partial<SeedVariant>>> = {}
): SeedVariant[] =>
  SIZES.map((size, i) => ({
    size,
    stock: ((seed * 7 + i * 5) % 11) + 2,
    basePrice,
    offer: 0,
    ...overrides[size]
  }));

const soldOut = Object.fromEntries(SIZES.map((size) => [size, { stock: 0 }]));

export const PRODUCTS: SeedProduct[] = [
  {
    key: 'dg-daymaster',
    name: 'Daymaster Sneaker',
    brand: 'dolce-gabbana',
    category: 'luxury',
    regularPrice: 64999,
    offer: 0,
    description: 'Chunky calfskin sneaker with an oversized sculpted sole and the DG logo on the side.',
    features: 'Calfskin upper, Rubber sole, DG logo patch, Made in Italy',
    images: productImages('1751860497093-0', '1751860497094-1', '1751860497095-2'),
    variants: sizes(1, 58000),
    sold: 14,
    isListed: true,
    daysAgo: 160
  },
  {
    key: 'ua-charged-engage',
    name: 'Charged Engage 2',
    brand: 'under-armour',
    category: 'gym',
    regularPrice: 7999,
    offer: 15,
    description: 'A training shoe with Charged Cushioning and a wide, stable base for lifts and circuits.',
    features: 'Charged Cushioning midsole, Breathable mesh upper, Durable rubber outsole',
    images: productImages('1752235456269-0', '1752235456270-1', '1752235456270-2', '1752236390775-0'),
    variants: sizes(2, 6980),
    sold: 96,
    isListed: true,
    daysAgo: 150
  },
  {
    key: 'keds-champion',
    name: 'Champion Canvas',
    brand: 'keds',
    category: 'casual',
    regularPrice: 3999,
    offer: 0,
    description: 'The lace-up canvas classic, lightweight and easy to wear with anything.',
    features: 'Cotton canvas upper, Cushioned insole, Flexible rubber sole',
    images: productImages('1752580836680-0', '1752580836680-1', '1752580836681-2', '1752580836681-3'),
    variants: sizes(3, 3480),
    sold: 132,
    isListed: true,
    daysAgo: 140
  },
  {
    key: 'nike-aj1-dior',
    name: 'Air Jordan 1 High Dior',
    brand: 'nike',
    category: 'retro',
    regularPrice: 24999,
    offer: 0,
    description: 'The grey-and-white high top with Dior Oblique jacquard on the Swoosh.',
    features: 'Italian leather upper, Oblique jacquard Swoosh, Translucent icy sole',
    images: productImages('1753313579468-0', '1753313579468-1', '1753313579469-2', '1753332817127-0'),
    variants: sizes(4, 22000),
    sold: 41,
    isListed: true,
    daysAgo: 120
  },
  {
    key: 'zara-suede-retro',
    name: 'Retro Suede Sneaker',
    brand: 'zara',
    category: 'casual',
    regularPrice: 4290,
    offer: 0,
    description: 'Black suede low top with a contrast side stripe and a cream sole.',
    features: 'Suede upper, Contrast stripe, Rubber cupsole',
    images: productImages('1753355602582-0', '1753355602584-1', '1753355602585-2'),
    variants: sizes(5, 3980),
    sold: 8,
    // Unlisted: visible in the admin panel only.
    isListed: false,
    daysAgo: 110
  },
  {
    key: 'gg-superstar',
    name: 'Super-Star',
    brand: 'golden-goose',
    category: 'luxury',
    regularPrice: 42999,
    offer: 10,
    description: 'Hand-distressed leather sneaker with the signature star and a worn-in finish.',
    features: 'Hand-distressed leather, Star patch, Suede heel tab, Made in Italy',
    images: productImages('1753449725720-0', '1753449725720-1', '1753449725720-2', '1753459733940-0'),
    variants: sizes(6, 39000),
    sold: 23,
    isListed: true,
    daysAgo: 100
  },
  {
    key: 'cariuma-oca-low',
    name: 'OCA Low Canvas',
    brand: 'cariuma',
    category: 'casual',
    regularPrice: 6999,
    offer: 0,
    description: 'Organic cotton canvas low top on a natural rubber gum sole.',
    features: 'Organic cotton canvas, Natural rubber sole, Recycled PET laces',
    images: productImages('1753501014819-0', '1753501014821-1', '1753501014822-2'),
    variants: sizes(7, 6200),
    sold: 57,
    isListed: true,
    daysAgo: 90
  },
  {
    key: 'nb-650',
    name: '650 High',
    brand: 'new-balance',
    category: 'retro',
    regularPrice: 11999,
    offer: 0,
    description: 'The late-80s basketball high top, reissued in clean white leather.',
    features: 'Leather upper, Padded collar, Rubber cupsole',
    images: productImages('1755949066614-0', '1755949066614-1', '1755949066615-2'),
    variants: sizes(8, 10800, { '11': { stock: 0 } }),
    sold: 64,
    isListed: true,
    daysAgo: 80
  },
  {
    key: 'nike-court-vision',
    name: 'Court Vision Low',
    brand: 'nike',
    category: 'casual',
    regularPrice: 5695,
    offer: 0,
    description: 'Basketball-inspired low top with stitched overlays and a crisp black Swoosh.',
    features: 'Leather and synthetic upper, Foam midsole, Rubber outsole',
    images: productImages('1756300021303-0', '1756300021304-1', '1756300021305-2', '1756300021306-3'),
    variants: sizes(9, 4980),
    sold: 188,
    isListed: true,
    daysAgo: 70
  },
  {
    key: 'adidas-gazelle',
    name: 'Gazelle',
    brand: 'adidas',
    category: 'retro',
    regularPrice: 9999,
    offer: 0,
    description: 'The 1960s training shoe in royal blue suede with white stripes.',
    features: 'Suede upper, Leather lining, Gum rubber outsole',
    images: productImages('1756300041177-0', '1756300041179-1', '1756300041179-2', '1756300041180-3'),
    variants: sizes(10, 8800, { '11': { offer: 20 } }),
    sold: 151,
    isListed: true,
    daysAgo: 60
  },
  {
    key: 'lacoste-l003',
    name: 'L003 Neo',
    brand: 'lacoste',
    category: 'running',
    regularPrice: 13999,
    offer: 0,
    description: 'Layered runner silhouette in navy with a bold green sole.',
    features: 'Textile and leather upper, EVA midsole, Crocodile branding',
    images: productImages('1756300084328-0', '1756300084328-1', '1756300084328-2', '1756300084328-3'),
    variants: sizes(11, 12400),
    sold: 19,
    isListed: true,
    daysAgo: 50
  },
  {
    key: 'adidas-stan-smith',
    name: 'Stan Smith',
    brand: 'adidas',
    category: 'casual',
    regularPrice: 8999,
    offer: 0,
    description: 'The tennis icon in white leather with a green heel tab.',
    features: 'Leather upper, Perforated 3-Stripes, Rubber cupsole',
    images: productImages('1756300173984-0', '1756300173985-1', '1756300173986-2', '1756300173986-3'),
    variants: sizes(12, 7980),
    sold: 204,
    isListed: true,
    daysAgo: 40
  },
  {
    key: 'nike-af1-offwhite',
    name: 'Air Force 1 Mid Off-White',
    brand: 'nike',
    category: 'retro',
    regularPrice: 17999,
    offer: 0,
    description: 'Pine green collaboration with exposed foam, a zip tie and orange-tabbed laces.',
    features: 'Leather upper, Exposed foam tongue, Signature zip tie',
    images: productImages('1756300229902-0', '1756300229902-1', '1756300229902-2'),
    // Sold out in every size.
    variants: sizes(13, 16000, soldOut),
    sold: 75,
    isListed: true,
    daysAgo: 30
  },
  {
    key: 'nike-metcon-9',
    name: 'Metcon 9',
    brand: 'nike',
    category: 'gym',
    regularPrice: 12995,
    offer: 0,
    description: 'A flat, stable trainer with a Hyperlift heel insert and rope-climb wrap.',
    features: 'Hyperlift insert, Rope wrap, Wide flat heel, Durable mesh',
    images: productImages('1770351186387-0', '1770351186390-1', '1770351186391-2', '1770351186391-3'),
    variants: sizes(14, 11600),
    sold: 88,
    isListed: true,
    daysAgo: 20
  },
  {
    key: 'on-cloud-5',
    name: 'Cloud 5',
    brand: 'on',
    category: 'running',
    regularPrice: 13950,
    offer: 0,
    description: 'Lightweight everyday runner with CloudTec cushioning and speed laces.',
    features: 'CloudTec sole, Speed-lacing system, Recycled mesh upper',
    images: productImages('1770360750170-0', '1770360750172-1', '1770360750172-2'),
    variants: sizes(15, 12400),
    sold: 112,
    isListed: true,
    daysAgo: 10
  },
  {
    key: 'adidas-pureboost-5',
    name: 'Pureboost 5',
    brand: 'adidas',
    category: 'running',
    regularPrice: 10999,
    offer: 0,
    description: 'Responsive Boost running shoe with a wide forefoot for city miles.',
    features: 'Boost midsole, Engineered knit upper, Continental rubber outsole',
    images: productImages('1770372662428-0', '1770372662428-1', '1770372662428-2', '1770372662428-3'),
    variants: sizes(16, 9600),
    sold: 36,
    isListed: true,
    daysAgo: 3
  }
];

export const brandId = (key: string) => seedId(`brand:${key}`);
export const categoryId = (key: string) => seedId(`category:${key}`);
export const productId = (key: string) => seedId(`product:${key}`);
export const variantId = (productKey: string, size: string) => seedId(`variant:${productKey}:${size}`);

export const slugOf = (name: string): string => slugify(name, { lower: true, strict: true });

export const getProduct = (key: string): SeedProduct => {
  const product = PRODUCTS.find((p) => p.key === key);
  if (!product) throw new Error(`Unknown seed product: ${key}`);
  return product;
};

const brandOf = (product: SeedProduct) => BRANDS.find((b) => b.key === product.brand)!;
const categoryOf = (product: SeedProduct) => CATEGORIES.find((c) => c.key === product.category)!;

/** Same format as sku.util, which the pre-save hook uses. */
export const baseSku = (product: SeedProduct): string =>
  `${getBrandCode(brandOf(product).name)}-${getProductCode(product.name)}`;

export const variantSku = (product: SeedProduct, size: string): string => `${baseSku(product)}-${getVariantCode(size)}`;

/** The largest of the four offers wins, as in Product.calculateVariantFinalPrice. */
export const finalPrice = (product: SeedProduct, size: string): number => {
  const variant = product.variants.find((v) => v.size === size);
  if (!variant) throw new Error(`Seed product ${product.key} has no size ${size}`);

  const offer = Math.max(categoryOf(product).offer, brandOf(product).offer, product.offer, variant.offer);
  return (variant.basePrice * (100 - offer)) / 100;
};
