import express from 'express';
import nocache from '../../common/middlewares/nocache.middleware';
import isAdmin from '../../common/middlewares/is-admin.middleware';
import * as authController from './admin-auth.controller';
import * as dashboardController from '../reports/dashboard.controller';

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
 * /admin/logout:
 *   get:
 *     tags: [Admin]
 *     summary: Admin logout
 *     responses:
 *       302: { description: Redirected to /admin/login }
 */
router.get('/logout', authController.logout);

export = router;
