import express from 'express';
import * as salesReportController from './sales-report.controller';
import isAdmin from '../../common/middlewares/is-admin.middleware';

const router = express.Router();

// Every route below requires an admin session.
router.use(isAdmin);

/**
 * @swagger
 * /admin/sales-report:
 *   get:
 *     tags: [Admin]
 *     summary: Sales report
 *     security: [{ sessionCookie: [] }]
 *     parameters:
 *       - in: query
 *         name: period
 *         schema: { type: string, enum: [daily, weekly, monthly, yearly, custom] }
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *         description: Required when period is `custom`
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *     responses:
 *       200: { description: Sales report markup, content: { text/html: { schema: { type: string } } } }
 */
router.get('/', salesReportController.getSalesReport);

/**
 * @swagger
 * /admin/sales-report/export-pdf:
 *   get:
 *     tags: [Admin]
 *     summary: Export the sales report as a PDF
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
 *         description: The report PDF
 *         content:
 *           application/pdf:
 *             schema: { type: string, format: binary }
 */
router.get('/export-pdf', salesReportController.exportPDF);

/**
 * @swagger
 * /admin/sales-report/export-excel:
 *   get:
 *     tags: [Admin]
 *     summary: Export the sales report as an Excel workbook
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
 *         description: The report workbook
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema: { type: string, format: binary }
 */
router.get('/export-excel', salesReportController.exportExcel);

export = router;
