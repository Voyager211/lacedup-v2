import mongoose from 'mongoose';
import type { IPasswordReset } from './auth.types';

const passwordResetSchema = new mongoose.Schema<IPasswordReset>(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    token: { type: String, required: true },
    expiresAt: { type: Date, required: true }
  },
  { timestamps: true }
);

export = mongoose.model<IPasswordReset>('PasswordReset', passwordResetSchema);
