// OASI Portal — Express Backend Server
require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');

// Routes
const authRoutes       = require('./routes/auth');
const personnelRoutes  = require('./routes/personnel');
const attendanceRoutes = require('./routes/attendance');
const hierarchyRoutes  = require('./routes/hierarchy');
const adminRoutes      = require('./routes/admin');
const chitthaRoutes    = require('./routes/chittha');
const leavesRoutes     = require('./routes/leaves');
const reportsRoutes    = require('./routes/reports');
const deployRoutes     = require('./routes/deploy');

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Security ──
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    // Allow: no origin (curl/Postman), configured origin, localhost, and local network IPs
    const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:5173';
    const isLocalNetwork = !origin
      || origin === allowedOrigin
      || /^http:\/\/(localhost|127\.0\.0\.1)/.test(origin)
      || /^http:\/\/(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(origin);

    if (isLocalNetwork) {
      callback(null, true);
    } else {
      console.warn('[CORS] Blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));
app.use(express.json({ limit: '10mb' }));

// ── Rate Limiting ──
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000, max: 500,
  message: { error: 'Too many requests. Please try again later.' }
}));
app.use('/api/auth/login', rateLimit({
  windowMs: 15 * 60 * 1000, max: 15,
  message: { error: 'Too many login attempts. Try after 15 minutes.' }
}));

// ── Routes ──
app.use('/api/auth',       authRoutes);
app.use('/api/personnel',  personnelRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/hierarchy',  hierarchyRoutes);
app.use('/api/admin',      adminRoutes);
app.use('/api/chitthas',   chitthaRoutes);
app.use('/api/leaves',     leavesRoutes);
app.use('/api/reports',    reportsRoutes);
app.use('/api/deploy',     deployRoutes);

// ── Static: Uploaded Files (Grievance Attachments, etc.) ──
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Health Check ──
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', time: new Date().toISOString(), version: '1.0.0' });
});

// ── 404 Handler ──
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: `Route ${req.originalUrl} not found.` });
});

// ── Global Error Handler ──
app.use((err, req, res, next) => {
  console.error('[Server Error]', err.message);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error.'
      : err.message,
  });
});

// ── Start ──
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log('');
    console.log('  ╔══════════════════════════════════════╗');
    console.log('  ║  OASI Portal — Haryana Police API    ║');
    console.log(`  ║  Running on http://localhost:${PORT}    ║`);
    console.log('  ║  Health: /api/health                 ║');
    console.log('  ╚══════════════════════════════════════╝');
    console.log('');
  });
}

// Export for Vercel serverless
module.exports = app;
