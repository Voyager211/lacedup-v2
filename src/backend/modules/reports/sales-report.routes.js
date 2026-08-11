const express = require('express');
const router = express.Router();
const salesReportController = require('./sales-report.controller');
const isAdmin = require('../../common/middlewares/is-admin.middleware');

router.use(isAdmin);

// ===== SALES REPORT =====
router.get('/', salesReportController.getSalesReport);
router.get('/export-pdf', salesReportController.exportPDF);
router.get('/export-excel', salesReportController.exportExcel);

module.exports = router; 