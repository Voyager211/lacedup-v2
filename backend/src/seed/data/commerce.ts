import { Faker, base, en } from '@faker-js/faker';
import type { Types } from 'mongoose';
import {
  CANCELLATION_REASONS,
  ORDER_STATUS,
  PAYMENT_STATUS,
  RETURN_REASONS,
  type OrderStatus,
  type PaymentStatus
} from '../../common/constants/order.constants';
import { seedId } from '../seed-id';
import { PRODUCTS, finalPrice, getProduct, productId, variantId, variantSku, type SeedProduct } from './catalog';
import { couponDiscount, couponId, getCoupon } from './coupons';
import { DAY, HOUR, addressBookId, daysBefore, userId, type SeedUser } from './people';

type Doc = Record<string, unknown>;
type Method = 'cod' | 'upi' | 'wallet';
type Scenario = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'return-requested' | 'returned';

interface LineSpec {
  product: string;
  size: string;
  quantity: number;
}

interface OrderSpec {
  key: string;
  userKey: string;
  method: Method;
  scenario: Scenario;
  daysAgo: number;
  lines: LineSpec[];
  coupon?: string;
  addressIndex?: number;
}

interface LedgerEntry {
  at: Date;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  paymentMethod: 'razorpay' | 'manual_credit' | 'refund' | 'payment_for_order' | 'referral_reward';
  orderId?: string;
  returnId?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
}

export interface CouponUse {
  user: Types.ObjectId;
  usedAt: Date;
  orderId: Types.ObjectId;
}

export interface Purchase {
  userKey: string;
  productKey: string;
  deliveredAt: Date;
}

export interface CommercePlan {
  orders: Doc[];
  returns: Doc[];
  transactions: Doc[];
  wallets: Doc[];
  referrals: Doc[];
  couponUsage: Map<string, CouponUse[]>;
  purchases: Purchase[];
}

const COD_LIMIT = 10_000;
const STEP = 36 * HOUR;

/** The status each scenario passes through, in order. Items and orders share it. */
const FLOW: Record<Scenario, OrderStatus[]> = {
  pending: [ORDER_STATUS.PENDING],
  processing: [ORDER_STATUS.PENDING, ORDER_STATUS.PROCESSING],
  shipped: [ORDER_STATUS.PENDING, ORDER_STATUS.PROCESSING, ORDER_STATUS.SHIPPED],
  delivered: [ORDER_STATUS.PENDING, ORDER_STATUS.PROCESSING, ORDER_STATUS.SHIPPED, ORDER_STATUS.DELIVERED],
  cancelled: [ORDER_STATUS.PENDING, ORDER_STATUS.CANCELLED],
  'return-requested': [
    ORDER_STATUS.PENDING,
    ORDER_STATUS.PROCESSING,
    ORDER_STATUS.SHIPPED,
    ORDER_STATUS.DELIVERED,
    ORDER_STATUS.PROCESSING_RETURN
  ],
  returned: [
    ORDER_STATUS.PENDING,
    ORDER_STATUS.PROCESSING,
    ORDER_STATUS.SHIPPED,
    ORDER_STATUS.DELIVERED,
    ORDER_STATUS.PROCESSING_RETURN,
    ORDER_STATUS.RETURNED
  ]
};

const NOTES: Partial<Record<OrderStatus, string>> = {
  [ORDER_STATUS.PENDING]: 'Order placed',
  [ORDER_STATUS.PROCESSING]: 'Order confirmed and packed',
  [ORDER_STATUS.SHIPPED]: 'Handed to the courier',
  [ORDER_STATUS.DELIVERED]: 'Delivered',
  [ORDER_STATUS.CANCELLED]: 'Cancelled by the customer',
  [ORDER_STATUS.PROCESSING_RETURN]: 'Return requested',
  [ORDER_STATUS.RETURNED]: 'Return approved, refunded to wallet'
};

