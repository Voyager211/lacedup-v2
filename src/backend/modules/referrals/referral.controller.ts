import type { Request, Response } from 'express';
import User from '../users/user.model';
import Wallet from '../wallet/wallet.model';
import { wantsJson } from '../../common/utils/wants-json.util';

const getReferralsPage = async (req: Request, res: Response) => {
  try {
    const userId = req.user!._id;

    // Get user's referral info
    const user = await User.findById(userId)
      .select('referralCode referralCount name email');

    //  Pagination parameters
    const referralsPage = parseInt(String(req.query.referralsPage)) || 1;
    const earningsPage = parseInt(String(req.query.earningsPage)) || 1;
    const limit = 10;

    //  Get total count of referred users
    const totalReferrals = await User.countDocuments({ referredBy: userId });

    //  Get paginated referred users
    const referredUsers = await User.find({ referredBy: userId })
      .select('name email createdAt')
      .sort({ createdAt: -1 })
      .skip((referralsPage - 1) * limit)
      .limit(limit);

    // Get referral-related wallet transactions
    const wallet = await Wallet.findOne({ userId: userId });
    const allReferralTransactions = wallet ? 
      wallet.transactions.filter(t => t.paymentMethod === 'referral_reward')
        .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()) : [];

    //  Paginate referral transactions
    const totalEarnings = allReferralTransactions.reduce(
      (sum, t) => sum + (t.type === 'credit' ? t.amount : 0), 
      0
    );

    const totalEarningsCount = allReferralTransactions.length;
    const startIndex = (earningsPage - 1) * limit;
    const endIndex = startIndex + limit;
    const referralTransactions = allReferralTransactions.slice(startIndex, endIndex);

    //  Calculate pagination data for referrals
    const referralsTotalPages = Math.ceil(totalReferrals / limit);
    const referralsHasPrevPage = referralsPage > 1;
    const referralsHasNextPage = referralsPage < referralsTotalPages;
    const referralsPrevPage = referralsHasPrevPage ? referralsPage - 1 : null;
    const referralsNextPage = referralsHasNextPage ? referralsPage + 1 : null;

    // Generate page numbers for referrals
    const maxPagesToShow = 5;
    let referralsStartPage = Math.max(1, referralsPage - Math.floor(maxPagesToShow / 2));
    let referralsEndPage = Math.min(referralsTotalPages, referralsStartPage + maxPagesToShow - 1);
    
    if (referralsEndPage - referralsStartPage + 1 < maxPagesToShow) {
      referralsStartPage = Math.max(1, referralsEndPage - maxPagesToShow + 1);
    }
    
    const referralsPageNumbers: any[] = [];
    for (let i = referralsStartPage; i <= referralsEndPage; i++) {
      referralsPageNumbers.push(i);
    }

    //  Calculate pagination data for earnings
    const earningsTotalPages = Math.ceil(totalEarningsCount / limit);
    const earningsHasPrevPage = earningsPage > 1;
    const earningsHasNextPage = earningsPage < earningsTotalPages;
    const earningsPrevPage = earningsHasPrevPage ? earningsPage - 1 : null;
    const earningsNextPage = earningsHasNextPage ? earningsPage + 1 : null;

    // Generate page numbers for earnings
    let earningsStartPage = Math.max(1, earningsPage - Math.floor(maxPagesToShow / 2));
    let earningsEndPage = Math.min(earningsTotalPages, earningsStartPage + maxPagesToShow - 1);
    
    if (earningsEndPage - earningsStartPage + 1 < maxPagesToShow) {
      earningsStartPage = Math.max(1, earningsEndPage - maxPagesToShow + 1);
    }
    
    const earningsPageNumbers: any[] = [];
    for (let i = earningsStartPage; i <= earningsEndPage; i++) {
      earningsPageNumbers.push(i);
    }

    // Build referral link
    const referralLink = `${req.protocol}://${req.get('host')}/signup?ref=${user!.referralCode}`;

    const page = {
      referredUsers,
      referralTransactions,
      totalEarnings,
      referralLink,
      referralCode: user!.referralCode,
      // Referrals pagination
      referralsCurrentPage: referralsPage,
      referralsTotalPages,
      referralsHasPrevPage,
      referralsHasNextPage,
      referralsPrevPage,
      referralsNextPage,
      referralsPageNumbers,
      totalReferrals,
      // Earnings pagination
      earningsCurrentPage: earningsPage,
      earningsTotalPages,
      earningsHasPrevPage,
      earningsHasNextPage,
      earningsPrevPage,
      earningsNextPage,
      earningsPageNumbers,
      totalEarningsCount
    };

    if (wantsJson(req)) {
      return res.json({ success: true, ...page });
    }

    res.render('user/referrals', {
      title: 'My Referrals',
      layout: 'user/layouts/user-layout',
      active: 'referrals',
      user,
      ...page
    });

  } catch (error: any) {
    console.error('Error loading referrals page:', error);

    if (wantsJson(req)) {
      return res.status(500).json({ success: false, message: 'Failed to load referrals' });
    }

    // errors/server-error, not 'user/error' - that view does not exist, so the
    // old path threw inside its own error handler (docs/defects.md).
    res.status(500).render('errors/server-error', {
      title: 'Error',
      message: 'Failed to load referrals page. Please try again later.',
      layout: 'user/layouts/user-layout',
      active: 'referrals'
    });
  }
};

