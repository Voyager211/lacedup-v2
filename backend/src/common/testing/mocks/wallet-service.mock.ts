/**
 * Mock wallet service for testing.
 *
 * Returns fixed balances so order tests can assert on refund behaviour without
 * standing up real wallet state.
 */
const mockWalletService = {
  addCredit: async (userId: string, amount: number, description: string, orderId?: string) => {
    console.log(`✅ Mock: Wallet credited ₹${amount} to user ${userId}`);
    return {
      success: true,
      newBalance: 5000,
      transaction: {
        amount,
        type: 'credit',
        description,
        orderId
      }
    };
  },

  deductCredit: async (userId: string, amount: number, description: string, orderId?: string) => {
    console.log(`✅ Mock: Wallet debited ₹${amount} from user ${userId}`);
    return {
      success: true,
      newBalance: 3000,
      transaction: {
        amount,
        type: 'debit',
        description,
        orderId
      }
    };
  }
};

export = mockWalletService;
