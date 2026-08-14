import type { Request, Response, NextFunction } from 'express';
import User from '../users/user.model';
import crypto from 'crypto';
import sendOtp from '../../common/utils/send-otp.util';
import passport from 'passport';
import { issueSession, endSession } from './auth.session';
import { generateReferralCode } from '../referrals/referral-code.util';
import Wallet from '../wallet/wallet.model';
import * as walletService from '../wallet/wallet.service';
import {
  checkOtp,
  createUserFrom,
  discardSignup,
  findSignup,
  refreshOtp,
  startSignup
} from './pending-signup.service'; 


const postSignup = async (req: Request, res: Response) => {
  const { name, email, phone, password, confirmPassword, referralCode } = req.body;

  try {
    if (!name || !email || !password || !confirmPassword) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match.' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: 'Email already in use.' });
    }

    let referrer = null;
    if (referralCode) {
      referrer = await User.findOne({ 
        referralCode: referralCode.toUpperCase() 
      });
      
      if (!referrer) {
        return res.status(400).json({ 
          error: 'Invalid referral code. Please check and try again.' 
        });
      }
    }

    // Held in the PendingSignup collection rather than the session, so the
    // flow is recoverable if the session is lost - it is found by the email
    // the client sends back with the code. The password is hashed on the way
    // in; the session used to keep it in plaintext.
    const { otp } = await startSignup({
      name,
      email,
      phone,
      password,
      referralCode: referralCode ? referralCode.toUpperCase() : null,
      referrerId: referrer ? referrer._id : null
    });

    const tempUser = { name, email };
    await sendOtp(tempUser, otp);

    return res.status(200).json({ 
      success: true, 
      redirect: `/verify-otp?email=${encodeURIComponent(email)}` 
    });

  } catch (err: any) {
    console.error('Signup Error:', err);

    if (err.message && err.message.includes('Email authentication failed')) {
      return res.status(500).json({
        error: 'Email service configuration error. Please contact support.'
      });
    } else if (err.message && err.message.includes('Email service not configured')) {
      return res.status(500).json({
        error: 'Email service is temporarily unavailable. Please try again later.'
      });
    } else {
      return res.status(500).json({ error: 'Failed to send OTP. Please try again.' });
    }
  }
};



const postLogin = (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate('local', (err: any, user: any, info: any) => {
    if (err) return res.status(500).json({ error: 'Something went wrong.' });
    if (!user) return res.status(401).json({ error: info.message || 'Invalid credentials.' });

    issueSession(res, user, 'user')
      .then(() => res.status(200).json({ success: true }))
      .catch((issueErr) => {
        console.error('Failed to issue session:', issueErr);
        return res.status(500).json({ error: 'Login failed.' });
      });
  })(req, res, next);
};

const logout = async (req: Request, res: Response) => {
  // Revoke the refresh token server-side before clearing cookies, so a captured
  // token cannot be replayed after logout.
  await endSession(res, req.cookies?.user_rt, 'user');

  // The session still carries transient state (cart coupon, OTP flows), so it
  // is destroyed too.
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
      return res.redirect('/home');
    }
    res.clearCookie('connect.sid');
    return res.redirect('/');
  });
};


