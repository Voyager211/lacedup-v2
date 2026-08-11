const express = require('express');
const router = express.Router();
const aboutController = require('./about.controller');

router.get('/', aboutController.getAbout);

module.exports = router;
