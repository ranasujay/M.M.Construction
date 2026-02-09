const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const connectDB = require('./config/db');
const config = require('./config');
const { errorHandler } = require('./middleware/errorHandler');

// Route imports
const authRoutes = require('./routes/authRoutes');
const customerRoutes = require('./routes/customerRoutes');
const productRoutes = require('./routes/productRoutes');
const billRoutes = require('./routes/billRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const promiseRoutes = require('./routes/promiseRoutes');
const activityLogRoutes = require('./routes/activityLogRoutes');
const reportRoutes = require('./routes/reportRoutes');
const workerRoutes = require('./routes/workerRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const advanceRoutes = require('./routes/advanceRoutes');
const salaryRoutes = require('./routes/salaryRoutes');

const app = express();

// ─── Connect Database ────────────────────────────────────────────────
connectDB();

// ─── Global Middleware ───────────────────────────────────────────────
app.use(cors({
  origin: config.nodeEnv === 'production' 
    ? ['https://m-m-construction.vercel.app']
    : '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

if (config.nodeEnv === 'development') {
  app.use(morgan('dev'));
}

// ─── API Routes ──────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/products', productRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/promises', promiseRoutes);
app.use('/api/activity-logs', activityLogRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/advances/worker', advanceRoutes);
app.use('/api/salary', salaryRoutes);

// ─── Health Check ────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'M.M. Construction API is running', timestamp: new Date() });
});

// ─── 404 Handler ─────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// ─── Global Error Handler ────────────────────────────────────────────
app.use(errorHandler);

// ─── Start Server ────────────────────────────────────────────────────
const PORT = config.port;
app.listen(PORT, () => {
  console.log(`\n🏗️  M.M. Construction API Server`);
  console.log(`📡 Running on port ${PORT}`);
  console.log(`🌍 Environment: ${config.nodeEnv}`);
  console.log(`─────────────────────────────────\n`);
});

module.exports = app;
