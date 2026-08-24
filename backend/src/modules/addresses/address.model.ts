import mongoose from 'mongoose';
import type { IAddress } from './address.types';

const { Schema } = mongoose;

const addressSchema = new Schema<IAddress>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    address: [
      {
        addressType: {
          type: String,
          required: true
        },
        name: {
          type: String,
          required: true
        },
        city: {
          type: String,
          required: true
        },
        landMark: {
          type: String,
          required: true
        },
        state: {
          type: String,
          required: true
        },
        pincode: {
          type: Number,
          required: true
        },
        phone: {
          type: String,
          required: true
        },
        altPhone: {
          type: String
        },
        isDefault: {
          type: Boolean,
          default: false
        },
        coordinates: {
          lat: {
            type: Number
          },
          lon: {
            type: Number
          }
        }
      }
    ]
  },
  { timestamps: true }
);

export = mongoose.model<IAddress>('Address', addressSchema);
