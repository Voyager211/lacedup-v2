import type { Document, Types } from 'mongoose';

export type WalletTransactionType = 'credit' | 'debit';

export type WalletPaymentMethod =
  | 'razorpay'
  | 'manual_credit'
  | 'refund'
  | 'payment_for_order'
  | 'referral_reward';

export type WalletTransactionStatus = 'pending' | 'completed' | 'failed';

export interface IWalletTransaction {
  /** Assigned by Mongoose when the subdocument is saved. */
  _id?: Types.ObjectId;
  transactionId: string;
  type: WalletTransactionType;
  amount: number;
  description: string;
  paymentMethod: WalletPaymentMethod;
  status: WalletTransactionStatus;

  // Order and return references (optional)
  orderId?: string;
  returnId?: string;

  // Razorpay specific fields
  razorpayOrderId?: string;
  razorpayPaymentId?: string;

  /** Wallet balance immediately after this transaction was applied. */
  balanceAfter: number;
  date: Date;
}

export interface IWallet extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  balance: number;
  transactions: IWalletTransaction[];
  createdAt: Date;
  updatedAt: Date;

  // Virtuals
  readonly latestTransaction: IWalletTransaction | null;
  readonly transactionCount: number;
  readonly totalCredits: number;
  readonly totalDebits: number;
}
