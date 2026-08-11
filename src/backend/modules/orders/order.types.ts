import type { Document, Types } from 'mongoose';
import type {
  CancellationReason,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ReturnReason
} from '../../common/constants/order.constants';

export interface IOrderStatusHistoryEntry {
  status: OrderStatus;
  updatedAt: Date;
  notes?: string;
  /**
   * Who made the change - the admin controller passes the literal 'admin'.
   * The schema previously did not declare this field, so every value written
   * here was silently discarded by Mongoose.
   */
  updatedBy?: string;
}

export interface IOrderItem {
  _id: Types.ObjectId;
  productId: Types.ObjectId;
  /** Points at a variant subdocument inside the product. */
  variantId: Types.ObjectId;
  sku: string;
  size: string;
  quantity: number;
  price: number;
  totalPrice: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  statusHistory: IOrderStatusHistoryEntry[];
  cancellationReason?: CancellationReason;
  returnReason?: ReturnReason;
  returnRequestDate?: Date;
  cancellationDate?: Date;
}

export interface IOrder extends Document {
  _id: Types.ObjectId;
  /** Human-readable identifier, e.g. ORD000123. */
  orderId: string;
  orderDocumentId: Types.ObjectId | null;
  user: Types.ObjectId;
  items: Types.DocumentArray<IOrderItem>;

  deliveryAddress: {
    addressId?: Types.ObjectId;
    /** Index into the user's Address.address array. */
    addressIndex: number;
  };

  couponApplied: Types.ObjectId | null;
  couponDiscount: number;
  couponCode: string | null;

  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;

  subtotal: number;
  totalDiscount: number;
  amountAfterDiscount: number;
  shipping: number;
  totalAmount: number;
  totalItemCount: number;

  paypalCaptureId: string | null;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;

  status: OrderStatus;
  statusHistory: IOrderStatusHistoryEntry[];
  cancellationReason?: CancellationReason;
  returnReason?: ReturnReason;
  cancellationDate?: Date;
  returnRequestDate?: Date;

  createdAt: Date;
  updatedAt: Date;

  // Instance methods
  getCurrentStatus(): OrderStatus;
  hasItem(itemId: Types.ObjectId | string): boolean;
}
