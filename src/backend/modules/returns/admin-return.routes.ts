import express from 'express';
import * as returnController from './admin-return.controller';
import isAdmin from '../../common/middlewares/is-admin.middleware';

const router = express.Router();

// Every route below requires an admin session.
router.use(isAdmin);

/**
 * @swagger
 * /admin/returns/statistics:
 *   get:
 *     tags: [Admin]
 *     summary: Return statistics
 *     security: [{ sessionCookie: [] }]
 *     responses:
 *       200:
 *         description: Counts by status and refund totals
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 pending: { type: integer }
 *                 approved: { type: integer }
 *                 rejected: { type: integer }
 *                 totalRefunded: { type: number }
 */
router.get('/statistics', returnController.getReturnStatistics);

/**
 * @swagger
 * /admin/returns/export:
 *   get:
 *     tags: [Admin]
 *     summary: Export returns
 *     security: [{ sessionCookie: [] }]
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Exported returns
 *         content:
 *           application/octet-stream:
 *             schema: { type: string, format: binary }
 */
router.get('/export', returnController.exportReturns);

/**
 * @swagger
 * /admin/returns/api/filtered:
 *   get:
 *     tags: [Admin]
 *     summary: List return requests
 *     security: [{ sessionCookie: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [Pending, Approved, Rejected, Processing, Completed] }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *     responses:
 *       200: { description: A page of return requests }
 */
router.get('/api/filtered', returnController.getReturnsAPI);

/**
 * @swagger
 * /admin/returns:
 *   get:
 *     tags: [Admin]
 *     summary: Returns management page
 *     security: [{ sessionCookie: [] }]
 *     responses:
 *       200: { description: Returns list markup, content: { text/html: { schema: { type: string } } } }
 */
router.get('/', returnController.getAllReturns);

/**
 * @swagger
 * /admin/returns/{returnId}/approve:
 *   patch:
 *     tags: [Admin]
 *     summary: Approve a return request
 *     description: >
 *       Restores the product stock and credits the refund to the customer's
 *       wallet. An optional custom refund amount overrides the item total.
 *     security: [{ sessionCookie: [] }]
 *     parameters:
 *       - in: path
 *         name: returnId
 *         required: true
 *         schema: { type: string }
 *         example: RET000042
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refundAmount: { type: number, description: Overrides the item total when present }
 *     responses:
 *       200: { description: Return approved and refunded }
 *       400: { description: Return is not in an approvable state }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.patch('/:returnId/approve', returnController.approveReturn);

/**
 * @swagger
 * /admin/returns/{returnId}/reject:
 *   patch:
 *     tags: [Admin]
 *     summary: Reject a return request
 *     security: [{ sessionCookie: [] }]
 *     parameters:
 *       - in: path
 *         name: returnId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rejectionReason: { type: string }
 *     responses:
 *       200: { description: Return rejected }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.patch('/:returnId/reject', returnController.rejectReturn);

/**
 * @swagger
 * /admin/returns/orders/{orderId}/approve:
 *   patch:
 *     tags: [Admin]
 *     summary: Approve every return request on an order
 *     security: [{ sessionCookie: [] }]
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: All returns on the order approved and refunded }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.patch('/orders/:orderId/approve', returnController.approveOrderReturn);

/**
 * @swagger
 * /admin/returns/orders/{orderId}/reject:
 *   patch:
 *     tags: [Admin]
 *     summary: Reject every return request on an order
 *     security: [{ sessionCookie: [] }]
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: All returns on the order rejected }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.patch('/orders/:orderId/reject', returnController.rejectOrderReturn);

export = router;
