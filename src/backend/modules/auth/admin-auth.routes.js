const express = require ('express');
const router = express.Router();
const nocache = require('../../common/middlewares/nocache.middleware');
const passport = require('passport');
const isAdmin = require('../../common/middlewares/is-admin.middleware');
const authController = require('./admin-auth.controller');
const dashboardController = require('../reports/dashboard.controller');


router.get('/login', nocache, authController.getLogin);
router.post('/login', authController.postLogin);

router.get('/dashboard', isAdmin, dashboardController.renderDashboard);
router.get('/logout', authController.logout);

module.exports = router;