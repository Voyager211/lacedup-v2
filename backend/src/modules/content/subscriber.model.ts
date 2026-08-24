import mongoose, { Schema, Document } from 'mongoose';

/**
 * A newsletter signup.
 *
 * The community section on the landing page collects an email address and a
 * marketing consent tick. Storing both is the point: a form that thanks you and
 * throws the address away is worse than no form, and the consent flag is the
 * record that the address may be mailed at all.
 */
export interface ISubscriber extends Document {
  email: string;
  /** The marketing checkbox, as ticked at the time of signing up. */
  consented: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const subscriberSchema = new Schema<ISubscriber>(
  {
    email: {
      type: String,
      required: true,
      // Unique so a second signup updates the existing row rather than
      // creating a duplicate that would be mailed twice.
      unique: true,
      lowercase: true,
      trim: true
    },
    consented: { type: Boolean, default: false }
  },
  { timestamps: true }
);

const Subscriber = mongoose.model<ISubscriber>('Subscriber', subscriberSchema);

export default Subscriber;
