import { api } from '@/api/api';
import type { User } from '@/types/domain';

/**
 * Profile, wallet and referral endpoints.
 *
 * The wallet and referral routers are dual-mounted, so their pages answer JSON
 * under /api. The profile router is root-mounted and its routes had to be
 * registered under /api explicitly - the third router with that gap.
 */

export interface WalletTransaction {
  transactionId: string;
  type: 'credit' | 'debit';
  amount: number;
  description?: string;
  paymentMethod?: string;
  status?: string;
  balanceAfter?: number;
  date: string;
}

export interface WalletPage {
  success: boolean;
  wallet: { balance: number; _id?: string };
  transactions: WalletTransaction[];
  currentPage: number;
  totalPages: number;
  totalTransactions: number;
  stats?: { totalCredited?: number; totalDebited?: number };
}

export interface ReferredUser {
  _id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface ReferralsPage {
  success: boolean;
  referredUsers: ReferredUser[];
  referralTransactions: WalletTransaction[];
  totalEarnings: number;
  referralLink: string;
  referralCode?: string;
  totalReferrals: number;
  referralsCurrentPage: number;
  referralsTotalPages: number;
  earningsCurrentPage: number;
  earningsTotalPages: number;
  totalEarningsCount: number;
}

interface MutationResult {
  success: boolean;
  message?: string;
}

export const accountApi = api.injectEndpoints({
  endpoints: (build) => ({
    updateProfile: build.mutation<MutationResult, { name: string; phone?: string }>({
      query: (body) => ({ url: '/profile/edit', method: 'POST', data: body }),
      invalidatesTags: ['User']
    }),

    changePassword: build.mutation<
      MutationResult,
      { currentPassword: string; newPassword: string }
    >({
      query: (body) => ({ url: '/profile/change-password', method: 'POST', data: body })
    }),

    /**
     * Multipart, so the body is a FormData rather than JSON - the server
     * resizes with sharp before storing.
     */
    uploadProfilePhoto: build.mutation<MutationResult & { profilePhoto?: string }, File>({
      query: (file) => {
        const form = new FormData();
        form.append('profilePhoto', file);
        return { url: '/profile/photo', method: 'POST', data: form };
      },
      invalidatesTags: ['User']
    }),

    deleteProfilePhoto: build.mutation<MutationResult, void>({
      query: () => ({ url: '/profile/photo', method: 'DELETE' }),
      invalidatesTags: ['User']
    }),

    getWallet: build.query<WalletPage, number | void>({
      query: (page) => ({ url: '/wallet', params: page ? { page } : undefined }),
      providesTags: ['Wallet']
    }),

    /**
     * Starts a wallet top-up. Verification uses the same Razorpay pair as
     * checkout, but against the wallet's own endpoints.
     */
    createTopupOrder: build.mutation<
      {
        success: boolean;
        keyId: string;
        amount: number;
        currency: string;
        razorpayOrderId: string;
        transactionId: string;
      },
      { amount: number }
    >({
      query: ({ amount }) => ({
        url: '/wallet/topup/create-order',
        method: 'POST',
        data: { amount, paymentMethod: 'razorpay' }
      })
    }),

    verifyTopup: build.mutation<
      MutationResult,
      {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
        transactionId: string;
      }
    >({
      query: (body) => ({ url: '/wallet/topup/verify-razorpay', method: 'POST', data: body }),
      invalidatesTags: ['Wallet']
    }),

    getReferrals: build.query<ReferralsPage, void>({
      query: () => ({ url: '/referrals' }),
      providesTags: ['Referral']
    }),

    /**
     * These two handlers existed all along but were never mounted, so page 2
     * of either list has never worked for anyone. Mounted in step 8.
     */
    getReferredUsers: build.query<
      { referredUsers: ReferredUser[]; currentPage: number; totalPages: number },
      number
    >({
      query: (page) => ({ url: '/referrals/referred-users', params: { page } }),
      transformResponse: (response: { data: { referredUsers: ReferredUser[]; currentPage: number; totalPages: number } }) =>
        response.data,
      providesTags: ['Referral']
    }),

    getReferralEarnings: build.query<
      { transactions: WalletTransaction[]; currentPage: number; totalPages: number },
      number
    >({
      query: (page) => ({ url: '/referrals/earnings', params: { page } }),
      transformResponse: (response: {
        data: { transactions?: WalletTransaction[]; referralTransactions?: WalletTransaction[]; currentPage: number; totalPages: number };
      }) => ({
        transactions: response.data.transactions ?? response.data.referralTransactions ?? [],
        currentPage: response.data.currentPage,
        totalPages: response.data.totalPages
      }),
      providesTags: ['Referral']
    })
  })
});

export const {
  useUpdateProfileMutation,
  useChangePasswordMutation,
  useUploadProfilePhotoMutation,
  useDeleteProfilePhotoMutation,
  useGetWalletQuery,
  useCreateTopupOrderMutation,
  useVerifyTopupMutation,
  useGetReferralsQuery,
  useGetReferredUsersQuery,
  useGetReferralEarningsQuery
} = accountApi;

export type { User };
