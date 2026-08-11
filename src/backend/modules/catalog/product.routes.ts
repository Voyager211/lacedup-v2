import express from 'express';
import multer from 'multer';
import * as productController from './product.controller';
import isAdmin from '../../common/middlewares/is-admin.middleware';

const router = express.Router();
const upload = multer();

// Every route below requires an admin session.
router.use(isAdmin);

/**
 * @swagger
 * /admin/products/api:
 *   get:
 *     tags: [Admin]
 *     summary: List products
 *     security: [{ sessionCookie: [] }]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *       - in: query
 *         name: brand
 *         schema: { type: string }
 *       - in: query
 *         name: sort
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: A page of products
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Pagination'
 *                 - type: object
 *                   properties:
 *                     products:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/Product' }
 */
router.get('/api', productController.apiProducts);

/**
 * @swagger
 * /admin/products/api/add:
 *   post:
 *     tags: [Admin]
 *     summary: Create a product
 *     description: >
 *       Base and variant SKUs are generated automatically from the brand code
 *       and product name. Every variant's basePrice must be below the product's
 *       regularPrice, which is enforced by a pre-save hook.
 *     security: [{ sessionCookie: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [productName, description, brand, category, regularPrice]
 *             properties:
 *               productName: { type: string }
 *               description: { type: string }
 *               brand: { type: string, description: Brand id }
 *               category: { type: string, description: Category id }
 *               regularPrice: { type: number }
 *               productOffer: { type: number, minimum: 0, maximum: 100 }
 *               features: { type: string }
 *               variants: { type: string, description: JSON array of variants }
 *               mainImage: { type: string, description: base64 data URL }
 *               subImages: { type: string, description: JSON array of base64 data URLs }
 *     responses:
 *       201: { description: Product created }
 *       400: { description: Validation failed, or a variant base price is not below the regular price }
 */
router.post('/api/add', upload.none(), productController.apiSubmitNewProduct);

/**
 * @swagger
 * /admin/products/api/{id}:
 *   patch:
 *     tags: [Admin]
 *     summary: Update a product
 *     security: [{ sessionCookie: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Product updated }
 *       400: { description: Validation failed }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.patch('/api/:id', upload.none(), productController.apiUpdateProduct);

/**
 * @swagger
 * /admin/products/api/{id}/delete:
 *   patch:
 *     tags: [Admin]
 *     summary: Soft-delete a product
 *     security: [{ sessionCookie: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Product marked deleted }
 */
router.patch('/api/:id/delete', productController.apiSoftDeleteProduct);

/**
 * @swagger
 * /admin/products/api/{id}/toggle:
 *   patch:
 *     tags: [Admin]
 *     summary: List or unlist a product
 *     security: [{ sessionCookie: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Listing status toggled }
 */
router.patch('/api/:id/toggle', productController.apiToggleProductStatus);

/**
 * @swagger
 * /admin/products/add:
 *   get:
 *     tags: [Admin]
 *     summary: Add product page
 *     security: [{ sessionCookie: [] }]
 *     responses:
 *       200: { description: Add product form, content: { text/html: { schema: { type: string } } } }
 */
router.get('/add', productController.renderAddPage);

/**
 * @swagger
 * /admin/products/{id}/edit:
 *   get:
 *     tags: [Admin]
 *     summary: Edit product page
 *     security: [{ sessionCookie: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Edit form, content: { text/html: { schema: { type: string } } } }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/:id/edit', productController.renderEditPage);

/**
 * @swagger
 * /admin/products/{id}:
 *   get:
 *     tags: [Admin]
 *     summary: Product detail page
 *     security: [{ sessionCookie: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Product detail markup, content: { text/html: { schema: { type: string } } } }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/:id', productController.renderDetailPage);

/**
 * @swagger
 * /admin/products:
 *   get:
 *     tags: [Admin]
 *     summary: Product management page
 *     security: [{ sessionCookie: [] }]
 *     responses:
 *       200: { description: Product list markup, content: { text/html: { schema: { type: string } } } }
 */
router.get('/', productController.listProducts);

export = router;
