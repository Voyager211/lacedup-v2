const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../../common/middlewares/auth.middleware');
const referralController = require('./referral.controller');

// GET /referrals - View referrals page
router.get('/', isAuthenticated, referralController.getReferralsPage);

module.exports = router;
