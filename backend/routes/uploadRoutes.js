const express = require('express');
const router = express.Router();
const { uploadDataset } = require('../controllers/uploadController');
const { protect } = require('../middleware/authMiddleware');

router.post('/dataset', protect, uploadDataset);

module.exports = router;
