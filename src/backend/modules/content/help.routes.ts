import express from 'express';
import * as helpController from './help.controller';

const router = express.Router();


/**
 * @swagger
 * /help/contact:
 *   post:
 *     tags: [Content]
 *     summary: Submit the contact form
 *     description: Sends the enquiry to the configured support mailbox.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, message]
 *             properties:
 *               name: { type: string }
 *               email: { type: string, format: email }
 *               subject: { type: string }
 *               message: { type: string }
 *     responses:
 *       200: { description: Enquiry submitted, content: { application/json: { schema: { $ref: '#/components/schemas/Success' } } } }
 *       400: { description: Validation failed, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
router.post('/contact', helpController.submitContactForm);

export = router;
