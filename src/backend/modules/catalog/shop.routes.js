const express = require('express');
const router = express.Router();
const shopController = require('./shop.controller');
const ensureVisible = require('../../common/middlewares/ensure-visible.middleware');


// Shop page route (renders the initial page)
router.get('/shop', shopController.loadShopPage);

// API route for filtering/searching products (AJAX calls)
router.get('/api/shop', shopController.getProducts);

// API route for search suggestions dropdown
router.get('/api/search-suggestions', shopController.getSearchSuggestions);

// API route for available sizes
router.get('/api/available-sizes', shopController.getAvailableSizes);

// Product-details page
router.get('/product/:slug', ensureVisible, shopController.loadProductDetails);


module.exports = router;