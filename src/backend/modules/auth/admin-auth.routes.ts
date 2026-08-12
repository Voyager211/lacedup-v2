import express from 'express';
import type { Request, Response } from 'express';
import nocache from '../../common/middlewares/nocache.middleware';
import isAdmin from '../../common/middlewares/is-admin.middleware';
import * as authController from './admin-auth.controller';
import * as dashboardController from '../reports/dashboard.controller';
import { rotateSession } from './auth.session';
import { publicUser } from '../users/user.serializer';

const router = express.Router();

/**
 * @swagger
 * /admin/login:
 *   get:
 *     tags: [Admin]
 *     summary: Admin login page
 *     description: Served with no-store headers so the form cannot be restored from cache after logout.
 *     responses:
 *       200: { description: Login form markup, content: { text/html: { schema: { type: string } } } }
 *   post:
 *     tags: [Admin]
 *     summary: Admin login
 *     description: >
 *       Authenticates against the same user collection but refuses anyone whose
 *       role is not `admin`. Admin sessions use the `admin.sid` cookie and last
 *       60 minutes, against 20 for shoppers.
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, format: password }
 *               remember: { type: boolean }
 *     responses:
 *       302: { description: Redirected to the dashboard on success, or back to /admin/login on failure }
 */
router.get('/login', nocache, authController.getLogin);
router.post('/login', authController.postLogin);

/**
 * @swagger
 * /admin/dashboard:
 *   get:
 *     tags: [Admin]
 *     summary: Admin dashboard
 *     security: [{ sessionCookie: [] }]
 *     responses:
 *       200: { description: Dashboard markup, content: { text/html: { schema: { type: string } } } }
 *       302: { description: Redirected to /admin/login without an admin session }
 */
router.get('/dashboard', isAdmin, dashboardController.renderDashboard);

/**
 * @swagger
 * /admin/auth/refresh:
 *   post:
 *     tags: [Admin]
 *     summary: Exchange the admin refresh cookie for a new token pair
 *     description: >
 *       The admin counterpart of /auth/refresh, reading and setting the
 *       admin_rt / admin_at cookies. Without it an admin holding a valid
 *       refresh token would still be signed out when the 60-minute access token
 *       expired. Rotation is single-use, as for shoppers.
 *     responses:
 *       200: { description: New admin access and refresh cookies issued }
 *       401: { description: Refresh token missing, expired, already used, or revoked }
 */
router.post('/auth/refresh', async (req: Request, res: Response) => {
  const presented = req.cookies?.admin_rt;

  if (!presented) {
    return res.status(401).json({ success: false, message: 'No refresh token' });
  }

  const result = await rotateSession(res, presented, 'admin');

  if (!result.ok) {
    return res.status(401).json({ success: false, message: result.reason });
  }

  return res.json({ success: true });
});

/**
 * @swagger
 * /admin/auth/me:
 *   get:
 *     tags: [Admin]
 *     summary: The currently signed-in admin
 *     description: >
 *       The admin counterpart of /auth/me, reading the admin cookie pair. The
 *       role check is what makes it distinct: a valid shopper session reaching
 *       this route is not an admin, so it is refused rather than reported as a
 *       signed-in user.
 *     responses:
 *       200: { description: The signed-in admin }
 *       401: { description: No valid admin session }
 */
router.get('/auth/me', (req: Request, res: Response) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }

  return res.json({ success: true, user: publicUser(req.user) });
});

/**
 * @swagger
 * /admin/logout:
 *   get:
 *     tags: [Admin]
 *     summary: Admin logout
 *     responses:
 *       302: { description: Redirected to /admin/login }
 */
router.get('/logout', authController.logout);

export = router;
