import express from 'express';
import * as reviewController from './review.controller';

const router = express.Router();

/**
 * @swagger
 * /api/reviews:
 *   post:
 *     tags: [Reviews]
 *     summary: Submit a product review
 *     description: >
 *       Accepts up to five images alongside the review. One review per user per
 *       product is enforced by a unique index.
 *     security: [{ sessionCookie: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [product, rating, title, comment]
 *             properties:
 *               product: { type: string, description: Product id }
 *               rating: { type: integer, minimum: 1, maximum: 5 }
 *               title: { type: string, maxLength: 100 }
 *               comment: { type: string, maxLength: 1000 }
 *               images:
 *                 type: array
 *                 items: { type: string, format: binary }
 *                 description: Up to 5 images
 *     responses:
 *       201: { description: Review created, content: { application/json: { schema: { $ref: '#/components/schemas/Success' } } } }
 *       400: { description: Validation failed or too many images, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       409: { description: This user has already reviewed the product }
 */
router.post('/api/reviews', reviewController.uploadReviewImages, reviewController.submitReview);

/**
 * @swagger
 * /api/reviews/{productId}:
 *   get:
 *     tags: [Reviews]
 *     summary: List reviews for a product
 *     description: Public - no authentication required.
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *     responses:
 *       200:
 *         description: Reviews with the rating breakdown
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 reviews:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       rating: { type: integer }
 *                       title: { type: string }
 *                       comment: { type: string }
 *                       images: { type: array, items: { type: string } }
 *                       isVerifiedPurchase: { type: boolean }
 *                       createdAt: { type: string, format: date-time }
 *                 averageRating: { type: number, example: 4.2 }
 *                 totalReviews: { type: integer }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/api/reviews/:productId', reviewController.getProductReviews);

export = router;
