const Post = require('../models/Post');

/**
 * @route   GET /api/dashboard/stats
 * @desc    Get aggregate statistics for the admin dashboard
 */
const getDashboardStats = async (req, res, next) => {
    try {
        const [total, critical, high, medium, low, unresolved] = await Promise.all([
            Post.countDocuments(),
            Post.countDocuments({ severityLevel: 'Critical' }),
            Post.countDocuments({ severityLevel: 'High' }),
            Post.countDocuments({ severityLevel: 'Medium' }),
            Post.countDocuments({ severityLevel: 'Low' }),
            Post.countDocuments({ isResolved: false }),
        ]);
        //Promise.all() is a built-in JavaScript method used to run multiple asynchronous operations concurrently (at the same time) and wait until all of them have finished.

        // Topic breakdown
        const topicBreakdown = await Post.aggregate([
            { $group: { _id: '$primaryTopic', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
        ]);

        // Dominant emotion breakdown
        const emotionBreakdown = await Post.aggregate([
            { $group: { _id: '$dominantEmotion', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
        ]);

        return res.status(200).json({
            success: true,
            data: {
                total,
                bySeverity: { critical, high, medium, low },
                unresolved,
                topicBreakdown,
                emotionBreakdown,
            },
        });
    } catch (error) {
        next(error);
    }
};

module.exports = { getDashboardStats };
