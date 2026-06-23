const express = require('express');
const router = express.Router();
const {
    analyzeAndSavePost,
    getAllPosts,
    getCriticalPosts,
    resolvePost,
} = require('../controllers/postController');
const { protect } = require('../middleware/authMiddleware');

router.post('/analyze', analyzeAndSavePost);    // Analyze & save a post
router.get('/',protect, getAllPosts);                    // Get all posts (filterable)
router.get('/critical',protect, getCriticalPosts);       // Get only CRITICAL posts
router.patch('/:id/resolve', protect, resolvePost);       // Mark post as resolved

module.exports = router;