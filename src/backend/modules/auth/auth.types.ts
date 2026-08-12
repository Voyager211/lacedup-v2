import type { Document, Types } from 'mongoose';

export type TokenAudience = 'user' | 'admin';

export interface IRefreshToken extends Document {
  _id: Types.ObjectId;
  /** Matches the `jti` claim in the issued token. */
  tokenId: string;
  userId: Types.ObjectId;
  /** SHA-256 of the token; the raw value is never stored. */
  tokenHash: string;
  audience: TokenAudience;
  revokedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPasswordReset extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
