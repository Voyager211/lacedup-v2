import type { Document, Model, Types } from 'mongoose';

export type TransactionType =
  | 'ORDER_PAYMENT'
  | 'WALLET_CREDIT'
  | 'WALLET_DEBIT'
  | 'WALLET_TOPUP'
  | 'REFUND'
  | 'CANCELLATION_REFUND';

export type TransactionPaymentMethod =
  | 'upi'
  | 'paypal'
  | 'wallet'
  | 'cod'
  | 'card'
  | 'netbanking';

export type TransactionStatus =
  | 'INITIATED'
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'REFUNDED';

export interface ITransactionStatusHistoryEntry {
  status: TransactionStatus;
  updatedAt: Date;
  notes?: string;
  updatedBy?: string;
}

export interface ITransactionOrderItem {
  productId: Types.ObjectId;
  variantId: Types.ObjectId;
  sku?: string;
  size?: string;
  quantity?: number;
  price?: number;
  totalPrice?: number;
  regularPrice?: number;
}

export interface ITransaction extends Document {
  _id: Types.ObjectId;
  transactionId: string;
  userId: Types.ObjectId;
  type: TransactionType;
  paymentMethod: TransactionPaymentMethod;
  amount: number;
  currency: 'INR' | 'USD';
  status: TransactionStatus;

  gatewayDetails: {
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    razorpaySignature?: string;
    paypalOrderId?: string;
    paypalCaptureId?: string;
    gatewayResponse: Record<string, unknown>;
  };

  /** Set only once payment succeeds. */
  orderId: string | null;

  /** Cart snapshot held until the payment completes. */
  orderData?: {
    deliveryAddressId?: Types.ObjectId;
    items: ITransactionOrderItem[];
    pricing?: {
      subtotal?: number;
      totalDiscount?: number;
      amountAfterDiscount?: number;
      shipping?: number;
      total?: number;
      totalItemCount?: number;
    };
  };

  metadata: {
    failureReason?: string;
    failureCode?: string | null;
    retryCount: number;
    userAgent?: string;
    ipAddress?: string;
    sessionId?: string;
  };

  statusHistory: ITransactionStatusHistoryEntry[];

  /** TTL field - cleared once the transaction completes. */
  expiresAt?: Date;

  createdAt: Date;
  updatedAt: Date;

  // Instance methods
  updateStatus(
    newStatus: TransactionStatus,
    notes?: string,
    updatedBy?: string | null
  ): Promise<ITransaction>;
  markAsCompleted(orderId: string, notes?: string): Promise<ITransaction>;
  markAsFailed(reason: string, code?: string | null): Promise<ITransaction>;
}

export interface TransactionModel extends Model<ITransaction> {
  findByTransactionId(transactionId: string): Promise<ITransaction | null>;
  findPendingByUser(userId: Types.ObjectId | string): Promise<ITransaction[]>;
  getUserTransactionHistory(
    userId: Types.ObjectId | string,
    limit?: number,
    skip?: number
  ): Promise<ITransaction[]>;
}
