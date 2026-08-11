const express = require('express');
const router = express.Router();
const couponController = require('./coupon.controller');

const requireAuth = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  
  // req.headers.accept is absent when no Accept header is sent, which turned
  // every unauthenticated hit into a 500 instead of a redirect to login.
  if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
    return res.status(401).json({
      success: false,
      message: 'You must be logged in to access this feature',
      code: 'AUTHENTICATION_REQUIRED'
    });
  }
  
  return res.redirect('/login');
};



router.get('/', requireAuth, (req, res) => {
    couponController.renderCouponsPage(req, res);
});

router.get('/available', (req, res) => {
    couponController.getAvailableCoupons(req, res);
});


module.exports = router;
