import express from 'express';
import * as couponController from './admin-coupon.controller';
import { requireAuth } from '../../common/middlewares/auth.middleware';
import isAdmin from '../../common/middlewares/is-admin.middleware';

const router = express.Router();

// Every route below requires an authenticated admin.
router.use(requireAuth);
router.use(isAdmin);

/**
 * @swagger
 * /admin/coupons/api:
 *   get:
 *     tags: [Admin]
 *     summary: List coupons
 *     security: [{ sessionCookie: [] }]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *     responses:
 *       200:
 *         description: A page of coupons
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Pagination'
 *                 - type: object
 *                   properties:
 *                     coupons:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/Coupon' }
 */
router.get('/api', couponController.getAllCouponsAPI);

/**
 * @swagger
 * /admin/coupons/api/{id}/toggle:
 *   patch:
 *     tags: [Admin]
 *     summary: Activate or deactivate a coupon
 *     security: [{ sessionCookie: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Status toggled }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.patch('/api/:id/toggle', couponController.toggleCouponStatus);

/**
 * @swagger
 * /admin/coupons/api/{id}:
 *   delete:
 *     tags: [Admin]
 *     summary: Delete a coupon
 *     security: [{ sessionCookie: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Coupon deleted }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.delete('/api/:id', couponController.deleteCoupon);


/**
 * @swagger
 * /admin/coupons/{id}:
 *   get:
 *     tags: [Admin]
 *     summary: Fetch one coupon
 *     security: [{ sessionCookie: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: The coupon, content: { application/json: { schema: { $ref: '#/components/schemas/Coupon' } } } }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   put:
 *     tags: [Admin]
 *     summary: Update a coupon
 *     security: [{ sessionCookie: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/Coupon' }
 *     responses:
 *       200: { description: Coupon updated }
 *       400: { description: Validation failed }
 */
router.get('/:id', couponController.getCouponById);

/**
 * @swagger
 * /admin/coupons/create:
 *   post:
 *     tags: [Admin]
 *     summary: Create a coupon
 *     description: >
 *       `usageLimit` caps total redemptions across all users; `userLimit` caps
 *       redemptions per user. `maximumDiscountAmount` only applies to
 *       percentage coupons.
 *     security: [{ sessionCookie: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, name, discountType, discountValue, validFrom, validTo]
 *             properties:
 *               code: { type: string, example: SAVE10 }
 *               name: { type: string }
 *               description: { type: string }
 *               discountType: { type: string, enum: [percentage, fixed] }
 *               discountValue: { type: number }
 *               minimumOrderValue: { type: number }
 *               maximumDiscountAmount: { type: number, nullable: true }
 *               usageLimit: { type: integer, nullable: true }
 *               userLimit: { type: integer, default: 1 }
 *               validFrom: { type: string, format: date }
 *               validTo: { type: string, format: date }
 *     responses:
 *       201: { description: Coupon created }
 *       400: { description: Validation failed or the code already exists }
 */
router.post('/create', couponController.createCoupon);

router.put('/:id', couponController.updateCoupon);

export = router;
