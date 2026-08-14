import express from 'express';
import * as brandController from './brand.controller';
import isAdmin from '../../common/middlewares/is-admin.middleware';

const router = express.Router();

// Every route below requires an admin session.
router.use(isAdmin);


/**
 * @swagger
 * /admin/brands/api:
 *   get:
 *     tags: [Admin]
 *     summary: List brands
 *     security: [{ sessionCookie: [] }]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [all, active, inactive] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *     responses:
 *       200: { description: A page of brands }
 */
router.get('/api', brandController.apiBrands);

/**
 * @swagger
 * /admin/brands/api/{id}:
 *   get:
 *     tags: [Admin]
 *     summary: Fetch one brand
 *     security: [{ sessionCookie: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: The brand }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   put:
 *     tags: [Admin]
 *     summary: Update a brand
 *     description: >
 *       Changing brandOffer triggers a price recalculation across every product
 *       of that brand, since prices are derived from the largest active offer.
 *     security: [{ sessionCookie: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               brandOffer: { type: number, minimum: 0, maximum: 100 }
 *               image: { type: string, description: base64 data URL }
 *     responses:
 *       200: { description: Brand updated }
 *       400: { description: Validation failed }
 *   delete:
 *     tags: [Admin]
 *     summary: Soft-delete a brand
 *     security: [{ sessionCookie: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Brand marked deleted }
 */
router.get('/api/:id', brandController.apiGetBrand);

/**
 * @swagger
 * /admin/brands/api/create:
 *   post:
 *     tags: [Admin]
 *     summary: Create a brand
 *     security: [{ sessionCookie: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               brandOffer: { type: number, minimum: 0, maximum: 100 }
 *               image: { type: string, description: base64 data URL }
 *     responses:
 *       201: { description: Brand created }
 *       400: { description: Validation failed or the name is already taken }
 */
router.post('/api/create', brandController.apiCreateBrand);

router.put('/api/:id', brandController.apiUpdateBrand);

/**
 * @swagger
 * /admin/brands/api/{id}/toggle:
 *   patch:
 *     tags: [Admin]
 *     summary: Activate or deactivate a brand
 *     description: Deactivating hides every product of that brand from the storefront.
 *     security: [{ sessionCookie: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Status toggled }
 */
router.patch('/api/:id/toggle', brandController.apiToggleStatus);

router.delete('/api/:id', brandController.apiSoftDeleteBrand);

export = router;
