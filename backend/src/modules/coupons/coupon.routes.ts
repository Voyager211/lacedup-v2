import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import * as couponController from './coupon.controller';

const router = express.Router();

const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated()) {
    return next();
  }

  // req.headers.accept is absent when no Accept header is sent, which turned
  // every unauthenticated hit into a 500 instead of a redirect to login.
  if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
    return res.status(401).json({
      success: false,
      message: 'You must be logged in to access this feature',
      code: 'AUTHENTICATION_REQUIRED'
    });
  }

  return res.status(401).json({ success: false, message: 'Authentication required' });
};


/**
 * @swagger
 * /coupons/available:
 *   get:
 *     tags: [Coupons]
 *     summary: Coupons applicable to the current cart
 *     description: >
 *       Evaluates each active coupon against the cart total and the user's own
 *       usage history, so already-redeemed coupons are excluded.
 *     responses:
 *       200:
 *         description: Applicable coupons
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 coupons:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Coupon' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
router.get('/available', (req: Request, res: Response) => {
  couponController.getAvailableCoupons(req, res);
});

export = router;
