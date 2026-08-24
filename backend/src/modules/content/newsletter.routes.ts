import express from 'express';
import * as newsletterController from './newsletter.controller';

const router = express.Router();

/**
 * @swagger
 * /newsletter/subscribe:
 *   post:
 *     tags: [Content]
 *     summary: Join the newsletter
 *     description: >
 *       Records an email address against the community signup on the landing
 *       page. Signing up twice updates the existing record rather than failing.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *               consented: { type: boolean, description: Marketing consent as ticked on the form }
 *     responses:
 *       200: { description: Subscribed, content: { application/json: { schema: { $ref: '#/components/schemas/Success' } } } }
 *       400: { description: Invalid email, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
router.post('/subscribe', newsletterController.subscribe);

export default router;
