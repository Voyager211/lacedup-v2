import express from 'express';
import * as aboutController from './about.controller';

const router = express.Router();

/**
 * @swagger
 * /about:
 *   get:
 *     tags: [Content]
 *     summary: About page
 *     description: Renders the About page. HTML only - there is no JSON variant.
 *     responses:
 *       200:
 *         description: About page markup
 *         content:
 *           text/html:
 *             schema: { type: string }
 */
router.get('/', aboutController.getAbout);

export = router;
