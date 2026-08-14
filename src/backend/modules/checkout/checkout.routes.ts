import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import * as checkoutController from './checkout.controller';
import * as addressController from '../addresses/address.controller';
import * as couponController from '../coupons/coupon.controller';
import { couponRateLimit } from '../../common/middlewares/rate-limiting.middleware';

import { wantsJson } from '../../common/utils/wants-json.util';

const router = express.Router();

const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated()) {
    return next();
  }

  // A request that arrived under /api wanted the API, whatever headers it
  // sent - a 302 to an HTML login page gives an XHR caller nothing to act on.
  return res.status(401).json({
    success: false,
    message: 'You must be logged in to access this feature',
    code: 'AUTHENTICATION_REQUIRED'
  });
};

const requireAuthAPI = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated()) {
    return next();
  }

  return res.status(401).json({
    success: false,
    message: 'You must be logged in to access this feature',
    code: 'AUTHENTICATION_REQUIRED'
  });
};

/**
 * @swagger
 * /checkout:
 *   get:
 *     tags: [Checkout]
 *     summary: Checkout page
 *     security: [{ sessionCookie: [] }]
 *     responses:
 *       200: { description: Checkout markup, content: { text/html: { schema: { type: string } } } }
 *       302: { description: Redirected to /login when not signed in }
 */
router.get('/', requireAuth, checkoutController.loadCheckout);

/**
 * @swagger
 * /checkout/validate-checkout-stock:
 *   get:
 *     tags: [Checkout]
 *     summary: Revalidate stock immediately before payment
 *     security: [{ sessionCookie: [] }]
 *     responses:
 *       200:
 *         description: Validation result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 invalidItems: { type: array, items: { type: object } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/validate-checkout-stock', requireAuthAPI, checkoutController.validateCheckoutStock);

/**
 * @swagger
 * /checkout/api/addresses:
 *   get:
 *     tags: [Checkout]
 *     summary: Addresses available at checkout
 *     security: [{ sessionCookie: [] }]
 *     responses:
 *       200:
 *         description: The user's addresses
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 addresses: { type: array, items: { $ref: '#/components/schemas/Address' } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/api/addresses', requireAuthAPI, addressController.getAddresses);

/**
 * @swagger
 * /checkout/apply-coupon:
 *   post:
 *     tags: [Checkout]
 *     summary: Apply a coupon to the current cart
 *     description: >
 *       Validates the code against its date window, global and per-user usage
 *       limits, and the cart minimum. Rate limited to 10 attempts per 15
 *       minutes so codes cannot be enumerated.
 *     security: [{ sessionCookie: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [couponCode]
 *             properties:
 *               couponCode: { type: string, example: SAVE10 }
 *     responses:
 *       200:
 *         description: Coupon applied
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 discountAmount: { type: number }
 *                 totals: { type: object }
 *       400: { description: Invalid, expired, already used, or below the minimum order value }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       429: { $ref: '#/components/responses/RateLimited' }
 */
router.post('/apply-coupon', couponRateLimit, requireAuthAPI, couponController.applyCoupon);

