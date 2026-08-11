const express = require('express');
const router = express.Router();
const nocache = require('../../common/middlewares/nocache.middleware');
const landingController = require('./landing.controller');

router.get('/', nocache, landingController.showLanding);

module.exports = router;
