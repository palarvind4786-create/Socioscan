const express = require('express');
const router = express.Router();
const { getDashboardStats } = require('../controllers/dashboardController');
const { protect } = require('../middleware/authMiddleware');
router.get('/stats', protect,getDashboardStats);    // GET aggregate dashboard stats

module.exports = router;
