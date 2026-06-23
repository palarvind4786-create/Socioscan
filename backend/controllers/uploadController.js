const Post = require('../models/Post');
const { analyzePost } = require('../services/analysisService');

/**
 * @route   POST /api/upload/dataset
 * @desc    Receive an array of posts, process them through AI, and save batch to DB
 * @access  Private (Admin Only)
 */
const uploadDataset = async (req, res, next) => {
    try {
        const { dataset } = req.body;

        if (!dataset || !Array.isArray(dataset) || dataset.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Please provide a valid array of posts under the "dataset" key.' 
            });
        }

        // Limit batch size to prevent Hugging Face API rate limits / timeouts
        if (dataset.length > 50) {
            return res.status(400).json({
                success: false,
                message: 'To prevent AI rate limits, please upload no more than 50 posts at a time.'
            });
        }

        // Process sequentially to be safe with the Hugging Face Free Tier
        const processedPosts = [];
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < dataset.length; i++) {
            const rawText = dataset[i].text || dataset[i];
            
            if (!rawText || typeof rawText !== 'string') {
                failCount++;
                continue;
            }

            try {
                // 1. Send through full AI Pipeline
                const analysisResult = await analyzePost(rawText);
                
                // 2. Prepare for DB
                processedPosts.push({
                    ...analysisResult,
                    source: dataset[i].source || 'dataset_upload'
                });
                
                successCount++;
                
                // Add a tiny delay between calls if needed to prevent 429 Too Many Requests
                if (dataset.length > 10) {
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
            } catch (err) {
                console.error(`Failed to process post at index ${i}:`, err.message);
                failCount++;
            }
        }

        // Save all successfully processed posts to MongoDB in a bulk insert
        let savedDocs = [];
        if (processedPosts.length > 0) {
            savedDocs = await Post.insertMany(processedPosts);
        }

        return res.status(201).json({
            success: true,
            message: `Dataset processed. Success: ${successCount}. Failed: ${failCount}.`,
            data: savedDocs
        });

    } catch (error) {
        next(error);
    }
};

module.exports = { uploadDataset };
