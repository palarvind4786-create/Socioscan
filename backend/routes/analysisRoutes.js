const express = require('express');
const router = express.Router();

// Placeholder for future analysis-only routes (e.g., batch processing)
router.get('/', (req, res) => {
    res.json({ message: 'Analysis routes active.' });
});

module.exports = router;
