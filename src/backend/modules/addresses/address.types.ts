import type { Document, Types } from 'mongoose';

export interface IAddressEntry {
  _id: Types.ObjectId;
  addressType: string;
  name: string;
  city: string;
  landMark: string;
  state: string;
  pincode: number;
  phone: string;
  altPhone?: string;
  isDefault: boolean;
  coordinates?: {
    lat?: number;
    lon?: number;
  };
}

/**
 * One document per user, holding all of that user's addresses in the
 * `address` array.
 */
export interface IAddress extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  address: IAddressEntry[];
  createdAt: Date;
  updatedAt: Date;
}
