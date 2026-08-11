import type { Document, Types } from 'mongoose';

export type ReturnRequestStatus =
  | 'Pending'
  | 'Approved'
  | 'Rejected'
  | 'Processing'
  | 'Completed';

export type RefundMethod = 'Original Payment Method' | 'Wallet' | 'Bank Transfer';
export type RefundStatus = 'Pending' | 'Processed' | 'Failed';

export interface IReturnStatusHistoryEntry {
  status: string;
  updatedAt: Date;
  notes?: string;
  updatedBy?: Types.ObjectId;
}

export interface IReturn extends Document {
  _id: Types.ObjectId;
  returnId: string;
  /** The human-readable Order.orderId string, not an ObjectId. */
  orderId: string;
  itemId: Types.ObjectId;
  userId: Types.ObjectId;
  productId: Types.ObjectId;
  productName: string;
  productImage?: string;
  sku: string;
  size: string;
  quantity: number;
  price: number;
  totalPrice: number;
  reason: string;
  status: ReturnRequestStatus;
  requestDate: Date;
  processedDate?: Date;
  processedBy?: Types.ObjectId;

  /**
   * Approval / rejection audit trail.
   *
   * order.service writes these in eight places, but the schema never declared
   * them, so Mongoose silently discarded every value - admin attribution and
   * timing for returns was lost entirely.
   *
   * NOTE: these overlap with processedDate/processedBy above, which the
   * service never writes. Worth consolidating onto one pair later.
   */
  approvedAt?: Date;
  approvedBy?: string;
  rejectedAt?: Date;
  rejectedBy?: string;
  rejectionReason?: string;
  adminNotes?: string;
  refundAmount?: number;
  refundMethod: RefundMethod;
  refundStatus: RefundStatus;
  statusHistory: IReturnStatusHistoryEntry[];
  createdAt: Date;
  updatedAt: Date;
}
