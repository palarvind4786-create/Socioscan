const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const postRoutes = require('./routes/postRoutes');
const analysisRoutes = require('./routes/analysisRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const authRoutes = require('./routes/authRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// ── Middleware ──────────────────────────────────────────────
app.use(helmet());
app.use(cors({
    origin: 'http://localhost:5173', // Updated for Vite-React Frontend
    credentials: true // Crucial for accepting cookies from frontend
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(cookieParser());

// ── Routes ──────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/dashboard', dashboardRoutes);

// ── Health Check ─────────────────────────────────────────────
app.get('/', (req, res) => {
    res.json({ message: 'Social Issue Detection API is running ✅' });
});

// ── Error Handler ─────────────────────────────────────────────
app.use(errorHandler);

// ── Database Connection & Server Start ───────────────────────
const PORT = process.env.PORT || 5000;

mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
        console.log('✅ MongoDB Connected Successfully');
        app.listen(PORT, () => {
            console.log(`🚀 Server running on http://localhost:${PORT}`);
        });
    })
    .catch((err) => {
        console.error('❌ MongoDB Connection Failed:', err.message);
        process.exit(1);
    });