/**
 * @swagger
 * /checkout/remove-coupon:
 *   post:
 *     tags: [Checkout]
 *     summary: Remove the applied coupon
 *     security: [{ sessionCookie: [] }]
 *     responses:
 *       200: { description: Coupon removed with recalculated totals }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.post('/remove-coupon', requireAuthAPI, couponController.removeCoupon);

/**
 * @swagger
 * /checkout/place-order:
 *   post:
 *     tags: [Checkout]
 *     summary: Place an order
 *     description: >
 *       Revalidates stock, then creates the order. COD orders are placed
 *       immediately; card and wallet payments go through their own endpoints.
 *     security: [{ sessionCookie: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [addressId, paymentMethod]
 *             properties:
 *               addressId: { type: string }
 *               addressIndex: { type: integer }
 *               paymentMethod:
 *                 type: string
 *                 enum: [cod, card, upi, paypal, netbanking, wallet]
 *     responses:
 *       200:
 *         description: Order placed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 orderId: { type: string, example: ORD000123 }
 *       400: { description: Stock changed, cart empty, or address invalid }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.post('/place-order', requireAuthAPI, checkoutController.placeOrderWithValidation);

/**
 * @swagger
 * /checkout/create-razorpay-order:
 *   post:
 *     tags: [Checkout]
 *     summary: Create a Razorpay order for the cart
 *     description: >
 *       Snapshots the cart, totals, coupon and address into a PendingOrder
 *       record keyed by the Razorpay order id, with a 30-minute TTL. No order
 *       row exists until payment verifies, so abandoning payment leaves only
 *       that record, which expires on its own.
 *
 *       The snapshot is keyed on the Razorpay id rather than held in the
 *       session so that verification cannot fail because a session was lost -
 *       which previously left customers charged with no order.
 *     security: [{ sessionCookie: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [addressId]
 *             properties:
 *               addressId: { type: string }
 *               addressIndex: { type: integer }
 *     responses:
 *       200:
 *         description: Razorpay order created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     razorpayOrderId: { type: string }
 *                     amount: { type: integer, description: Amount in paise }
 *                     currency: { type: string, example: INR }
 *                     keyId: { type: string }
 *       400: { description: Cart empty or stock unavailable }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.post('/create-razorpay-order', requireAuthAPI, checkoutController.createRazorpayPayment);

/**
 * @swagger
 * /checkout/verify-razorpay-payment:
 *   post:
 *     tags: [Checkout]
 *     summary: Verify a Razorpay payment and create the order
 *     description: >
 *       Verifies an HMAC-SHA256 of `razorpayOrderId|razorpayPaymentId` keyed
 *       with the Razorpay secret. The order is only written once the signature
 *       checks out, so a payment proof cannot be replayed onto another order.
 *     security: [{ sessionCookie: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [razorpay_order_id, razorpay_payment_id, razorpay_signature]
 *             properties:
 *               razorpay_order_id: { type: string }
 *               razorpay_payment_id: { type: string }
 *               razorpay_signature: { type: string }
 *     responses:
 *       200: { description: Payment verified and order created }
 *       400: { description: Signature verification failed }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.post('/verify-razorpay-payment', requireAuthAPI, checkoutController.verifyRazorpayPayment);

/**
 * @swagger
 * /checkout/payment-failure:
 *   post:
 *     tags: [Checkout]
 *     summary: Record a failed payment
 *     description: Stores the failure in the session so the retry page can be rendered.
 *     security: [{ sessionCookie: [] }]
 *     responses:
 *       200: { description: Failure recorded, with a transaction id for the retry flow }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.post('/payment-failure', requireAuthAPI, checkoutController.handlePaymentFailure);

/**
 * @swagger
 * /checkout/process-wallet-payment:
 *   post:
 *     tags: [Checkout]
 *     summary: Pay for the order from wallet balance
 *     security: [{ sessionCookie: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [addressId]
 *             properties:
 *               addressId: { type: string }
 *               addressIndex: { type: integer }
 *     responses:
 *       200: { description: Wallet debited and order placed }
 *       400: { description: Insufficient wallet balance }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.post('/process-wallet-payment', requireAuthAPI, checkoutController.handleWalletPayment);

/**
 * @swagger
 * /checkout/order-success/{orderId}:
 *   get:
 *     tags: [Checkout]
 *     summary: Order confirmation page
 *     security: [{ sessionCookie: [] }]
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Confirmation markup, content: { text/html: { schema: { type: string } } } }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/order-success/:orderId', requireAuth, checkoutController.loadOrderSuccess);

/**
 * @swagger
 * /checkout/order-failure/{transactionId}:
 *   get:
 *     tags: [Checkout]
 *     summary: Payment failure page
 *     security: [{ sessionCookie: [] }]
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Failure page markup, content: { text/html: { schema: { type: string } } } }
 */
router.get('/order-failure/:transactionId', requireAuth, checkoutController.loadOrderFailure);

/**
 * @swagger
 * /checkout/retry-payment/{transactionId}:
 *   get:
 *     tags: [Checkout]
 *     summary: Retry a failed payment
 *     description: Rebuilds the attempted order from the session failure record.
 *     security: [{ sessionCookie: [] }]
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Retry page markup, content: { text/html: { schema: { type: string } } } }
 *       404: { description: No matching failed payment in the session }
 */
router.get('/retry-payment/:transactionId', requireAuth, checkoutController.loadRetryPaymentPage);

/**
 * @swagger
 * /checkout/create-razorpay-order-retry:
 *   post:
 *     tags: [Checkout]
 *     summary: Create a Razorpay order for a retry
 *     security: [{ sessionCookie: [] }]
 *     responses:
 *       200: { description: Razorpay order created for the retry }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.post('/create-razorpay-order-retry', requireAuthAPI, checkoutController.createRazorpayOrderForRetry);

/**
 * @swagger
 * /checkout/verify-retry-razorpay-payment:
 *   post:
 *     tags: [Checkout]
 *     summary: Verify a retried Razorpay payment
 *     security: [{ sessionCookie: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [razorpay_order_id, razorpay_payment_id, razorpay_signature]
 *             properties:
 *               razorpay_order_id: { type: string }
 *               razorpay_payment_id: { type: string }
 *               razorpay_signature: { type: string }
 *     responses:
 *       200: { description: Retry verified and order created }
 *       400: { description: Signature verification failed }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.post('/verify-retry-razorpay-payment', requireAuthAPI, checkoutController.verifyRetryRazorpayPayment);

/**
 * @swagger
 * /checkout/retry-payment-failure:
 *   post:
 *     tags: [Checkout]
 *     summary: Record a failed retry
 *     security: [{ sessionCookie: [] }]
 *     responses:
 *       200: { description: Retry failure recorded }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.post('/retry-payment-failure', requireAuthAPI, checkoutController.handleRetryPaymentFailure);

export = router;
