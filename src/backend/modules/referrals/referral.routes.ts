import express from 'express';
import { isAuthenticated } from '../../common/middlewares/auth.middleware';
import * as referralController from './referral.controller';

const router = express.Router();

/**
 * @swagger
 * /referrals:
 *   get:
 *     tags: [Referrals]
 *     summary: Referrals page
 *     description: >
 *       The user's referral code, shareable signup link, referral history and
 *       total rewards earned.
 *     security: [{ sessionCookie: [] }]
 *     responses:
 *       200:
 *         description: Referrals page markup
 *         content:
 *           text/html:
 *             schema: { type: string }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/', isAuthenticated, referralController.getReferralsPage);

export = router;
