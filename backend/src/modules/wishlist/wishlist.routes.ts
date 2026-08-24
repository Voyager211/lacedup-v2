import express from 'express';
import * as wishlistController from './wishlist.controller';
import { ensureAuthenticated } from '../../common/middlewares/user-context.middleware';

const router = express.Router();

/**
 * @swagger
 * /wishlist:
 *   get:
 *     tags: [Wishlist]
 *     summary: Get the current user's wishlist
 *     description: >
 *       Returns the wishlist with each product's price recomputed from the
 *       current category, brand, product and variant offers.
 *     security: [{ sessionCookie: [] }]
 *     responses:
 *       200:
 *         description: The user's wishlist
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 products:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Product' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/', ensureAuthenticated, wishlistController.getWishlist);

/**
 * @swagger
 * /wishlist/add:
 *   post:
 *     tags: [Wishlist]
 *     summary: Add a product to the wishlist
 *     security: [{ sessionCookie: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productId]
 *             properties:
 *               productId: { type: string }
 *     responses:
 *       200: { description: Product added, content: { application/json: { schema: { $ref: '#/components/schemas/Success' } } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.post('/add', ensureAuthenticated, wishlistController.addToWishlist);

/**
 * @swagger
 * /wishlist/remove/{productId}:
 *   delete:
 *     tags: [Wishlist]
 *     summary: Remove a product from the wishlist
 *     security: [{ sessionCookie: [] }]
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Product removed, content: { application/json: { schema: { $ref: '#/components/schemas/Success' } } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.delete('/remove/:productId', ensureAuthenticated, wishlistController.removeFromWishlist);

/**
 * @swagger
 * /wishlist/search:
 *   get:
 *     tags: [Wishlist]
 *     summary: Search within the wishlist
 *     security: [{ sessionCookie: [] }]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: Search term matched against product name
 *     responses:
 *       200:
 *         description: Matching wishlist products
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 products:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Product' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/search', ensureAuthenticated, wishlistController.searchWishlist);

export = router;
