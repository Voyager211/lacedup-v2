import express from 'express';
import { isAuthenticated } from '../../common/middlewares/auth.middleware';
import * as homeController from './home.controller';

const router = express.Router();

/**
 * @swagger
 * /home:
 *   get:
 *     tags: [Shop]
 *     summary: Signed-in home page
 *     description: >
 *       Storefront home for authenticated users - new arrivals, best sellers,
 *       active categories and brands. Guests are redirected to the landing page.
 *     security: [{ sessionCookie: [] }]
 *     responses:
 *       200:
 *         description: Home page markup
 *         content:
 *           text/html:
 *             schema: { type: string }
 *       302: { description: Redirected to the landing page when not signed in }
 */
router.get('/home', isAuthenticated, homeController.getHome);

export = router;
