import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import * as orderController from './order.controller';
import { wantsJson } from '../../common/utils/wants-json.util';
import { isSignedIn } from '../../common/utils/current-user.util';

const router = express.Router();

/*
 * Every route here is registered on its historic path and under /api.
 *
 * This router is root-mounted and deliberately not dual-mounted (app.ts), so
 * the bare paths are all that existed - every one of them was a 404 under the
 * /api base URL the SPA uses, exactly as the auth routes were.
 *
 * The /api forms drop the odd inner segment: `/orders/api/filtered` becomes
 * `/api/orders/filtered` rather than `/api/orders/api/filtered`. Declaration
 * order still matters - the literal paths must precede `/:orderId`, or that
 * parameter would swallow them.
 */

const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (isSignedIn(req)) {
    return next();
  }

  res.status(401).json({
    success: false,
    message: 'Authentication required'
  });
};

/**
 * @swagger
 * /orders/api/filtered:
 *   get:
 *     tags: [Orders]
 *     summary: Orders for the current user, filtered and paginated
 *     security: [{ sessionCookie: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: status
 *         schema: { type: string, example: Delivered }
 *         description: Filters by item status, not order status
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Matched against order id, product name and brand name
 *     responses:
 *       200:
 *         description: A page of orders
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   allOf:
 *                     - $ref: '#/components/schemas/Pagination'
 *                     - type: object
 *                       properties:
 *                         orders:
 *                           type: array
 *                           items: { $ref: '#/components/schemas/Order' }
 *                         totalOrders: { type: integer }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/api/orders/filtered', requireAuth, orderController.getUserOrdersPaginated);

/**
 * @swagger
 * /orders/api/search:
 *   get:
 *     tags: [Orders]
 *     summary: Search the current user's orders
 *     security: [{ sessionCookie: [] }]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Matching orders
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 orders:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Order' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/api/orders/search', requireAuth, orderController.searchOrders);

/**
 * @swagger
 * /orders:
 *   get:
 *     tags: [Orders]
 *     summary: Order history page
 *     security: [{ sessionCookie: [] }]
 *     responses:
 *       200: { description: Orders page markup, content: { text/html: { schema: { type: string } } } }
 *       302: { description: Redirected to /login when not signed in }
 */
router.get('/api/orders', requireAuth, orderController.getUserOrders);

/**
 * @swagger
 * /orders/{orderId}:
 *   get:
 *     tags: [Orders]
 *     summary: Order details
 *     security: [{ sessionCookie: [] }]
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema: { type: string }
 *         example: ORD000123
 *     responses:
 *       200: { description: Order details markup, content: { text/html: { schema: { type: string } } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   patch:
 *     tags: [Orders]
 *     summary: Cancel an order
 *     description: >
 *       Cancels every still-cancellable item. Only orders in Pending or
 *       Processing can be cancelled. Prepaid orders are refunded to the wallet.
 *     security: [{ sessionCookie: [] }]
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Must be one of the allowed cancellation reasons
 *                 example: Ordered by mistake
 *     responses:
 *       200: { description: Order cancelled, content: { application/json: { schema: { $ref: '#/components/schemas/Success' } } } }
 *       400: { description: Order is not in a cancellable state, or the reason is invalid }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/api/orders/:orderId', requireAuth, orderController.getOrderDetails);
router.patch('/api/orders/:orderId', requireAuth, orderController.cancelOrder);

/**
 * @swagger
 * /orders/{orderId}/items/{itemId}:
 *   patch:
 *     tags: [Orders]
 *     summary: Cancel a single item in an order
 *     description: >
 *       The order's own status is recalculated from the remaining items, so
 *       cancelling one line can move the order to Partially Delivered or
 *       Cancelled.
 *     security: [{ sessionCookie: [] }]
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               reason: { type: string }
 *     responses:
 *       200: { description: Item cancelled }
 *       400: { description: Item is not cancellable }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.patch('/api/orders/:orderId/items/:itemId', requireAuth, orderController.cancelItem);

/**
 * @swagger
 * /orders/{orderId}/returns:
 *   post:
 *     tags: [Orders]
 *     summary: Request a return for a whole order
 *     description: Only delivered orders can be returned. Creates a request for admin approval.
 *     security: [{ sessionCookie: [] }]
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               reason: { type: string, example: Size too small }
 *     responses:
 *       201: { description: Return requested }
 *       400: { description: Order is not in a returnable state }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.post('/api/orders/:orderId/returns', requireAuth, orderController.requestOrderReturn);

/**
 * @swagger
 * /orders/{orderId}/items/{itemId}/returns:
 *   post:
 *     tags: [Orders]
 *     summary: Request a return for one item
 *     security: [{ sessionCookie: [] }]
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               reason: { type: string }
 *     responses:
 *       201: { description: Return requested }
 *       400: { description: Item is not in a returnable state }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.post('/api/orders/:orderId/items/:itemId/returns', requireAuth, orderController.requestItemReturn);

/**
 * @swagger
 * /orders/{orderId}/invoice:
 *   get:
 *     tags: [Orders]
 *     summary: Download the order invoice as a PDF
 *     security: [{ sessionCookie: [] }]
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: The invoice
 *         content:
 *           application/pdf:
 *             schema: { type: string, format: binary }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/api/orders/:orderId/invoice', requireAuth, orderController.downloadInvoice);

export = router;
