const Post = require('../models/Post');
const { analyzePost } = require('../services/analysisService');

/**
 * @route   POST /api/posts/analyze
 * @desc    Analyze a single post text and save result to DB
 */
const analyzeAndSavePost = async (req, res, next) => {
    try {
        const { text, source } = req.body;

        if (!text || text.trim() === '') {
            return res.status(400).json({ success: false, message: 'Post text is required.' });
        }

        // Run the full AI pipeline
        const analysisResult = await analyzePost(text);

        // Save to MongoDB
        const post = new Post({ ...analysisResult, source: source || 'manual_upload' });
        await post.save();

        return res.status(201).json({
            success: true,
            message: 'Post analyzed and saved successfully.',
            data: post,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @route   GET /api/posts
 * @desc    Get all posts (with optional severity filter)
 */
const getAllPosts = async (req, res, next) => {
    try {
        const { severity, topic, limit = 50 } = req.query;
        const filter = {};
        if (severity) filter.severityLevel = severity;
        if (topic) filter.primaryTopic = topic;

        const posts = await Post.find(filter)
            .sort({ severityScore: -1, createdAt: -1 })
            .limit(parseInt(limit));

        return res.status(200).json({ success: true, count: posts.length, data: posts });
    } catch (error) {
        next(error);
    }
};

/**
 * @route   GET /api/posts/critical
 * @desc    Get all CRITICAL severity posts only
 */
const getCriticalPosts = async (req, res, next) => {
    try {
        const posts = await Post.find({ severityLevel: 'Critical' }).sort({ createdAt: -1 });
        return res.status(200).json({ success: true, count: posts.length, data: posts });
    } catch (error) {
        next(error);
    }
};

/**
 * @route   PATCH /api/posts/:id/resolve
 * @desc    Mark a post as resolved by admin
 */
const resolvePost = async (req, res, next) => {
    try {
        const { adminNotes } = req.body;
        const post = await Post.findByIdAndUpdate(
            req.params.id,
            { isResolved: true, reviewedByAdmin: true, adminNotes },
            { new: true }
        );
        if (!post) return res.status(404).json({ success: false, message: 'Post not found.' });

        return res.status(200).json({ success: true, message: 'Post resolved.', data: post });
    } catch (error) {
        next(error);
    }
};

module.exports = { analyzeAndSavePost, getAllPosts, getCriticalPosts, resolvePost };
