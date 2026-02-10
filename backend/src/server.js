const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const { connectDb } = require('./db');
const { authRouter } = require('./routes/auth');
const { notesRouter } = require('./routes/notes');
const { meRouter } = require('./routes/me');
const { Note } = require('./models/Note');
const { User } = require('./models/User');
const mongoose = require('mongoose');
const { envBool, envString } = require('./lib/env');

const app = express();

app.use((req, res, next) => {
  res.setTimeout(10 * 60 * 1000); // 10 minutes
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const corsOriginRaw = process.env.CORS_ORIGIN || 'http://localhost:5173';
const corsAllowList = corsOriginRaw
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function isCorsOriginAllowed(origin) {
  // Allow non-browser requests (no Origin header)
  if (!origin) return true;

  return corsAllowList.some((allowed) => {
    if (allowed === '*') return true;
    if (allowed.startsWith('*.')) {
      // e.g. '*.vercel.app' matches 'https://foo.vercel.app'
      return origin.endsWith(allowed.slice(1));
    }
    return origin === allowed;
  });
}

const corsOptions = {
  origin: (origin, callback) => {
    callback(null, isCorsOriginAllowed(origin));
  },
  credentials: true,
  exposedHeaders: ['Content-Disposition'],
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

// Public preview support
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

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
app.use('/api/me', meRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Internal server error' });
});

async function start() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is missing in environment');
  }

  await connectDb();
  const port = Number(process.env.PORT || 5000);
  app.listen(port, () => console.log(`✅ API listening on ${port}`));
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