const getPaginatedReferrals = async (req: Request, res: Response) => {
  try {
    const userId = req.user!._id;
    const page = parseInt(String(req.query.page)) || 1;
    const limit = 10;

    const totalReferrals = await User.countDocuments({ referredBy: userId });
    
    const referredUsers = await User.find({ referredBy: userId })
      .select('name email createdAt')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const totalPages = Math.ceil(totalReferrals / limit);
    const hasPrevPage = page > 1;
    const hasNextPage = page < totalPages;

    // Generate page numbers
    const maxPagesToShow = 5;
    let startPage = Math.max(1, page - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
    
    if (endPage - startPage + 1 < maxPagesToShow) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }
    
    const pageNumbers: any[] = [];
    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }

    res.json({
      success: true,
      data: {
        referredUsers,
        currentPage: page,
        totalPages,
        hasPrevPage,
        hasNextPage,
        prevPage: hasPrevPage ? page - 1 : null,
        nextPage: hasNextPage ? page + 1 : null,
        pageNumbers,
        totalReferrals
      }
    });
  } catch (error: any) {
    console.error('Error fetching paginated referrals:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch referrals' });
  }
};

const getPaginatedEarnings = async (req: Request, res: Response) => {
  try {
    const userId = req.user!._id;
    const page = parseInt(String(req.query.page)) || 1;
    const limit = 10;

    const wallet = await Wallet.findOne({ userId: userId });
    const allReferralTransactions = wallet ? 
      wallet.transactions.filter(t => t.paymentMethod === 'referral_reward')
        .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()) : [];

    const totalEarningsCount = allReferralTransactions.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const referralTransactions = allReferralTransactions.slice(startIndex, endIndex);

    const totalPages = Math.ceil(totalEarningsCount / limit);
    const hasPrevPage = page > 1;
    const hasNextPage = page < totalPages;

    // Generate page numbers
    const maxPagesToShow = 5;
    let startPage = Math.max(1, page - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
    
    if (endPage - startPage + 1 < maxPagesToShow) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }
    
    const pageNumbers: any[] = [];
    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }

    res.json({
      success: true,
      data: {
        referralTransactions,
        currentPage: page,
        totalPages,
        hasPrevPage,
        hasNextPage,
        prevPage: hasPrevPage ? page - 1 : null,
        nextPage: hasNextPage ? page + 1 : null,
        pageNumbers,
        totalEarningsCount
      }
    });
  } catch (error: any) {
    console.error('Error fetching paginated earnings:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch earnings' });
  }
};

export {
  getReferralsPage,
  getPaginatedReferrals,
  getPaginatedEarnings
}