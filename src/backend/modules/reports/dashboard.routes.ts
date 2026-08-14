import express from 'express';
import * as dashboardController from './dashboard.controller';
import isAdmin from '../../common/middlewares/is-admin.middleware';

const router = express.Router();

// Every route below requires an admin session.
router.use(isAdmin);


/**
 * @swagger
 * /admin/dashboard/api/stats:
 *   get:
 *     tags: [Admin]
 *     summary: Headline dashboard figures
 *     security: [{ sessionCookie: [] }]
 *     parameters:
 *       - in: query
 *         name: period
 *         schema: { type: string, enum: [daily, weekly, monthly, yearly], default: monthly }
 *     responses:
 *       200:
 *         description: Totals for the selected period
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalRevenue: { type: number }
 *                 totalOrders: { type: integer }
 *                 totalCustomers: { type: integer }
 *                 totalProducts: { type: integer }
 */
router.get('/api/stats', dashboardController.getDashboardStats);

/**
 * @swagger
 * /admin/dashboard/api/sales:
 *   get:
 *     tags: [Admin]
 *     summary: Sales series for the chart
 *     security: [{ sessionCookie: [] }]
 *     parameters:
 *       - in: query
 *         name: period
 *         schema: { type: string, enum: [daily, weekly, monthly, yearly], default: monthly }
 *     responses:
 *       200: { description: Time series of sales }
 */
router.get('/api/sales', dashboardController.getSalesData);

/**
 * @swagger
 * /admin/dashboard/api/revenue-distribution:
 *   get:
 *     tags: [Admin]
 *     summary: Revenue split by payment method
 *     security: [{ sessionCookie: [] }]
 *     responses:
 *       200: { description: Revenue per payment method }
 */
router.get('/api/revenue-distribution', dashboardController.getRevenueDistribution);

/**
 * @swagger
 * /admin/dashboard/api/best-selling-products:
 *   get:
 *     tags: [Admin]
 *     summary: Best selling products
 *     security: [{ sessionCookie: [] }]
 *     parameters:
 *       - in: query
 *         name: period
 *         schema: { type: string, default: monthly }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 5 }
 *     responses:
 *       200: { description: Ranked products }
 */
router.get('/api/best-selling-products', dashboardController.getBestSellingProducts);

/**
 * @swagger
 * /admin/dashboard/api/best-selling-categories:
 *   get:
 *     tags: [Admin]
 *     summary: Best selling categories (top 10)
 *     security: [{ sessionCookie: [] }]
 *     responses:
 *       200: { description: Ranked categories }
 */
router.get('/api/best-selling-categories', dashboardController.getBestSellingCategories);

/**
 * @swagger
 * /admin/dashboard/api/best-selling-brands:
 *   get:
 *     tags: [Admin]
 *     summary: Best selling brands (top 10)
 *     security: [{ sessionCookie: [] }]
 *     responses:
 *       200: { description: Ranked brands }
 */
router.get('/api/best-selling-brands', dashboardController.getBestSellingBrands);

/**
 * @swagger
 * /admin/dashboard/api/best-selling-category:
 *   get:
 *     tags: [Admin]
 *     summary: Top selling category (legacy)
 *     description: Kept for backwards compatibility - returns only the first entry of the list endpoint.
 *     deprecated: true
 *     security: [{ sessionCookie: [] }]
 *     responses:
 *       200: { description: The single top category }
 */
router.get('/api/best-selling-category', dashboardController.getBestSellingCategory);

/**
 * @swagger
 * /admin/dashboard/api/best-selling-brand:
 *   get:
 *     tags: [Admin]
 *     summary: Top selling brand (legacy)
 *     deprecated: true
 *     security: [{ sessionCookie: [] }]
 *     responses:
 *       200: { description: The single top brand }
 */
router.get('/api/best-selling-brand', dashboardController.getBestSellingBrand);

/**
 * @swagger
 * /admin/dashboard/ledger-report/export-pdf:
 *   get:
 *     tags: [Admin]
 *     summary: Export the ledger report as a PDF
 *     security: [{ sessionCookie: [] }]
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: The ledger PDF
 *         content:
 *           application/pdf:
 *             schema: { type: string, format: binary }
 */
router.get('/ledger-report/export-pdf', dashboardController.exportLedgerPDF);

export = router;
