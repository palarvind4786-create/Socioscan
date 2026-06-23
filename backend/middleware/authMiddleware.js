const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
    let token;

    // Check for token in cookies first
    if (req.cookies && req.cookies.token) {
        token = req.cookies.token;
    } 
    // Fallback: Check for Bearer token in headers (useful for API testing tools)
    else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (token && token !== 'none') {
        try {
            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_for_dev_mode_only_123');

            // Get user from the token
            req.user = await User.findById(decoded.id).select('-password');
            
            if (!req.user) {
                console.warn(`Auth failure: User ID ${decoded.id} no longer exists.`);
                return res.status(401).json({ success: false, message: 'Not authorized, user not found' });
            }

            next();
        } catch (error) {
            console.error('JWT Verification Error:', error.message);
            return res.status(401).json({ success: false, message: 'Not authorized, session expired' });
        }
    } else {
        return res.status(401).json({ success: false, message: 'Not authorized, no valid session' });
    }
};

module.exports = { protect };
