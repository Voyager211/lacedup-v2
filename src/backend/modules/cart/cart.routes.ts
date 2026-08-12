import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import * as cartController from './cart.controller';
import { wantsJson } from '../../common/utils/wants-json.util';

const router = express.Router();

/**
 * Page-level guard: redirects browsers, but answers JSON to API clients.
 *
 * The /api mount counts as an API client regardless of headers - a request
 * that arrived under /api wanted the API, and answering it with a 302 to an
 * HTML login page gives an XHR caller nothing it can act on.
 *
 * req.headers.accept is absent when no Accept header is sent, which used to
 * turn every unauthenticated /cart hit into a 500 rather than a redirect.
 */
const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated()) {
    return next();
  }

  if (wantsJson(req)) {
    return res.status(401).json({
      success: false,
      message: 'You must be logged in to access this feature',
      code: 'AUTHENTICATION_REQUIRED'
    });
  }

  return res.redirect('/login');
};

/** API guard: always answers JSON, never redirects. */
const requireAuthAPI = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated()) {
    return next();
  }

  return res.status(401).json({
    success: false,
    message: 'You must be logged in to access this feature',
    code: 'AUTHENTICATION_REQUIRED'
  });
};

/**
 * @swagger
 * /cart:
 *   get:
 *     tags: [Cart]
 *     summary: Cart page
 *     description: >
 *       Renders the cart with every item revalidated against current stock,
 *       listing status and category/brand availability.
 *     security: [{ sessionCookie: [] }]
 *     responses:
 *       200: { description: Cart page markup, content: { text/html: { schema: { type: string } } } }
 *       302: { description: Redirected to /login when not signed in }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/', requireAuth, cartController.loadCart);

/**
 * @swagger
 * /cart/add:
 *   post:
 *     tags: [Cart]
 *     summary: Add an item to the cart
 *     security: [{ sessionCookie: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productId, variantId]
 *             properties:
 *               productId: { type: string }
 *               variantId: { type: string, description: Id of the size variant }
 *               quantity: { type: integer, default: 1 }
 *     responses:
 *       200: { description: Item added, content: { application/json: { schema: { $ref: '#/components/schemas/Success' } } } }
 *       400: { description: Out of stock or quantity exceeds available stock, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.post('/add', requireAuthAPI, cartController.addToCart);

/**
 * @swagger
 * /cart/update:
 *   post:
 *     tags: [Cart]
 *     summary: Change the quantity of a cart item
 *     security: [{ sessionCookie: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productId, variantId, quantity]
 *             properties:
 *               productId: { type: string }
 *               variantId: { type: string }
 *               quantity: { type: integer, minimum: 1 }
 *     responses:
 *       200: { description: Quantity updated with recalculated totals }
 *       400: { description: Requested quantity exceeds stock }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.post('/update', requireAuthAPI, cartController.updateCartQuantity);

/**
 * @swagger
 * /cart/remove:
 *   post:
 *     tags: [Cart]
 *     summary: Remove an item from the cart
 *     security: [{ sessionCookie: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productId, variantId]
 *             properties:
 *               productId: { type: string }
 *               variantId: { type: string }
 *     responses:
 *       200: { description: Item removed, content: { application/json: { schema: { $ref: '#/components/schemas/Success' } } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.post('/remove', requireAuthAPI, cartController.removeFromCart);

/**
 * @swagger
 * /cart/clear:
 *   post:
 *     tags: [Cart]
 *     summary: Empty the cart
 *     security: [{ sessionCookie: [] }]
 *     responses:
 *       200: { description: Cart cleared, content: { application/json: { schema: { $ref: '#/components/schemas/Success' } } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.post('/clear', requireAuthAPI, cartController.clearCart);

/**
 * @swagger
 * /cart/remove-out-of-stock:
 *   post:
 *     tags: [Cart]
 *     summary: Drop every out-of-stock item from the cart
 *     security: [{ sessionCookie: [] }]
 *     responses:
 *       200:
 *         description: Removed items, with the count
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 removedCount: { type: integer }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.post('/remove-out-of-stock', requireAuthAPI, cartController.removeOutOfStockItems);

/**
 * @swagger
 * /cart/save-for-later:
 *   post:
 *     tags: [Cart]
 *     summary: Move a cart item to the wishlist
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
 *               variantId: { type: string }
 *     responses:
 *       200: { description: Moved to wishlist, content: { application/json: { schema: { $ref: '#/components/schemas/Success' } } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.post('/save-for-later', requireAuthAPI, cartController.saveForLater);

/**
 * @swagger
 * /cart/count:
 *   get:
 *     tags: [Cart]
 *     summary: Number of items in the cart
 *     description: >
 *       Deliberately unauthenticated - the header badge calls this on every
 *       page, and it returns 0 for guests rather than erroring.
 *     responses:
 *       200:
 *         description: Item count
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count: { type: integer, example: 3 }
 */
router.get('/count', cartController.getCartCount);

/**
 * @swagger
 * /cart/validate-stock:
 *   get:
 *     tags: [Cart]
 *     summary: Revalidate every cart item against current stock
 *     description: Called before checkout to surface items that are no longer purchasable.
 *     security: [{ sessionCookie: [] }]
 *     responses:
 *       200:
 *         description: Validation result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 invalidItems:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       productName: { type: string }
 *                       size: { type: string }
 *                       reason: { type: string }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/validate-stock', requireAuthAPI, cartController.validateCartStock);

/**
 * @swagger
 * /cart/reset-quantity:
 *   post:
 *     tags: [Cart]
 *     summary: Clamp a cart item's quantity to the available stock
 *     security: [{ sessionCookie: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productId, variantId]
 *             properties:
 *               productId: { type: string }
 *               variantId: { type: string }
 *     responses:
 *       200: { description: Quantity reset to the available stock }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.post('/reset-quantity', requireAuthAPI, cartController.resetCartItemQuantity);

/**
 * @swagger
 * /cart/checkout:
 *   get:
 *     tags: [Cart]
 *     summary: Redirect to checkout
 *     description: Convenience redirect kept for older links in the EJS views.
 *     responses:
 *       302: { description: Redirected to /checkout }
 */
router.get('/checkout', (_req: Request, res: Response) => res.redirect('/checkout'));

export = router;
