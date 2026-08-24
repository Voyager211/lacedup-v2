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

/**
 * @swagger
 * /referrals/api/referred-users:
 *   get:
 *     tags: [Referrals]
 *     summary: A page of people this user referred
 *     description: >
 *       The referrals page has always called this, and the handler has always
 *       existed - it was simply never mounted, so page 2 of the referrals list
 *       has never worked for anyone. Mounted here alongside the earnings
 *       paginator.
 *     security: [{ sessionCookie: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *     responses:
 *       200: { description: A page of referred users }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
/*
 * Two declarations because this router is mounted twice, at /referrals and at
 * /api/referrals. The first keeps the historic `/referrals/api/referred-users`
 * the EJS view calls; the second gives the SPA a clean
 * `/api/referrals/referred-users` rather than `/api/referrals/api/...`.
 */
router.get(
  ['/api/referred-users', '/referred-users'],
  isAuthenticated,
  referralController.getPaginatedReferrals
);

/**
 * @swagger
 * /referrals/api/earnings:
 *   get:
 *     tags: [Referrals]
 *     summary: A page of referral earnings
 *     description: The earnings counterpart of the paginator above, and equally unmounted until now.
 *     security: [{ sessionCookie: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *     responses:
 *       200: { description: A page of referral transactions }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get(
  ['/api/earnings', '/earnings'],
  isAuthenticated,
  referralController.getPaginatedEarnings
);

export = router;
