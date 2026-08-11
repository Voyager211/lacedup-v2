import express from 'express';
import * as categoryController from './category.controller';
import isAdmin from '../../common/middlewares/is-admin.middleware';

const router = express.Router();

// Every route below requires an admin session.
router.use(isAdmin);

/**
 * @swagger
 * /admin/categories:
 *   get:
 *     tags: [Admin]
 *     summary: Category management page
 *     security: [{ sessionCookie: [] }]
 *     responses:
 *       200: { description: Category list markup, content: { text/html: { schema: { type: string } } } }
 */
router.get('/', categoryController.listCategories);

/**
 * @swagger
 * /admin/categories/api:
 *   get:
 *     tags: [Admin]
 *     summary: List categories
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
 *       200: { description: A page of categories }
 */
router.get('/api', categoryController.apiCategories);

/**
 * @swagger
 * /admin/categories/api/{id}:
 *   get:
 *     tags: [Admin]
 *     summary: Fetch one category
 *     security: [{ sessionCookie: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: The category }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   put:
 *     tags: [Admin]
 *     summary: Update a category
 *     description: >
 *       Changing categoryOffer recalculates prices for every product in the
 *       category, since the largest of the category, brand, product and variant
 *       offers wins.
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
 *               categoryOffer: { type: number, minimum: 0, maximum: 100 }
 *               image: { type: string, description: base64 data URL }
 *     responses:
 *       200: { description: Category updated }
 *   delete:
 *     tags: [Admin]
 *     summary: Soft-delete a category
 *     security: [{ sessionCookie: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Category marked deleted }
 */
router.get('/api/:id', categoryController.apiGetCategory);

/**
 * @swagger
 * /admin/categories/api/create:
 *   post:
 *     tags: [Admin]
 *     summary: Create a category
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
 *               categoryOffer: { type: number, minimum: 0, maximum: 100 }
 *               image: { type: string }
 *     responses:
 *       201: { description: Category created }
 *       400: { description: Validation failed or the name is already taken }
 */
router.post('/api/create', categoryController.apiCreateCategory);

router.put('/api/:id', categoryController.apiUpdateCategory);

/**
 * @swagger
 * /admin/categories/api/{id}/toggle:
 *   patch:
 *     tags: [Admin]
 *     summary: Activate or deactivate a category
 *     description: >
 *       Deactivating hides every product in the category from the storefront and
 *       makes their product pages return 404.
 *     security: [{ sessionCookie: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Status toggled }
 */
router.patch('/api/:id/toggle', categoryController.apiToggleStatus);

router.delete('/api/:id', categoryController.apiSoftDeleteCategory);

export = router;
