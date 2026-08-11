const express = require('express');
const router = express.Router();
const helpController = require('./help.controller');

// GET Help Page
router.get('/', helpController.getHelpPage);

// POST Contact Form
router.post('/contact', helpController.submitContactForm);

module.exports = router;