/** The demo shopper sees one order in every state. */
const HAND_WRITTEN: OrderSpec[] = [
  {
    key: 'shopper-1',
    userKey: 'shopper',
    method: 'upi',
    scenario: 'delivered',
    daysAgo: 40,
    lines: [
      { product: 'adidas-stan-smith', size: '8', quantity: 1 },
      { product: 'nike-court-vision', size: '9', quantity: 1 }
    ],
    coupon: 'welcome10'
  },
  {
    key: 'shopper-2',
    userKey: 'shopper',
    method: 'upi',
    scenario: 'delivered',
    daysAgo: 25,
    lines: [{ product: 'on-cloud-5', size: '9', quantity: 1 }]
  },
  {
    key: 'shopper-3',
    userKey: 'shopper',
    method: 'upi',
    scenario: 'returned',
    daysAgo: 30,
    lines: [{ product: 'adidas-gazelle', size: '10', quantity: 1 }]
  },
  {
    key: 'shopper-4',
    userKey: 'shopper',
    method: 'cod',
    scenario: 'return-requested',
    daysAgo: 14,
    lines: [{ product: 'keds-champion', size: '9', quantity: 1 }],
    addressIndex: 1
  },
  {
    key: 'shopper-5',
    userKey: 'shopper',
    method: 'upi',
    scenario: 'cancelled',
    daysAgo: 8,
    lines: [{ product: 'nike-metcon-9', size: '10', quantity: 1 }]
  },
  {
    key: 'shopper-6',
    userKey: 'shopper',
    method: 'wallet',
    scenario: 'shipped',
    daysAgo: 5,
    lines: [{ product: 'nb-650', size: '8', quantity: 1 }]
  },
  {
    key: 'shopper-7',
    userKey: 'shopper',
    method: 'cod',
    scenario: 'pending',
    daysAgo: 1,
    lines: [
      { product: 'cariuma-oca-low', size: '8', quantity: 1 },
      { product: 'keds-champion', size: '6', quantity: 1 }
    ]
  },
  {
    // Uses up LIMITED1000, whose usage limit is 1.
    key: 'user-2-limited',
    userKey: 'user-2',
    method: 'upi',
    scenario: 'delivered',
    daysAgo: 20,
    lines: [{ product: 'lacoste-l003', size: '9', quantity: 1 }],
    coupon: 'limited1000'
  }
];

const priceLines = (lines: LineSpec[]) => {
  const priced = lines.map((line) => {
    const product = getProduct(line.product);
    return { product, size: line.size, quantity: line.quantity, price: finalPrice(product, line.size) };
  });

  const subtotal = priced.reduce((sum, l) => sum + l.product.regularPrice * l.quantity, 0);
  const amountAfterDiscount = priced.reduce((sum, l) => sum + l.price * l.quantity, 0);

  return {
    lines: priced,
    subtotal,
    totalDiscount: subtotal - amountAfterDiscount,
    amountAfterDiscount,
    shipping: amountAfterDiscount >= 500 ? 0 : 50,
    totalItemCount: priced.reduce((sum, l) => sum + l.quantity, 0)
  };
};

/** Mirrors updateAutomatedPaymentStatus in order.service. */
const paymentStatusFor = (method: Method, scenario: Scenario): PaymentStatus => {
  if (method === 'cod') {
    if (scenario === 'cancelled') return PAYMENT_STATUS.CANCELLED;
    if (scenario === 'returned') return PAYMENT_STATUS.REFUNDED;
    if (scenario === 'delivered' || scenario === 'return-requested') return PAYMENT_STATUS.COMPLETED;
    return PAYMENT_STATUS.PENDING;
  }
  return scenario === 'cancelled' || scenario === 'returned' ? PAYMENT_STATUS.REFUNDED : PAYMENT_STATUS.COMPLETED;
};

const inStock = (product: SeedProduct) => product.isListed && product.variants.some((v) => v.stock > 0);

const generateSpecs = (f: Faker, now: Date, people: SeedUser[]): OrderSpec[] => {
  const specs: OrderSpec[] = [];
  const buyable = PRODUCTS.filter(inStock);
  const flatUses = new Map<string, number>();

  for (const user of people.filter((p) => p.key.startsWith('user-'))) {
    const ageDays = Math.floor((now.getTime() - user.createdAt.getTime()) / DAY);
    const count = f.number.int({ min: 0, max: 3 });

    for (let n = 1; n <= count; n++) {
      const scenario = f.helpers.weightedArrayElement<Scenario>([
        { weight: 45, value: 'delivered' },
        { weight: 10, value: 'shipped' },
        { weight: 10, value: 'processing' },
        { weight: 10, value: 'pending' },
        { weight: 15, value: 'cancelled' },
        { weight: 5, value: 'returned' },
        { weight: 5, value: 'return-requested' }
      ]);

      const minDays = Math.ceil((FLOW[scenario].length - 1) * 1.5) + 1;
      const lines = f.helpers.arrayElements(buyable, { min: 1, max: 2 }).map((product) => ({
        product: product.key,
        size: f.helpers.arrayElement(product.variants.filter((v) => v.stock > 0)).size,
        quantity: f.helpers.weightedArrayElement([
          { weight: 85, value: 1 },
          { weight: 15, value: 2 }
        ])
      }));

      const { amountAfterDiscount } = priceLines(lines);
      const flatCount = flatUses.get(user.key) ?? 0;
      const coupon =
        scenario !== 'cancelled' && amountAfterDiscount >= 5000 && flatCount < 2 && f.number.int({ min: 0, max: 9 }) < 3
          ? 'flat500'
          : undefined;
      if (coupon) flatUses.set(user.key, flatCount + 1);

      const total = amountAfterDiscount - (coupon ? getCoupon(coupon).discountValue : 0);

      specs.push({
        key: `${user.key}-${n}`,
        userKey: user.key,
        method: total < COD_LIMIT && f.datatype.boolean() ? 'cod' : 'upi',
        scenario,
        daysAgo: f.number.int({ min: minDays, max: Math.min(89, ageDays - 1) }),
        lines,
        coupon,
        addressIndex: f.number.int({ min: 0, max: user.addresses.length - 1 })
      });
    }
  }

  return specs;
};

