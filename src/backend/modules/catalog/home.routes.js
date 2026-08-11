const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../../common/middlewares/auth.middleware'); 
const homeController = require('./home.controller');

router.get('/home', isAuthenticated, homeController.getHome); 

module.exports = router;
