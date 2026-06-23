const User = require('../models/User');
const jwt = require('jsonwebtoken');

/**
 * Generate a JWT token
 */
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET || 'fallback_secret_for_dev_mode_only_123', {
        expiresIn: '30d',
    });
};

/**
 * Helper to send token response in cookie
 */
const sendTokenResponse = (user, statusCode, res) => {
    const token = generateToken(user._id);

    const options = {
        expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        httpOnly: true, // Cannot be accessed by client script
        secure: process.env.NODE_ENV === 'production', // Use secure cookies in production (HTTPS)
        sameSite: 'strict', // Prevent CSRF
    };

    res.status(statusCode).cookie('token', token, options).json({
        success: true,
        data: { _id: user._id, name: user.name, email: user.email }
    });
};

/**
 * @route   POST /api/auth/register
 * @desc    Register initial admin (Used once for setup)
 */
const registerAdmin = async (req, res, next) => {
    try {
        const { name, email, password } = req.body;

        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ success: false, message: 'User already exists' });
        }
        const user = await User.create({ name, email, password });
        res.status(200).json({
            success:true,
            data:user
        })
    } catch (error) {
        next(error);
    }
};

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate admin & get token in cookie
 */
const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Please provide email and password' });
        }

        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const token=jwt.sign(
            {
                id:user._id,
                name:user.name,
                email:user.email
            },
            process.env.JWT_SECRET || 'fallback_secret_for_dev_mode_only_123',
            {
                expiresIn:'30d'
            }
        );

        const options={
            expires:new Date(Date.now()+30*24*60*60*1000),
            httpOnly:true,
            secure:process.env.NODE_ENV==='production',
            sameSite:'strict'
        }

        res.cookie("token",token,options).json({
            success: true,
            data: { _id: user._id, name: user.name, email: user.email }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @route   POST /api/auth/logout
 * @desc    Log out admin / clear cookie
 */
const logout = async (req, res, next) => {
    try {
        res.clearCookie('token', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
        });

        res.status(200).json({
            success: true,
            message: 'Logged out successfully',
            data: {}
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @route   GET /api/auth/me
 * @desc    Get current logged in user
 */
const getMe = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);
        res.status(200).json({ success: true, data: user });
    } catch (error) {
        next(error);
    }
};

module.exports = { registerAdmin, login, logout, getMe };
