import { seedId } from '../seed-id';

export interface SeedCoupon {
  key: string;
  code: string;
  name: string;
  description: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minimumOrderValue: number;
  maximumDiscountAmount: number | null;
  usageLimit: number | null;
  userLimit: number;
  /** Negative values are in the future. */
  validFromDaysAgo: number;
  validToDaysAgo: number;
  isActive: boolean;
}

/** One coupon per state the checkout has to handle. */
export const COUPONS: SeedCoupon[] = [
  {
    key: 'welcome10',
    code: 'WELCOME10',
    name: 'Welcome offer',
    description: '10% off your first order, up to ₹500',
    discountType: 'percentage',
    discountValue: 10,
    minimumOrderValue: 1000,
    maximumDiscountAmount: 500,
    usageLimit: null,
    userLimit: 1,
    validFromDaysAgo: 120,
    validToDaysAgo: -180,
    isActive: true
  },
  {
    key: 'flat500',
    code: 'FLAT500',
    name: 'Flat ₹500 off',
    description: '₹500 off orders of ₹5,000 or more',
    discountType: 'fixed',
    discountValue: 500,
    minimumOrderValue: 5000,
    maximumDiscountAmount: null,
    usageLimit: null,
    userLimit: 2,
    validFromDaysAgo: 90,
    validToDaysAgo: -90,
    isActive: true
  },
  {
    key: 'sneakerhead15',
    code: 'SNEAKERHEAD15',
    name: 'Sneakerhead',
    description: '15% off orders of ₹20,000 or more, up to ₹3,000',
    discountType: 'percentage',
    discountValue: 15,
    minimumOrderValue: 20000,
    maximumDiscountAmount: 3000,
    usageLimit: null,
    userLimit: 1,
    validFromDaysAgo: 30,
    validToDaysAgo: -60,
    isActive: true
  },
  {
    key: 'limited1000',
    code: 'LIMITED1000',
    name: 'First come, first served',
    description: '₹1,000 off orders of ₹8,000 or more, one use in total',
    discountType: 'fixed',
    discountValue: 1000,
    minimumOrderValue: 8000,
    maximumDiscountAmount: null,
    usageLimit: 1,
    userLimit: 1,
    validFromDaysAgo: 90,
    validToDaysAgo: -30,
    isActive: true
  },
  {
    key: 'monsoon20',
    code: 'MONSOON20',
    name: 'Monsoon sale',
    description: '20% off, up to ₹1,500 (ended)',
    discountType: 'percentage',
    discountValue: 20,
    minimumOrderValue: 3000,
    maximumDiscountAmount: 1500,
    usageLimit: null,
    userLimit: 1,
    validFromDaysAgo: 120,
    validToDaysAgo: 30,
    isActive: true
  },
  {
    key: 'festive25',
    code: 'FESTIVE25',
    name: 'Festive preview',
    description: '25% off, up to ₹2,500 (switched off)',
    discountType: 'percentage',
    discountValue: 25,
    minimumOrderValue: 2000,
    maximumDiscountAmount: 2500,
    usageLimit: null,
    userLimit: 1,
    validFromDaysAgo: 10,
    validToDaysAgo: -30,
    isActive: false
  },
  {
    key: 'newyear30',
    code: 'NEWYEAR30',
    name: 'New year',
    description: '30% off, up to ₹3,000 (not started yet)',
    discountType: 'percentage',
    discountValue: 30,
    minimumOrderValue: 4000,
    maximumDiscountAmount: 3000,
    usageLimit: null,
    userLimit: 1,
    validFromDaysAgo: -30,
    validToDaysAgo: -60,
    isActive: true
  }
];

export const couponId = (key: string) => seedId(`coupon:${key}`);

export const getCoupon = (key: string): SeedCoupon => {
  const coupon = COUPONS.find((c) => c.key === key);
  if (!coupon) throw new Error(`Unknown seed coupon: ${key}`);
  return coupon;
};

export const couponDiscount = (coupon: SeedCoupon, amount: number): number =>
  coupon.discountType === 'fixed'
    ? Math.min(coupon.discountValue, amount)
    : Math.min(Math.round((amount * coupon.discountValue) / 100), coupon.maximumDiscountAmount ?? Infinity);
