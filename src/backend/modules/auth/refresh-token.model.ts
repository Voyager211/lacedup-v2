import mongoose from 'mongoose';
import type { IRefreshToken } from './auth.types';

/**
 * Persisted refresh tokens.
 *
 * A JWT cannot be un-issued, so revocation needs server-side state: logout
 * marks the row revoked, and refresh checks it. Only the SHA-256 hash is
 * stored, so a database leak does not hand over usable tokens.
 *
 * `expiresAt` carries a TTL index, letting MongoDB reap expired rows rather
 * than growing the collection forever.
 */
const refreshTokenSchema = new mongoose.Schema<IRefreshToken>(
  {
    /** Matches the `jti` claim in the token. */
    tokenId: {
      type: String,
      required: true,
      unique: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    tokenHash: {
      type: String,
      required: true
    },
    audience: {
      type: String,
      enum: ['user', 'admin'],
      required: true
    },
    revokedAt: {
      type: Date,
      default: null
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 }
    }
  },
  { timestamps: true }
);

export = mongoose.model<IRefreshToken>('RefreshToken', refreshTokenSchema);
