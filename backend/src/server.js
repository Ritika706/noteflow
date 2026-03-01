const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

dotenv.config();

const { connectDb } = require('./db');
const { authRouter } = require('./routes/auth.routes');
const { notesRouter } = require('./routes/notes.routes');
const { userRouter } = require('./routes/user.routes');
const { Note } = require('./models/Note');
const { User } = require('./models/User');
const mongoose = require('mongoose');
const { envBool, envString } = require('./lib/env');


const app = express();
// Enable trust proxy for correct client IP detection behind proxies
app.set('trust proxy', 1);

// Security: Set HTTP headers
app.use(helmet());

// Security: Rate limiting (100 requests per 15 min per IP)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

app.use((req, res, next) => {
  res.setTimeout(10 * 60 * 1000); // 10 minutes
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));



// Allow only the deployed frontend domain for CORS
// Allow all origins for CORS (for testing PDF iframe loading)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Disposition']
}));


// Public preview support

app.get('/health', async (req, res) => {
  const base = { ok: true };
  const includeDb = envBool('DEBUG_DB_INFO', false);
  if (!includeDb) return res.json(base);

  const conn = mongoose.connection;
  return res.json({
    ...base,
    db: {
      host: conn?.host || null,
      name: conn?.name || null,
      readyState: conn?.readyState,
    },
    build: {
      renderGitCommit: process.env.RENDER_GIT_COMMIT || null,
    },
  });
});



app.get('/api/stats', async (req, res) => {
  try {
    const [totalNotes, contributorsAgg, downloadsAgg] = await Promise.all([
      Note.countDocuments(),
      Note.aggregate([
        { $match: { uploadedBy: { $ne: null } } },
        { $group: { _id: '$uploadedBy' } },
        { $count: 'count' },
      ]),
      Note.aggregate([{ $group: { _id: null, total: { $sum: '$downloadCount' } } }]),
    ]);

    const contributors = Number(contributorsAgg?.[0]?.count || 0);
    const totalDownloads = Number(downloadsAgg?.[0]?.total || 0);
    return res.json({ totalNotes, contributors, totalDownloads });
  } catch (e) {
    console.error('[stats] error:', e);
    return res.status(500).json({ message: 'Failed to load stats' });
  }
});
app.use('/api/auth', authRouter);
app.use('/api/notes', notesRouter);
app.use('/api/me', userRouter);


// Centralized error handler
app.use((err, req, res, next) => {
  // Log error details
  if (err && err.status && err.status < 500) {
    // Client error
    console.warn('[Client error]', err.message || err);
  } else {
    // Server error
    console.error('[Server error]', err && err.stack ? err.stack : err);
  }

  // Determine status code
  const status = err.status || err.statusCode || 500;
  // Avoid leaking stack traces in production
  const isProd = process.env.NODE_ENV === 'production';
  const response = {
    message: err.message || 'Internal Server Error',
  };
  if (!isProd && err.stack) {
    response.stack = err.stack;
  }
  res.status(status).json(response);
});


// ===== START SERVER =====
const PORT = process.env.PORT || 5000;

connectDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ Database connection failed:', err);
    process.exit(1);
  });
