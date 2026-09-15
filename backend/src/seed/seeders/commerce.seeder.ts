import Coupon from '../../modules/coupons/coupon.model';
import Order from '../../modules/orders/order.model';
import Referral from '../../modules/referrals/referral.model';
import Return from '../../modules/returns/return.model';
import Transaction from '../../modules/wallet/transaction.model';
import Wallet from '../../modules/wallet/wallet.model';
import { COUPONS, couponId } from '../data/coupons';
import { daysBefore, userId } from '../data/people';
import { seedWorld } from '../data/world';
import { insertMissing, type Seeder } from '../runner';
import { seedId } from '../seed-id';

export const couponsSeeder: Seeder = {
  name: 'coupons',
  models: [Coupon],
  run: async ({ log }) => {
    const { now, commerce } = seedWorld();

    const inserted = await insertMissing(
      Coupon,
      COUPONS.map((coupon) => {
        const uses = commerce.couponUsage.get(coupon.key) ?? [];
        return {
          _id: couponId(coupon.key),
          code: coupon.code,
          name: coupon.name,
          description: coupon.description,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          minimumOrderValue: coupon.minimumOrderValue,
          maximumDiscountAmount: coupon.maximumDiscountAmount,
          usageLimit: coupon.usageLimit,
          usedCount: uses.length,
          userLimit: coupon.userLimit,
          validFrom: daysBefore(now, coupon.validFromDaysAgo),
          validTo: daysBefore(now, coupon.validToDaysAgo),
          isActive: coupon.isActive,
          createdBy: userId('admin'),
          usedBy: uses.map((use, index) => ({ _id: seedId(`coupon-use:${coupon.key}:${index}`), ...use })),
          createdAt: daysBefore(now, Math.max(coupon.validFromDaysAgo + 2, 3))
        };
      })
    );

    log(`${inserted} of ${COUPONS.length} inserted`);
  }
};

export const commerceSeeder: Seeder = {
  name: 'commerce',
  models: [Order, Return, Transaction, Wallet, Referral],
  run: async ({ log }) => {
    const { orders, returns, transactions, wallets, referrals } = seedWorld().commerce;

    const counts = [
      `${await insertMissing(Order, orders)} orders`,
      `${await insertMissing(Return, returns)} returns`,
      `${await insertMissing(Transaction, transactions)} payment transactions`,
      `${await insertMissing(Wallet, wallets)} wallets`,
      `${await insertMissing(Referral, referrals)} referrals`
    ];

    log(`${counts.join(', ')} inserted`);
  }
};
