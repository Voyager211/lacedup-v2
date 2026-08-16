import type { Request, Response } from 'express';
import Subscriber from './subscriber.model';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Newsletter signup.
 *
 * Signing up twice is not an error - people forget, and telling them their
 * address is "already taken" on a newsletter is a strange thing to say. The
 * second signup updates the consent flag and returns the same success, so the
 * form behaves the same either way.
 */
export const subscribe = async (req: Request, res: Response) => {
  try {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const consented = Boolean(req.body?.consented);

    if (!EMAIL.test(email)) {
      return res.status(400).json({ success: false, message: 'Enter a valid email address' });
    }

    await Subscriber.findOneAndUpdate(
      { email },
      { email, consented },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.json({ success: true, message: "You're on the list" });
  } catch (err) {
    console.error('Error in newsletter subscribe:', err);
    return res.status(500).json({ success: false, message: 'Something went wrong' });
  }
};
