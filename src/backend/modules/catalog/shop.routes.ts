import express from 'express';
import * as shopController from './shop.controller';
import ensureVisible from '../../common/middlewares/ensure-visible.middleware';

const router = express.Router();

/**
 * @swagger
 * /shop:
 *   get:
 *     tags: [Shop]
 *     summary: Shop page
 *     description: >
 *       Renders the initial shop page. Filtering and pagination afterwards go
 *       through GET /api/shop.
 *     responses:
 *       200: { description: Shop page markup, content: { text/html: { schema: { type: string } } } }
 */
router.get('/shop', shopController.loadShopPage);

/**
 * @swagger
 * /api/shop:
 *   get:
 *     tags: [Shop]
 *     summary: Browse and filter products
 *     description: >
 *       Prices are computed per request from the current category, brand,
 *       product and variant offers - the largest of the four wins. Nothing is
 *       read from a stored final price.
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: Free-text search over product name
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [newest, price-asc, price-desc, name-asc, name-desc, popularity]
 *           default: newest
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *         description: Category id, or a comma-separated list
 *       - in: query
 *         name: brand
 *         schema: { type: string }
 *         description: Brand id, or a comma-separated list
 *       - in: query
 *         name: minPrice
 *         schema: { type: number }
 *       - in: query
 *         name: maxPrice
 *         schema: { type: number }
 *       - in: query
 *         name: size
 *         schema: { type: string }
 *         description: Size filter; repeat the parameter for several sizes
 *     responses:
 *       200:
 *         description: Matching products
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 products:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Product' }
 *                 pagination: { $ref: '#/components/schemas/Pagination' }
 *                 totalProductCount: { type: integer }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
router.get('/api/shop', shopController.getProducts);

/**
 * @swagger
 * /api/search-suggestions:
 *   get:
 *     tags: [Shop]
 *     summary: Type-ahead search suggestions
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Suggestions for the search dropdown
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 suggestions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       productName: { type: string }
 *                       slug: { type: string }
 *                       mainImage: { type: string }
 */
router.get('/api/search-suggestions', shopController.getSearchSuggestions);

/**
 * @swagger
 * /api/available-sizes:
 *   get:
 *     tags: [Shop]
 *     summary: Sizes available across the current filter
 *     description: Powers the size facet, so only sizes that are actually in stock are offered.
 *     parameters:
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *       - in: query
 *         name: brand
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Available sizes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sizes:
 *                   type: array
 *                   items: { type: string, example: 'UK 9' }
 */
router.get('/api/available-sizes', shopController.getAvailableSizes);

/**
 * @swagger
 * /product/{slug}:
 *   get:
 *     tags: [Shop]
 *     summary: Product details page
 *     description: >
 *       Returns 404 when the product is unlisted or soft-deleted, or when its
 *       category has been deactivated - enforced by the ensureVisible
 *       middleware before the handler runs.
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *         example: air-max-90
 *     responses:
 *       200: { description: Product page markup, content: { text/html: { schema: { type: string } } } }
 *       404: { description: Product unavailable, unlisted, or its category is disabled }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
router.get('/product/:slug', ensureVisible, shopController.loadProductDetails);

/**
 * @swagger
 * /api/product/{slug}:
 *   get:
 *     tags: [Shop]
 *     summary: Product details as JSON
 *     description: >
 *       The same data the product page renders - the product with populated
 *       category and brand, its reviews, related products, rating breakdown,
 *       the computed average final price, and whether the signed-in shopper
 *       has it in their wishlist. Both share one implementation, so the JSON
 *       and the page cannot show different prices.
 *
 *       Answers 404 with the reason when the product is withdrawn, unlisted,
 *       or its category or brand has been deactivated.
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *         example: air-max-90
 *     responses:
 *       200: { description: Product details }
 *       404: { description: Product unavailable, with a message explaining why }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
router.get('/api/product/:slug', shopController.getProductDetailsJSON);

/**
 * @swagger
 * /api/catalog/filters:
 *   get:
 *     tags: [Shop]
 *     summary: Filter options for the shop page
 *     description: >
 *       Active categories, active brands and the distinct sizes currently in
 *       stock. The EJS page received these as render locals, so no endpoint
 *       existed - all three come together because the filter panel needs them
 *       together.
 *     responses:
 *       200: { description: Categories, brands and sizes }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
router.get('/api/catalog/filters', shopController.getFilterOptions);

/**
 * @swagger
 * /api/home-sections:
 *   get:
 *     tags: [Shop]
 *     summary: Landing page sections
 *     description: >
 *       New arrivals, best sellers, active categories and active brands, using
 *       the same helpers the landing controller calls.
 *     responses:
 *       200: { description: Landing sections }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
router.get('/api/home-sections', shopController.getHomeSections);

export = router;
