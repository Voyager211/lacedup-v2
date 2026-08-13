import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import * as walletController from './wallet.controller';
import { wantsJson } from '../../common/utils/wants-json.util';

const router = express.Router();

const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated() || req.session.userId) {
    return next();
  }

  if (wantsJson(req)) {
    return res.status(401).json({
      success: false,
      message: 'You must be logged in to access this feature',
      code: 'AUTHENTICATION_REQUIRED'
    });
  }

  req.flash('error', 'Please log in to continue');
  return res.redirect('/login');
};

/**
 * @swagger
 * /wallet:
 *   get:
 *     tags: [Wallet]
 *     summary: Wallet page
 *     security: [{ sessionCookie: [] }]
 *     responses:
 *       200: { description: Wallet page markup, content: { text/html: { schema: { type: string } } } }
 *       302: { description: Redirected to /login when not signed in }
 */
router.get('/', requireAuth, walletController.renderWalletPage);

/**
 * @swagger
 * /wallet/balance:
 *   get:
 *     tags: [Wallet]
 *     summary: Current wallet balance
 *     security: [{ sessionCookie: [] }]
 *     responses:
 *       200:
 *         description: Balance
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 balance: { type: number, example: 1250.5 }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/balance', requireAuth, walletController.getWalletBalance);

/**
 * @swagger
 * /wallet/transactions/paginated:
 *   get:
 *     tags: [Wallet]
 *     summary: Wallet transactions, paginated
 *     description: Only completed transactions are returned, newest first.
 *     security: [{ sessionCookie: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [credit, debit] }
 *     responses:
 *       200:
 *         description: A page of transactions
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Pagination'
 *                 - type: object
 *                   properties:
 *                     transactions:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/WalletTransaction' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/transactions/paginated', requireAuth, walletController.getPaginatedTransactionsAPI);

/**
 * @swagger
 * /wallet/stats:
 *   get:
 *     tags: [Wallet]
 *     summary: Wallet totals
 *     security: [{ sessionCookie: [] }]
 *     responses:
 *       200:
 *         description: Aggregate figures for the wallet page
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 balance: { type: number }
 *                 totalCredits: { type: number }
 *                 totalDebits: { type: number }
 *                 transactionCount: { type: integer }
 *                 monthlyAdded: { type: number, description: Credits added this calendar month }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/stats', requireAuth, walletController.getWalletStatsAPI);

/**
 * @swagger
 * /wallet/transaction/{transactionId}:
 *   get:
 *     tags: [Wallet]
 *     summary: A single wallet transaction
 *     security: [{ sessionCookie: [] }]
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema: { type: string }
 *         example: TXN17012345678901
 *     responses:
 *       200: { description: The transaction, content: { application/json: { schema: { $ref: '#/components/schemas/WalletTransaction' } } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/transaction/:transactionId', requireAuth, walletController.getTransaction);

/**
 * @swagger
 * /wallet/add-money:
 *   post:
 *     tags: [Wallet]
 *     summary: Credit the wallet directly
 *     security: [{ sessionCookie: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount]
 *             properties:
 *               amount: { type: number, minimum: 1 }
 *     responses:
 *       200: { description: Wallet credited, content: { application/json: { schema: { $ref: '#/components/schemas/Success' } } } }
 *       400: { description: Invalid amount }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.post('/add-money', requireAuth, walletController.addMoney);

/**
 * @swagger
 * /wallet/topup/create-order:
 *   post:
 *     tags: [Wallet]
 *     summary: Start a Razorpay wallet top-up
 *     description: >
 *       Creates the Razorpay order. The wallet is only credited once
 *       /wallet/topup/verify-razorpay confirms the signature.
 *     security: [{ sessionCookie: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount]
 *             properties:
 *               amount: { type: number, minimum: 1 }
 *     responses:
 *       200:
 *         description: Razorpay order created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 razorpayOrderId: { type: string }
 *                 amount: { type: integer, description: Amount in paise }
 *                 keyId: { type: string }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       429: { $ref: '#/components/responses/RateLimited' }
 */
router.post('/topup/create-order', requireAuth, walletController.createRazorpayOrder);

/**
 * @swagger
 * /wallet/topup/verify-razorpay:
 *   post:
 *     tags: [Wallet]
 *     summary: Verify a Razorpay top-up and credit the wallet
 *     description: >
 *       The signature is an HMAC-SHA256 of `razorpayOrderId|razorpayPaymentId`
 *       keyed with the Razorpay secret, so a payment proof cannot be replayed
 *       against a different order.
 *     security: [{ sessionCookie: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [razorpayOrderId, razorpayPaymentId, razorpaySignature]
 *             properties:
 *               razorpayOrderId: { type: string }
 *               razorpayPaymentId: { type: string }
 *               razorpaySignature: { type: string }
 *     responses:
 *       200: { description: Payment verified and wallet credited }
 *       400: { description: Signature verification failed, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.post('/topup/verify-razorpay', requireAuth, walletController.verifyRazorpayPayment);

/**
 * @swagger
 * /wallet/debit:
 *   post:
 *     tags: [Wallet]
 *     summary: Debit the wallet
 *     description: Used when paying for an order from wallet balance.
 *     security: [{ sessionCookie: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount]
 *             properties:
 *               amount: { type: number, minimum: 1 }
 *               description: { type: string }
 *               orderId: { type: string }
 *     responses:
 *       200: { description: Wallet debited, content: { application/json: { schema: { $ref: '#/components/schemas/Success' } } } }
 *       400: { description: Insufficient wallet balance, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.post('/debit', requireAuth, walletController.debitWallet);

export = router;
