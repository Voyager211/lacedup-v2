import express from 'express';
import * as userController from './admin-user.controller';
import isAdmin from '../../common/middlewares/is-admin.middleware';

const router = express.Router();

// Every route below requires an admin session.
router.use(isAdmin);


/**
 * @swagger
 * /admin/users/api:
 *   get:
 *     tags: [Admin]
 *     summary: List users
 *     security: [{ sessionCookie: [] }]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: Matched against name, email and phone
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [all, blocked, unblocked], default: all }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *     responses:
 *       200:
 *         description: A page of users
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Pagination'
 *                 - type: object
 *                   properties:
 *                     users:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id: { type: string }
 *                           name: { type: string }
 *                           email: { type: string }
 *                           phone: { type: string }
 *                           isBlocked: { type: boolean }
 */
router.get('/api', userController.apiUsers);

/**
 * @swagger
 * /admin/users/{id}/block:
 *   patch:
 *     tags: [Admin]
 *     summary: Block a user
 *     description: >
 *       A blocked user is refused at login and forcibly logged out on their next
 *       request by the checkUserBlocked middleware.
 *     security: [{ sessionCookie: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: User blocked, content: { application/json: { schema: { $ref: '#/components/schemas/Success' } } } }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.patch('/:id/block', userController.apiBlockUser);

/**
 * @swagger
 * /admin/users/{id}/unblock:
 *   patch:
 *     tags: [Admin]
 *     summary: Unblock a user
 *     security: [{ sessionCookie: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: User unblocked, content: { application/json: { schema: { $ref: '#/components/schemas/Success' } } } }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.patch('/:id/unblock', userController.apiUnblockUser);

export = router;
