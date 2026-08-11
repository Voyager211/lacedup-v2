import express from 'express';
import nocache from '../../common/middlewares/nocache.middleware';
import * as landingController from './landing.controller';

const router = express.Router();

/**
 * @swagger
 * /:
 *   get:
 *     tags: [Content]
 *     summary: Landing page
 *     description: >
 *       Public landing page. Served with no-store cache headers so a logged-out
 *       view cannot be restored from the back button after signing in.
 *     responses:
 *       200:
 *         description: Landing page markup
 *         content:
 *           text/html:
 *             schema: { type: string }
 */
router.get('/', nocache, landingController.showLanding);

export = router;
