import type { Types } from 'mongoose';
import Wallet from './wallet.model';
import type {
  IWallet,
  IWalletTransaction,
  WalletPaymentMethod,
  WalletTransactionStatus,
  WalletTransactionType
} from './wallet.types';

type UserId = Types.ObjectId | string;

export interface AddTransactionInput {
  type: WalletTransactionType;
  amount: number;
  description: string;
  paymentMethod?: WalletPaymentMethod;
  status?: WalletTransactionStatus;
  orderId?: string | null;
  returnId?: string | null;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
}

export interface AddTransactionResult {
  transactionId: string;
  wallet: IWallet;
}

/** Shape returned by the credit/debit helpers, which report failure rather than throw. */
export interface WalletOperationResult {
  success: boolean;
  message: string;
  transactionId?: string;
  wallet?: IWallet;
  newBalance?: number;
  refundAmount?: number;
  error?: string;
}

export interface PaginatedTransactions {
  transactions: IWalletTransaction[];
  currentPage: number;
  totalPages: number;
  totalTransactions: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface WalletStats {
  balance: number;
  totalCredits: number;
  totalDebits: number;
  transactionCount: number;
  monthlyAdded: number;
}

const newTransactionId = () => `TXN${Date.now()}${Math.floor(Math.random() * 10000)}`;

/** Get or create wallet for user. */
export const getOrCreateWallet = async (userId: UserId): Promise<IWallet> => {
  let wallet = await Wallet.findOne({ userId });

  if (!wallet) {
    wallet = new Wallet({
      userId,
      balance: 0,
      transactions: []
    });
    await wallet.save();
  }

  return wallet;
};

/** Get wallet by userId. */
export const getWallet = async (userId: UserId) => {
  return await Wallet.findOne({ userId }).lean();
};

/** Add a transaction to the wallet, adjusting the balance. */
export const addTransaction = async (
  userId: UserId,
  transactionData: AddTransactionInput
): Promise<AddTransactionResult> => {
  const wallet = await getOrCreateWallet(userId);

  // Validate transaction type
  if (!['credit', 'debit'].includes(transactionData.type)) {
    throw new Error('Invalid transaction type');
  }

  const transactionId = newTransactionId();

  // Calculate balance after transaction
  if (transactionData.type === 'credit') {
    wallet.balance += transactionData.amount;
  } else if (transactionData.type === 'debit') {
    if (wallet.balance < transactionData.amount) {
      throw new Error('Insufficient wallet balance');
    }
    wallet.balance -= transactionData.amount;
  }

  wallet.transactions.push({
    transactionId,
    type: transactionData.type,
    amount: transactionData.amount,
    description: transactionData.description,
    paymentMethod: transactionData.paymentMethod || 'manual_credit',
    status: transactionData.status || 'completed',
    orderId: transactionData.orderId ?? undefined,
    returnId: transactionData.returnId ?? undefined,
    razorpayOrderId: transactionData.razorpayOrderId ?? undefined,
    razorpayPaymentId: transactionData.razorpayPaymentId ?? undefined,
    date: new Date(),
    balanceAfter: wallet.balance
  } as IWalletTransaction);

  await wallet.save();

  return {
    transactionId,
    wallet
  };
};

/** Get paginated completed transactions for a user. */
export const getPaginatedTransactions = async (
  userId: UserId,
  page = 1,
  limit = 10,
  type: WalletTransactionType | null = null
): Promise<PaginatedTransactions> => {
  const skip = (page - 1) * limit;

  try {
    const wallet = await Wallet.findOne({ userId });

    if (!wallet) {
      return {
        transactions: [],
        currentPage: page,
        totalPages: 0,
        totalTransactions: 0,
        hasNextPage: false,
        hasPrevPage: false
      };
    }

    // Filter transactions by type if provided
    let transactions = wallet.transactions.filter((t) => t.status === 'completed');

    if (type) {
      transactions = transactions.filter((t) => t.type === type);
    }

    // Sort by date descending (newest first)
    transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const totalTransactions = transactions.length;
    const totalPages = Math.ceil(totalTransactions / limit);

    const paginatedTransactions = transactions.slice(skip, skip + limit);

    return {
      transactions: paginatedTransactions,
      currentPage: page,
      totalPages: totalPages,
      totalTransactions: totalTransactions,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    };
  } catch (error) {
    console.error('Error in getPaginatedTransactions:', error);
    throw error;
  }
};

/** Get completed transactions of a given type. */
export const getTransactionsByType = async (
  userId: UserId,
  type: WalletTransactionType
): Promise<IWalletTransaction[]> => {
  const wallet = await Wallet.findOne({ userId }).lean();

  if (!wallet) return [];

  return wallet.transactions
    .filter((t) => t.type === type && t.status === 'completed')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

/** Get a single transaction by its transactionId. */
export const getTransactionById = async (
  userId: UserId,
  transactionId: string
): Promise<IWalletTransaction | null> => {
  const wallet = await Wallet.findOne({
    userId,
    'transactions.transactionId': transactionId
  });

  if (!wallet) return null;

  return wallet.transactions.find((t) => t.transactionId === transactionId) ?? null;
};

/** Update a transaction's status in place. */
export const updateTransactionStatus = async (
  userId: UserId,
  transactionId: string,
  status: WalletTransactionStatus
) => {
  const result = await Wallet.findOneAndUpdate(
    {
      userId,
      'transactions.transactionId': transactionId
    },
    {
      $set: { 'transactions.$.status': status }
    },
    { new: true }
  );

  return result;
};

/**
 * Add a pending credit, used while a payment is being processed.
 * The balance is not moved until completePendingTransaction runs.
 */
export const addPendingTransaction = async (
  userId: UserId,
  transactionData: Pick<
    AddTransactionInput,
    'amount' | 'description' | 'paymentMethod' | 'razorpayOrderId' | 'razorpayPaymentId'
  >
): Promise<AddTransactionResult> => {
  const wallet = await getOrCreateWallet(userId);

  const transactionId = newTransactionId();

  wallet.transactions.push({
    transactionId,
    type: 'credit',
    amount: transactionData.amount,
    description: transactionData.description,
    paymentMethod: transactionData.paymentMethod,
    status: 'pending',
    razorpayOrderId: transactionData.razorpayOrderId ?? undefined,
    razorpayPaymentId: transactionData.razorpayPaymentId ?? undefined,
    date: new Date(),
    balanceAfter: wallet.balance
  } as IWalletTransaction);

  await wallet.save();

  return {
    transactionId,
    wallet
  };
};

/** Mark a pending transaction completed and apply it to the balance. */
export const completePendingTransaction = async (
  userId: UserId,
  transactionId: string
): Promise<IWallet> => {
  const wallet = await Wallet.findOne({
    userId,
    'transactions.transactionId': transactionId
  });

  if (!wallet) {
    throw new Error('Transaction not found');
  }

  const transaction = wallet.transactions.find((t) => t.transactionId === transactionId);

  if (!transaction) {
    throw new Error('Transaction not found');
  }

  // Update transaction status
  transaction.status = 'completed';

  // Update balance
  wallet.balance += transaction.amount;
  transaction.balanceAfter = wallet.balance;

  await wallet.save();

  return wallet;
};

/** Mark a pending transaction failed without touching the balance. */
export const failPendingTransaction = async (
  userId: UserId,
  transactionId: string
): Promise<IWallet> => {
  const wallet = await Wallet.findOne({
    userId,
    'transactions.transactionId': transactionId
  });

  if (!wallet) {
    throw new Error('Transaction not found');
  }

  const transaction = wallet.transactions.find((t) => t.transactionId === transactionId);

  if (!transaction) {
    throw new Error('Transaction not found');
  }

  transaction.status = 'failed';
  await wallet.save();

  return wallet;
};

/** Aggregate wallet figures for the wallet page. */
export const getWalletStats = async (userId: UserId): Promise<WalletStats> => {
  const wallet = await Wallet.findOne({ userId });

  if (!wallet) {
    return {
      balance: 0,
      totalCredits: 0,
      totalDebits: 0,
      transactionCount: 0,
      monthlyAdded: 0
    };
  }

  const completedTransactions = wallet.transactions.filter((t) => t.status === 'completed');
  const monthlyTransactions = completedTransactions.filter((t) => {
    const date = new Date(t.date);
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  });

  return {
    balance: wallet.balance,
    totalCredits: completedTransactions
      .filter((t) => t.type === 'credit')
      .reduce((sum, t) => sum + t.amount, 0),
    totalDebits: completedTransactions
      .filter((t) => t.type === 'debit')
      .reduce((sum, t) => sum + t.amount, 0),
    transactionCount: completedTransactions.length,
    monthlyAdded: monthlyTransactions
      .filter((t) => t.type === 'credit')
      .reduce((sum, t) => sum + t.amount, 0)
  };
};

/** Add credit to a wallet (used for cancellation refunds). */
export const addCredit = async (
  userId: UserId,
  amount: number,
  description: string,
  orderId: string | null = null
): Promise<WalletOperationResult> => {
  try {
    // Validate inputs
    if (!userId || !amount || amount <= 0) {
      return {
        success: false,
        message: 'Invalid user ID or amount'
      };
    }

    const result = await addTransaction(userId, {
      type: 'credit',
      amount: amount,
      description: description,
      paymentMethod: 'refund',
      status: 'completed',
      orderId: orderId
    });

    console.log(`Credit added: ₹${amount} credited to user ${userId} - ${description}`);

    return {
      success: true,
      message: 'Credit added successfully',
      transactionId: result.transactionId,
      wallet: result.wallet,
      newBalance: result.wallet.balance
    };
  } catch (error) {
    console.error('Error adding credit:', error);
    return {
      success: false,
      message: (error as Error).message || 'Failed to add credit',
      error: (error as Error).message
    };
  }
};

/** Credit a return refund to a wallet. */
export const addReturnRefund = async (
  userId: UserId,
  amount: number,
  orderId: string,
  returnId: string
): Promise<WalletOperationResult> => {
  try {
    // Validate inputs
    if (!userId || !amount || amount <= 0) {
      return {
        success: false,
        message: 'Invalid user ID or refund amount'
      };
    }

    const description = `Refund for returned item in order ${orderId}`;

    const result = await addTransaction(userId, {
      type: 'credit',
      amount: amount,
      description: description,
      paymentMethod: 'refund',
      status: 'completed',
      orderId: orderId,
      returnId: returnId
    });

    console.log(
      `Return refund processed: ₹${amount} credited to user ${userId} for order ${orderId}, return ${returnId}`
    );

    return {
      success: true,
      message: 'Return refund credited successfully',
      transactionId: result.transactionId,
      wallet: result.wallet,
      newBalance: result.wallet.balance,
      refundAmount: amount
    };
  } catch (error) {
    console.error('Error processing return refund:', error);
    return {
      success: false,
      message: (error as Error).message || 'Failed to process return refund',
      error: (error as Error).message
    };
  }
};

/** Deduct an amount from a wallet (used when paying for an order). */
export const deductAmount = async (
  userId: UserId,
  amount: number,
  description: string,
  orderId: string | null = null
): Promise<WalletOperationResult> => {
  try {
    // Validate inputs
    if (!userId || !amount || amount <= 0) {
      return {
        success: false,
        message: 'Invalid user ID or amount'
      };
    }

    // Check wallet balance
    const wallet = await getWallet(userId);
    if (!wallet || wallet.balance < amount) {
      return {
        success: false,
        message: 'Insufficient wallet balance'
      };
    }

    const result = await addTransaction(userId, {
      type: 'debit',
      amount: amount,
      description: description,
      paymentMethod: 'payment_for_order',
      status: 'completed',
      orderId: orderId
    });

    console.log(`Amount deducted: ₹${amount} deducted from user ${userId} - ${description}`);

    return {
      success: true,
      message: 'Amount deducted successfully',
      transactionId: result.transactionId,
      wallet: result.wallet,
      newBalance: result.wallet.balance
    };
  } catch (error) {
    console.error('Error deducting amount:', error);
    return {
      success: false,
      message: (error as Error).message || 'Failed to deduct amount',
      error: (error as Error).message
    };
  }
};