/**
 * Orders and everything that follows from them, built together so they agree:
 * returns for returned items, payment transactions for online orders, coupon
 * usage, and wallets whose balances are the sum of their own ledger.
 */
export const buildCommerce = (now: Date, people: SeedUser[]): CommercePlan => {
  const f = new Faker({ locale: [en, base] });
  f.seed(4815162342);

  const byKey = new Map(people.map((p) => [p.key, p]));
  const specs = [...HAND_WRITTEN, ...generateSpecs(f, now, people)];

  const orders: Doc[] = [];
  const returns: Doc[] = [];
  const transactions: Doc[] = [];
  const referrals: Doc[] = [];
  const purchases: Purchase[] = [];
  const couponUsage = new Map<string, CouponUse[]>();
  const ledger = new Map<string, LedgerEntry[]>();

  const addLedger = (userKey: string, entry: LedgerEntry) => {
    ledger.set(userKey, [...(ledger.get(userKey) ?? []), entry]);
  };

  for (const spec of specs) {
    const user = byKey.get(spec.userKey);
    if (!user) throw new Error(`Seed order ${spec.key} belongs to unknown user ${spec.userKey}`);

    const createdAt = new Date(daysBefore(now, spec.daysAgo).getTime() + f.number.int({ min: 9, max: 20 }) * HOUR);
    const timeline = FLOW[spec.scenario].map((status, i) => ({ status, at: new Date(createdAt.getTime() + i * STEP) }));
    const last = timeline[timeline.length - 1]!;
    if (last.at > now) throw new Error(`Seed order ${spec.key} ends in the future; raise its daysAgo`);

    const statusAt = (status: OrderStatus) => timeline.find((t) => t.status === status)?.at;
    const history = () => timeline.map(({ status, at }) => ({ status, updatedAt: at, notes: NOTES[status] }));

    const _id = seedId(`order:${spec.key}`);
    const orderId = `ORD-${createdAt.getTime().toString(36).toUpperCase()}-${f.string.alphanumeric({ length: 6, casing: 'upper' })}`;
    const pricing = priceLines(spec.lines);
    const coupon = spec.coupon ? getCoupon(spec.coupon) : null;
    const discount = coupon ? couponDiscount(coupon, pricing.amountAfterDiscount) : 0;
    const totalAmount = pricing.amountAfterDiscount + pricing.shipping - discount;

    if (spec.method === 'cod' && totalAmount >= COD_LIMIT) {
      throw new Error(`Seed order ${spec.key} is COD over ₹${COD_LIMIT}, which checkout refuses`);
    }

    const paymentStatus = paymentStatusFor(spec.method, spec.scenario);
    const cancelled = spec.scenario === 'cancelled';
    const returning = spec.scenario === 'return-requested' || spec.scenario === 'returned';
    const cancellationReason = cancelled ? f.helpers.arrayElement(Object.values(CANCELLATION_REASONS)) : undefined;
    const returnReason = returning ? f.helpers.arrayElement(Object.values(RETURN_REASONS)) : undefined;
    const razorpay =
      spec.method === 'upi'
        ? { orderId: `order_${f.string.alphanumeric(14)}`, paymentId: `pay_${f.string.alphanumeric(14)}` }
        : null;

    const items = pricing.lines.map((line, index) => ({
      _id: seedId(`order-item:${spec.key}:${index}`),
      productId: productId(line.product.key),
      variantId: variantId(line.product.key, line.size),
      sku: variantSku(line.product, line.size),
      size: line.size,
      quantity: line.quantity,
      price: line.price,
      totalPrice: line.price * line.quantity,
      status: last.status,
      paymentStatus,
      statusHistory: history(),
      cancellationReason,
      cancellationDate: cancelled ? statusAt(ORDER_STATUS.CANCELLED) : undefined,
      returnReason,
      returnRequestDate: returning ? statusAt(ORDER_STATUS.PROCESSING_RETURN) : undefined
    }));

    orders.push({
      _id,
      orderId,
      orderDocumentId: _id,
      user: userId(user.key),
      items,
      deliveryAddress: { addressId: addressBookId(user.key), addressIndex: spec.addressIndex ?? 0 },
      couponApplied: coupon ? couponId(coupon.key) : null,
      couponDiscount: discount,
      couponCode: coupon?.code ?? null,
      paymentMethod: spec.method,
      paymentStatus,
      subtotal: pricing.subtotal,
      totalDiscount: pricing.totalDiscount,
      amountAfterDiscount: pricing.amountAfterDiscount,
      shipping: pricing.shipping,
      totalAmount,
      totalItemCount: pricing.totalItemCount,
      razorpayOrderId: razorpay?.orderId ?? null,
      razorpayPaymentId: razorpay?.paymentId ?? null,
      status: last.status,
      statusHistory: history(),
      cancellationReason,
      cancellationDate: cancelled ? statusAt(ORDER_STATUS.CANCELLED) : undefined,
      returnReason,
      returnRequestDate: returning ? statusAt(ORDER_STATUS.PROCESSING_RETURN) : undefined,
      createdAt,
      updatedAt: last.at
    });

    if (coupon) {
      couponUsage.set(coupon.key, [
        ...(couponUsage.get(coupon.key) ?? []),
        { user: userId(user.key), usedAt: createdAt, orderId: _id }
      ]);
    }

    const deliveredAt = statusAt(ORDER_STATUS.DELIVERED);
    if (deliveredAt && spec.scenario !== 'returned') {
      for (const line of pricing.lines) purchases.push({ userKey: user.key, productKey: line.product.key, deliveredAt });
    }

    if (spec.method !== 'cod') {
      transactions.push({
        _id: seedId(`transaction:${spec.key}`),
        transactionId: `TXN${createdAt.getTime()}${f.string.numeric(3)}`,
        userId: userId(user.key),
        type: 'ORDER_PAYMENT',
        paymentMethod: spec.method,
        amount: totalAmount,
        currency: 'INR',
        status: 'COMPLETED',
        gatewayDetails: razorpay
          ? {
              razorpayOrderId: razorpay.orderId,
              razorpayPaymentId: razorpay.paymentId,
              razorpaySignature: f.string.hexadecimal({ length: 64, casing: 'lower', prefix: '' })
            }
          : {},
        orderId,
        orderData: {
          deliveryAddressId: addressBookId(user.key),
          items: pricing.lines.map((line) => ({
            productId: productId(line.product.key),
            variantId: variantId(line.product.key, line.size),
            sku: variantSku(line.product, line.size),
            size: line.size,
            quantity: line.quantity,
            price: line.price,
            totalPrice: line.price * line.quantity,
            regularPrice: line.product.regularPrice
          })),
          pricing: {
            subtotal: pricing.subtotal,
            totalDiscount: pricing.totalDiscount,
            amountAfterDiscount: pricing.amountAfterDiscount,
            shipping: pricing.shipping,
            total: totalAmount,
            totalItemCount: pricing.totalItemCount
          }
        },
        metadata: { retryCount: 0 },
        statusHistory: [
          { status: 'INITIATED', updatedAt: createdAt, notes: 'Payment initiated' },
          { status: 'COMPLETED', updatedAt: createdAt, notes: `Transaction completed for order ${orderId}` }
        ],
        // A completed payment never expires; the TTL index would delete it otherwise.
        expiresAt: null,
        createdAt
      });
    }

    if (spec.method === 'wallet') {
      addLedger(user.key, {
        at: createdAt,
        type: 'debit',
        amount: totalAmount,
        description: `Payment for order ${orderId}`,
        paymentMethod: 'payment_for_order',
        orderId
      });
    }

    if (cancelled && spec.method !== 'cod') {
      addLedger(user.key, {
        at: statusAt(ORDER_STATUS.CANCELLED)!,
        type: 'credit',
        amount: totalAmount,
        description: `Refund for cancelled order ${orderId}`,
        paymentMethod: 'refund',
        orderId
      });
    }

    if (returning) {
      items.forEach((item, index) => {
        const line = pricing.lines[index]!;
        const returnId = `RET${String(returns.length + 1).padStart(6, '0')}`;
        const requestedAt = statusAt(ORDER_STATUS.PROCESSING_RETURN)!;
        const approvedAt = statusAt(ORDER_STATUS.RETURNED);
        const done = Boolean(approvedAt);

        returns.push({
          _id: seedId(`return:${spec.key}:${index}`),
          returnId,
          orderId,
          itemId: item._id,
          userId: userId(user.key),
          productId: item.productId,
          productName: line.product.name,
          productImage: line.product.images[0],
          sku: item.sku,
          size: item.size,
          quantity: item.quantity,
          price: item.price,
          totalPrice: item.totalPrice,
          reason: returnReason,
          status: done ? 'Completed' : 'Pending',
          requestDate: requestedAt,
          processedDate: approvedAt,
          processedBy: done ? userId('admin') : undefined,
          approvedAt,
          approvedBy: done ? userId('admin').toHexString() : undefined,
          adminNotes: done ? 'Inspected and accepted; refunded to wallet' : undefined,
          refundAmount: done ? item.totalPrice : undefined,
          refundMethod: 'Wallet',
          refundStatus: done ? 'Processed' : 'Pending',
          statusHistory: [
            { status: 'Pending', updatedAt: requestedAt, notes: 'Return requested', updatedBy: userId(user.key) },
            ...(done
              ? [
                  { status: 'Approved', updatedAt: approvedAt, notes: 'Return approved', updatedBy: userId('admin') },
                  { status: 'Completed', updatedAt: approvedAt, notes: 'Refund issued to wallet', updatedBy: userId('admin') }
                ]
              : [])
          ],
          createdAt: requestedAt,
          updatedAt: approvedAt ?? requestedAt
        });

        if (done) {
          addLedger(user.key, {
            at: approvedAt!,
            type: 'credit',
            amount: item.totalPrice,
            description: `Refund for returned item in order ${orderId}`,
            paymentMethod: 'refund',
            orderId,
            returnId
          });
        }
      });
    }
  }

  for (const referee of people.filter((p) => p.referredBy)) {
    const referrer = byKey.get(referee.referredBy!)!;

    referrals.push({
      _id: seedId(`referral:${referee.key}`),
      referrer: userId(referrer.key),
      referee: userId(referee.key),
      referralCode: referrer.referralCode,
      rewardAmount: 300,
      status: 'completed',
      rewardGivenAt: referee.createdAt,
      createdAt: referee.createdAt
    });

    addLedger(referee.key, {
      at: referee.createdAt,
      type: 'credit',
      amount: 100,
      description: 'Referral welcome bonus',
      paymentMethod: 'referral_reward'
    });
    addLedger(referrer.key, {
      at: referee.createdAt,
      type: 'credit',
      amount: 300,
      description: `Referral reward for inviting ${referee.name}`,
      paymentMethod: 'referral_reward'
    });
  }

  addLedger('shopper', {
    at: new Date(daysBefore(now, 35).getTime() + 11 * HOUR),
    type: 'credit',
    amount: 2000,
    description: 'Wallet top-up',
    paymentMethod: 'razorpay',
    razorpayOrderId: `order_${f.string.alphanumeric(14)}`,
    razorpayPaymentId: `pay_${f.string.alphanumeric(14)}`
  });
  addLedger('user-4', {
    at: new Date(daysBefore(now, 20).getTime() + 15 * HOUR),
    type: 'credit',
    amount: 500,
    description: 'Added to wallet',
    paymentMethod: 'manual_credit'
  });

  const wallets = people
    .filter((p) => p.role === 'user')
    .map((user) => {
      const entries = [...(ledger.get(user.key) ?? [])].sort((a, b) => a.at.getTime() - b.at.getTime());
      let balance = 0;

      const walletTransactions = entries.map((entry, index) => {
        balance += entry.type === 'credit' ? entry.amount : -entry.amount;
        if (balance < 0) throw new Error(`Seed wallet for ${user.key} goes negative at ${entry.description}`);

        return {
          _id: seedId(`wallet-transaction:${user.key}:${index}`),
          transactionId: `TXN${entry.at.getTime()}${String(index).padStart(4, '0')}`,
          type: entry.type,
          amount: entry.amount,
          description: entry.description,
          paymentMethod: entry.paymentMethod,
          status: 'completed',
          orderId: entry.orderId,
          returnId: entry.returnId,
          razorpayOrderId: entry.razorpayOrderId,
          razorpayPaymentId: entry.razorpayPaymentId,
          balanceAfter: balance,
          date: entry.at
        };
      });

      return {
        _id: seedId(`wallet:${user.key}`),
        userId: userId(user.key),
        balance,
        transactions: walletTransactions,
        createdAt: user.createdAt,
        updatedAt: entries.at(-1)?.at ?? user.createdAt
      };
    });

  return { orders, returns, transactions, wallets, referrals, couponUsage, purchases };
};
