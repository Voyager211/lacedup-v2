import express from 'express';
import * as orderController from './admin-order.controller';
import isAdmin from '../../common/middlewares/is-admin.middleware';

const router = express.Router();

// Every route below requires an admin session.
router.use(isAdmin);

/**
 * @swagger
 * /admin/orders:
 *   get:
 *     tags: [Admin]
 *     summary: Orders management page
 *     security: [{ sessionCookie: [] }]
 *     responses:
 *       200: { description: Orders list markup, content: { text/html: { schema: { type: string } } } }
 */
router.get('/', orderController.getAllOrders);

/**
 * @swagger
 * /admin/orders/api/filtered:
 *   get:
 *     tags: [Admin]
 *     summary: List orders
 *     security: [{ sessionCookie: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: search
 *         schema: { type: string, description: Order id, or customer name/email }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: A page of orders
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Pagination'
 *                 - type: object
 *                   properties:
 *                     orders:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/Order' }
 */
router.get('/api/filtered', orderController.getFilteredOrders);

/**
 * @swagger
 * /admin/orders/api/statistics:
 *   get:
 *     tags: [Admin]
 *     summary: System-wide order statistics
 *     security: [{ sessionCookie: [] }]
 *     responses:
 *       200: { description: Aggregate order counts and revenue }
 */
router.get('/api/statistics', orderController.getSystemStatistics);

/**
 * @swagger
 * /admin/orders/api/{orderId}:
 *   get:
 *     tags: [Admin]
 *     summary: Order details as JSON
 *     security: [{ sessionCookie: [] }]
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: The order, content: { application/json: { schema: { $ref: '#/components/schemas/Order' } } } }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/api/:orderId', orderController.getOrderDetailsJSON);

/**
 * @swagger
 * /admin/orders/{orderId}:
 *   get:
 *     tags: [Admin]
 *     summary: Order details page
 *     security: [{ sessionCookie: [] }]
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Order detail markup, content: { text/html: { schema: { type: string } } } }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   patch:
 *     tags: [Admin]
 *     summary: Update the order status
 *     description: >
 *       Passing `action=cancel` or `action=return` delegates to the cancel and
 *       return handlers. Otherwise the status transition is validated before
 *       being applied, and cascades to every item.
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
 *             properties:
 *               status: { type: string, example: Shipped }
 *               notes: { type: string }
 *               action: { type: string, enum: [cancel, return] }
 *     responses:
 *       200: { description: Status updated }
 *       400: { description: Invalid status transition }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/:orderId', orderController.getOrderDetails);
router.patch('/:orderId', orderController.updateOrderStatus);

/**
 * @swagger
 * /admin/orders/{orderId}/transitions:
 *   get:
 *     tags: [Admin]
 *     summary: Statuses this order can move to
 *     description: >
 *       Note that Partially Delivered and Partially Returned currently have no
 *       outgoing transitions defined, so they return an empty list.
 *     security: [{ sessionCookie: [] }]
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Allowed transitions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 transitions: { type: array, items: { type: string } }
 */
router.get('/:orderId/transitions', orderController.getAllowedTransitions);

/**
 * @swagger
 * /admin/orders/{orderId}/cancel:
 *   patch:
 *     tags: [Admin]
 *     summary: Cancel an entire order
 *     description: Prepaid orders are refunded to the customer's wallet.
 *     security: [{ sessionCookie: [] }]
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Order cancelled }
 *       400: { description: Order is not cancellable }
 */
router.patch('/:orderId/cancel', orderController.cancelOrder);

/**
 * @swagger
 * /admin/orders/{orderId}/return:
 *   patch:
 *     tags: [Admin]
 *     summary: Raise a return for an entire order
 *     security: [{ sessionCookie: [] }]
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Return raised }
 */
router.patch('/:orderId/return', orderController.returnOrderRequest);

/**
 * @swagger
 * /admin/orders/{orderId}/items/{itemId}/status:
 *   patch:
 *     tags: [Admin]
 *     summary: Update one item's status
 *     description: The order status is recalculated from all item statuses afterwards.
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
 *             required: [status]
 *             properties:
 *               status: { type: string }
 *               notes: { type: string }
 *     responses:
 *       200: { description: Item status updated }
 *       400: { description: Invalid transition }
 */
router.patch('/:orderId/items/:itemId/status', orderController.updateItemStatus);

/**
 * @swagger
 * /admin/orders/{orderId}/items/{itemId}/cancel:
 *   patch:
 *     tags: [Admin]
 *     summary: Cancel one item
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
 *     responses:
 *       200: { description: Item cancelled }
 */
router.patch('/:orderId/items/:itemId/cancel', orderController.cancelItem);

/**
 * @swagger
 * /admin/orders/{orderId}/items/{itemId}/return:
 *   patch:
 *     tags: [Admin]
 *     summary: Raise a return for one item
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
 *     responses:
 *       200: { description: Return raised for the item }
 */
router.patch('/:orderId/items/:itemId/return', orderController.returnItemRequest);

/**
 * @swagger
 * /admin/orders/orders/{orderId}/fix-payment-status:
 *   patch:
 *     tags: [Admin]
 *     summary: Repair the payment status of a cancelled order
 *     description: >
 *       Maintenance endpoint for older records whose payment status did not
 *       follow the order to Cancelled. Note the doubled `orders/` segment - the
 *       route is declared with a leading `orders/` inside a router already
 *       mounted at /admin/orders.
 *     security: [{ sessionCookie: [] }]
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Payment status corrected }
 */
router.patch('/orders/:orderId/fix-payment-status', orderController.fixCancelledOrderPaymentStatus);

/**
 * @swagger
 * /admin/orders/statistics:
 *   get:
 *     tags: [Admin]
 *     summary: Order statistics
 *     description: >
 *       Shadowed by GET /admin/orders/{orderId}, which is declared earlier and
 *       matches `statistics` as an order id.
 *     security: [{ sessionCookie: [] }]
 *     responses:
 *       200: { description: Order statistics }
 */
router.get('/statistics', orderController.getOrderStatistics);

/**
 * @swagger
 * /admin/orders/export:
 *   get:
 *     tags: [Admin]
 *     summary: Export orders
 *     description: >
 *       Shadowed by GET /admin/orders/{orderId} for the same reason as
 *       /statistics above.
 *     security: [{ sessionCookie: [] }]
 *     responses:
 *       200:
 *         description: Exported orders
 *         content:
 *           application/octet-stream:
 *             schema: { type: string, format: binary }
 */
router.get('/export', orderController.exportOrders);

export = router;