const postOtpVerification = async (req: Request, res: Response) => {
  const { email, otp } = req.body;

  try {
    const pendingUser = await findSignup(email);

    if (pendingUser) {
      const verdict = checkOtp(pendingUser, otp);

      if (verdict === 'expired') {
        await discardSignup(email);
        return res.status(410).json({ error: 'OTP expired. Please sign up again.' });
      }

      if (verdict === 'incorrect') {
        return res.status(401).json({ error: 'Incorrect OTP. Try again.' });
      }

      // Creates the user from the stored hash without re-hashing it. See
      // pending-signup.service; pinned by a sign-in test.
      const newUser = await createUserFrom(pendingUser);

      newUser.referralCode = await generateReferralCode();

      if ((pendingUser.referrerId as any)) {
        newUser.referredBy = (pendingUser.referrerId as any);
        newUser.hasUsedReferralCode = true;
      }

      await newUser.save();

      let newUserWalletAmount = 0;
      
      if ((pendingUser.referrerId as any)) {
        newUserWalletAmount = 100;
      }

      try {
        const newUserWallet = new Wallet({
          userId: newUser._id,
          balance: newUserWalletAmount,
          transactions: []
        });

        if ((pendingUser.referrerId as any)) {
          const timestamp = Date.now();
          const random = Math.floor(Math.random() * 10000);
          const transactionId = `TXN${timestamp}${random}`;

          newUserWallet.transactions.push({
            transactionId: transactionId,
            type: 'credit',
            amount: 100,
            description: 'Referral welcome bonus',
            paymentMethod: 'referral_reward',
            status: 'completed',
            balanceAfter: 100,
            date: new Date()
          });
        }

        await newUserWallet.save();
        console.log(`Wallet created for new user: ${newUser.email} (Balance: ₹${newUserWalletAmount})`);
      } catch (walletError: any) {
        console.error('Error creating wallet for new user:', walletError);
      }

      if ((pendingUser.referrerId as any)) {
        try {
          await walletService.addTransaction((pendingUser.referrerId as any), {
            type: 'credit',
            amount: 300,
            description: `Referral reward for inviting ${newUser.name}`,
            paymentMethod: 'referral_reward',
            status: 'completed'
          });

          await User.findByIdAndUpdate((pendingUser.referrerId as any), {
            $inc: { referralCount: 1 }
          });

          console.log(`Referral rewards processed:
            - ₹300 credited to referrer wallet (${(pendingUser.referrerId as any)})
            - ₹100 credited to new user wallet (${newUser.email})`);

        } catch (referralError: any) {
          console.error('Error processing referral reward:', referralError);
        }
      }

      await discardSignup(email);

      await issueSession(res, newUser, 'user');
      return res.status(200).json({ success: true });

    } else {
      const user = await User.findOne({ email });
      if (!user || !user.otpHash) {
        return res.status(400).json({ error: 'Invalid request or OTP expired.' });
      }

      const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
      const isExpired = user.otpExpiresAt!.getTime() < Date.now();
      const isValid = user.otpHash === otpHash;

      if (isExpired) {
        return res.status(410).json({ error: 'OTP expired. Please try again.' });
      }

      if (!isValid) {
        return res.status(401).json({ error: 'Incorrect OTP. Try again.' });
      }

      user.otpHash = undefined;
      user.otpExpiresAt = undefined;
      await user.save();

      await issueSession(res, user, 'user');
      return res.status(200).json({ success: true });
    }

  } catch (err: any) {
    console.error('OTP Verify Error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
};





const resendOtp = async (req: Request, res: Response) => {
  const { email } = req.body;

  try {
    const resent = await refreshOtp(email);

    if (resent) {
      await sendOtp({ name: resent.name, email }, resent.otp);

      return res.status(200).json({ success: true });

    } else {
      const user = await User.findOne({ email });
      if (!user) return res.status(404).json({ error: 'User not found.' });

      // Generate new OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
      const otpExpiresAt = Date.now() + 60 * 1000;

      user.otpHash = otpHash;
      user.otpExpiresAt = new Date(otpExpiresAt);
      await user.save();

      await sendOtp(user, otp);
      return res.status(200).json({ success: true });
    }

  } catch (err: any) {
    console.error('Resend OTP Error:', err);

    if (err.message && err.message.includes('Email authentication failed')) {
      return res.status(500).json({
        error: 'Email service configuration error. Please contact support.'
      });
    } else if (err.message && err.message.includes('Email service not configured')) {
      return res.status(500).json({
        error: 'Email service is temporarily unavailable. Please try again later.'
      });
    } else {
      return res.status(500).json({ error: 'Failed to resend OTP. Please try again.' });
    }
  }
};



const sendResetOtp = async (req: Request, res: Response) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'No account with that email.' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    console.log (otp);
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    const otpExpiresAt = Date.now() + 60 * 1000;

    user.otpHash = otpHash;
    user.otpExpiresAt = new Date(otpExpiresAt);
    await user.save();

    await sendOtp(user, otp);

    return res.status(200).json({
      success: true,
      redirect: `/reset-otp?email=${encodeURIComponent(email)}`
    });
  } catch (err: any) {
    console.error('Reset OTP Error:', err);

    if (err.message && err.message.includes('Email authentication failed')) {
      return res.status(500).json({
        error: 'Email service configuration error. Please contact support.'
      });
    } else if (err.message && err.message.includes('Email service not configured')) {
      return res.status(500).json({
        error: 'Email service is temporarily unavailable. Please try again later.'
      });
    } else {
      return res.status(500).json({ error: 'Failed to send OTP. Please try again.' });
    }
  }
};


const verifyResetOtp = async (req: Request, res: Response) => {
  const { email, otp } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user || !user.otpHash) {
      return res.status(400).json({ error: 'Invalid request or OTP expired.' });
    }

    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    const isExpired = user.otpExpiresAt!.getTime() < Date.now();
    const isValid = user.otpHash === otpHash;

    if (isExpired) {
      return res.status(410).json({ error: 'OTP expired. Try again.' });
    }

    if (!isValid) {
      return res.status(401).json({ error: 'Incorrect OTP. Try again.' });
    }

    return res.status(200).json({ success: true, redirect: `/reset-password?email=${encodeURIComponent(email)}` });

  } catch (err: any) {
    console.error('Verify Reset OTP Error:', err);
    res.status(500).json({ error: 'Verification failed.' });
  }
};


const resendResetOtp = async (req: Request, res: Response) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    console.log('Reset OTP resend:', otp);
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    const otpExpiresAt = Date.now() + 60 * 1000;

    user.otpHash = otpHash;
    user.otpExpiresAt = new Date(otpExpiresAt);
    await user.save();

    await sendOtp(user, otp);
    return res.status(200).json({ success: true });

  } catch (err: any) {
    console.error('Resend Reset OTP Error:', err);

    if (err.message && err.message.includes('Email authentication failed')) {
      return res.status(500).json({
        error: 'Email service configuration error. Please contact support.'
      });
    } else if (err.message && err.message.includes('Email service not configured')) {
      return res.status(500).json({
        error: 'Email service is temporarily unavailable. Please try again later.'
      });
    } else {
      return res.status(500).json({ error: 'Failed to resend OTP. Please try again.' });
    }
  }
};

const resetPassword = async (req: Request, res: Response) => {
  const { email, newPassword, confirmPassword } = req.body;

  try {
    if (!newPassword || newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match.' });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const isSamePassword = await user.comparePassword(newPassword);
    if (isSamePassword) {
      return res.status(400).json({ 
        error: 'New password cannot be the same as your current password. Please choose a different password.' 
      });
    }

    user.password = newPassword;
    user.otpHash = undefined;
    user.otpExpiresAt = undefined;
    await user.save();

    return res.status(200).json({ success: true });

  } catch (err: any) {
    console.error('Password Reset Error:', err);
    res.status(500).json({ error: 'Failed to reset password.' });
  }
};

export {
  postSignup,
  postLogin,
  logout,
  postOtpVerification,
  resendOtp,
  sendResetOtp,
  verifyResetOtp,
  resendResetOtp,
  resetPassword
};