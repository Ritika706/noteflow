const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { Readable } = require('stream');
const { Note } = require('../models/Note');
const { User } = require('../models/User');
const { authRequired, authOptional } = require('../middleware/auth');
const { uploadToCloudinary, isCloudinaryConfigured } = require('../lib/cloudinary');
const { compressPdfWithILovePdf, isILovePdfConfigured } = require('../lib/ilovepdfCompress');
const { envBool, envString } = require('../lib/env');

const router = express.Router();

const uploadsDir = path.join(__dirname, '..', '..', 'uploads');

// Ensure local uploads dir exists (used as a temp location before Cloudinary upload)
try {
  fs.mkdirSync(uploadsDir, { recursive: true });
} catch (e) {
  // If this fails, uploads will not work at all.
  // Let the request fail loudly rather than silently.
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const safeOriginal = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const unique = `${Date.now()}_${Math.round(Math.random() * 1e9)}_${safeOriginal}`;
    cb(null, unique);
  },
});

const allowedMimeTypes = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file?.mimetype || !allowedMimeTypes.has(file.mimetype)) {
      return cb(new Error('Only PDF, images, and Word docs allowed'));
    }
    return cb(null, true);
  },
});

// Public list + search/filter
router.get('/', async (req, res) => {
  const { q, subject, semester } = req.query;

  const filter = {};
  if (subject) filter.subject = String(subject);
  if (semester) filter.semester = String(semester);
  if (q) {
    const regex = new RegExp(String(q), 'i');
    filter.$or = [{ title: regex }, { subject: regex }, { semester: regex }];
  }

  const notes = await Note.find(filter)
    .sort({ createdAt: -1 })
    .select('title subject semester description mimeType originalName uploadedBy createdAt downloadCount likesCount ratingAvg ratingCount filePath fileUrl');

  return res.json({ notes });
});

// Public top-rated
router.get('/top-rated', async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit || 6), 1), 24);
  const notes = await Note.find({ ratingCount: { $gt: 0 } })
    .sort({ ratingAvg: -1, ratingCount: -1, createdAt: -1 })
    .limit(limit)
    .select('title subject semester description mimeType originalName uploadedBy createdAt downloadCount likesCount ratingAvg ratingCount filePath fileUrl');

  return res.json({ notes });
});

// Public details (with optional viewer flags)
router.get('/:id', authOptional, async (req, res) => {
  const note = await Note.findById(req.params.id)
    .populate('uploadedBy', 'name')
    .lean();

  if (!note) return res.status(404).json({ message: 'Note not found' });

  const viewer = { liked: false, bookmarked: false, rating: 0 };
  if (req.user?.id) {
    viewer.liked = Array.isArray(note.likedBy) ? note.likedBy.some((u) => String(u) === String(req.user.id)) : false;
    const myRating = Array.isArray(note.ratings)
      ? note.ratings.find((r) => String(r.user) === String(req.user.id))
      : null;
    viewer.rating = Number(myRating?.value || 0);

    const me = await User.findById(req.user.id).select('bookmarks').lean();
    viewer.bookmarked = Array.isArray(me?.bookmarks)
      ? me.bookmarks.some((n) => String(n) === String(note._id))
      : false;
  }

  // Don't leak internal arrays to clients
  delete note.likedBy;
  delete note.ratings;

  return res.json({ note, viewer });
});

// Protected: toggle like
router.post('/:id/like', authRequired, async (req, res) => {
  const note = await Note.findById(req.params.id).select('likedBy likesCount');
  if (!note) return res.status(404).json({ message: 'Note not found' });

  const userId = String(req.user.id);
  const already = (note.likedBy || []).some((u) => String(u) === userId);

  if (already) {
    await Note.updateOne(
      { _id: note._id },
      {
        $pull: { likedBy: req.user.id },
        $inc: { likesCount: -1 },
      }
    );
    return res.json({ liked: false });
  }

  await Note.updateOne(
    { _id: note._id },
    {
      $addToSet: { likedBy: req.user.id },
      $inc: { likesCount: 1 },
    }
  );
  return res.json({ liked: true });
});

// Protected: rate note (1-5)
router.post('/:id/rate', authRequired, async (req, res) => {
  const value = Number(req.body?.value);
  if (!Number.isFinite(value) || value < 1 || value > 5) {
    return res.status(400).json({ message: 'value must be between 1 and 5' });
  }

  const note = await Note.findById(req.params.id).select('ratings ratingAvg ratingCount');
  if (!note) return res.status(404).json({ message: 'Note not found' });

  const hasDownloaded = await User.exists({ _id: req.user.id, 'downloads.note': note._id });
  if (!hasDownloaded) {
    return res.status(403).json({ message: 'Download required to rate this note' });
  }

  const userId = String(req.user.id);
  const existing = (note.ratings || []).find((r) => String(r.user) === userId);

  if (existing) {
    existing.value = value;
  } else {
    note.ratings.push({ user: req.user.id, value });
  }

  const count = note.ratings.length;
  const sum = note.ratings.reduce((acc, r) => acc + Number(r.value || 0), 0);
  note.ratingCount = count;
  note.ratingAvg = count ? Math.round((sum / count) * 10) / 10 : 0;
  await note.save();

  return res.json({ rating: value, ratingAvg: note.ratingAvg, ratingCount: note.ratingCount });
});

// Protected upload
router.post('/', authRequired, upload.single('file'), async (req, res) => {
  const { title, subject, semester, description = '' } = req.body || {};

  if (!title || !subject || !semester) {
    return res.status(400).json({ message: 'title, subject, semester are required' });
  }
  if (!req.file) {
    return res.status(400).json({ message: 'file is required' });
  }

  const isHosted = Boolean(process.env.RENDER || process.env.RENDER_GIT_COMMIT || process.env.VERCEL);
  const isProd = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
  // On hosted environments (Render/Vercel) local disk is not reliable. Default to requiring Cloudinary.
  const requireCloudinary = envBool('REQUIRE_CLOUDINARY', isHosted || isProd);
  if (requireCloudinary && !isCloudinaryConfigured()) {
    return res.status(503).json({
      message:
        'Storage is not configured. Please set Cloudinary env variables on the server (CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET) before uploading.',
    });
  }

  let fileUrl = '';
  if (isCloudinaryConfigured()) {
    const debugTiming = envBool('DEBUG_UPLOAD_TIMING', false);
    const startedAt = Date.now();
    const cleanupPaths = new Set([req.file.path]);

    try {
      let uploadPath = req.file.path;
      let compressMs = 0;
      let cloudinaryMs = 0;

      const MAX_PDF_BYTES = 10 * 1024 * 1024;
      const isPdf = String(req.file.mimetype || '').toLowerCase().includes('pdf');

      // If PDF > 10MB, compress via iLovePDF before uploading.
      if (isPdf && req.file.size > MAX_PDF_BYTES) {
        if (!isILovePdfConfigured()) {
          return res.status(503).json({
            message:
              'PDF compression service is not configured. Please set ILOVEPDF_PUBLIC_KEY and ILOVEPDF_SECRET_KEY on the server.',
          });
        }

        const c0 = Date.now();
        const compressed = await compressPdfWithILovePdf(req.file.path, {
          compressionLevel: envString('ILOVEPDF_COMPRESSION_LEVEL', 'recommended'),
        });
        compressMs = Date.now() - c0;
        uploadPath = compressed.path;
        cleanupPaths.add(compressed.path);

        if (compressed.size > MAX_PDF_BYTES) {
          return res.status(413).json({ message: 'File size too large' });
        }
      }

      const u0 = Date.now();
      const uploadStat = await fs.promises.stat(uploadPath);
      const uploadSize = Number(uploadStat.size || 0);
      // Prefer chunked upload for larger files (especially raw/PDF). This doesn't bypass Cloudinary plan limits,
      // but avoids failures due to single-request size constraints.
      const LARGE_UPLOAD_THRESHOLD = 9 * 1024 * 1024; // ~9MB
      const isImage = String(req.file.mimetype || '').startsWith('image/');
      const forceLargeUpload = !isImage ? uploadSize >= LARGE_UPLOAD_THRESHOLD : false;
      
      console.log(`[upload] starting cloudinary upload: path=${uploadPath} size=${uploadSize}B mime=${req.file.mimetype} forceLarge=${forceLargeUpload}`);
      
      const uploaded = await uploadToCloudinary(uploadPath, {
        folder: envString('CLOUDINARY_FOLDER', 'noteflow'),
        resourceType: String(req.file.mimetype || '').startsWith('image/') ? 'image' : 'raw',
        forceLargeUpload,
      });
      cloudinaryMs = Date.now() - u0;
      fileUrl = uploaded?.url || '';

      // If Cloudinary is configured and we attempted an upload, do not create a note without a URL.
      if (!fileUrl) {
        return res.status(502).json({ message: 'Failed to upload file to storage. Please try again.' });
      }

      if (debugTiming) {
        const totalMs = Date.now() - startedAt;
        console.log(
          `[upload] requireCloudinary=${requireCloudinary} configured=true mime=${req.file.mimetype} size=${req.file.size}B uploadSize=${uploadSize}B compressMs=${compressMs} cloudinaryMs=${cloudinaryMs} totalMs=${totalMs}`
        );
      }
    } catch (e) {
      const msg = String(
        e?.error?.message || e?.message || ''
      );
      const lower = msg.toLowerCase();

      if (
        lower.includes('file size too large') ||
        lower.includes('too large to upload') ||
        lower.includes('maximum upload size') ||
        (lower.includes('too large') && (lower.includes('file') || lower.includes('upload') || lower.includes('size')))
      ) {
        return res.status(413).json({
          message:
            'File is too large for storage. Please upload a smaller file, or upgrade your Cloudinary plan / increase limits. If this is a PDF, try compressing it locally before upload.',
        });
      }

      if (debugTiming) {
        console.log('[upload] failed:', msg || e);
      }

      // Always log the root message on server (helps on Render even when debugTiming is off)
      console.error('[upload] FULL ERROR:', e);
      if (msg) {
        console.error('[upload] cloudinary error:', msg);
      } else {
        console.error('[upload] cloudinary error (no message)');
      }
      // If Cloudinary fails, do NOT silently fall back to local in production.
      // Local uploads on Render can disappear after redeploy/restart.
      const truncated = msg && msg.length > 300 ? `${msg.slice(0, 300)}…` : msg;
      return res.status(502).json({
        message: truncated
          ? `Failed to upload file to storage: ${truncated}`
          : 'Failed to upload file to storage. Please try again.',
      });
    } finally {
      try {
        await Promise.all(
          Array.from(cleanupPaths).map(async (p) => {
            try {
              await fs.promises.unlink(p);
            } catch (e) {
              // ignore
            }
          })
        );
      } catch (e) {
        // ignore
      }
    }
  }

  const note = await Note.create({
    title: String(title),
    subject: String(subject),
    semester: String(semester),
    description: String(description || ''),
    filePath: req.file.filename,
    fileUrl,
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
    downloadCount: 0,
    uploadedBy: req.user.id,
  });

  return res.status(201).json({ note });
});

// Protected download + track
router.get('/:id/download', authRequired, async (req, res) => {
  const note = await Note.findById(req.params.id);
  if (!note) return res.status(404).json({ message: 'Note not found' });

  if (note.fileUrl) {
    try {
      const upstream = await fetch(note.fileUrl);
      if (!upstream.ok) {
        return res.status(502).json({ message: 'Failed to fetch file from storage' });
      }

      // Track download only if the file is available
      await Promise.all([
        User.updateOne(
          { _id: req.user.id },
          { $push: { downloads: { note: note._id, downloadedAt: new Date() } } }
        ),
        Note.updateOne({ _id: note._id }, { $inc: { downloadCount: 1 } }),
      ]);

      const contentType = upstream.headers.get('content-type') || note.mimeType || 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(note.originalName)}"`);

      if (!upstream.body) {
        return res.status(502).json({ message: 'File stream unavailable' });
      }

      Readable.fromWeb(upstream.body).pipe(res);
      return;
    } catch (e) {
      return res.status(502).json({ message: 'Failed to fetch file from storage' });
    }
  }

  const absolutePath = path.join(uploadsDir, note.filePath);
  try {
    await fs.promises.access(absolutePath, fs.constants.R_OK);
  } catch (e) {
    return res.status(404).json({
      message:
        'File not found on server. This can happen after redeploy. Please re-upload this note to restore the file.',
    });
  }

  // Track download only if the file exists
  await Promise.all([
    User.updateOne(
      { _id: req.user.id },
      { $push: { downloads: { note: note._id, downloadedAt: new Date() } } }
    ),
    Note.updateOne({ _id: note._id }, { $inc: { downloadCount: 1 } }),
  ]);

  return res.download(absolutePath, note.originalName);
});

router.use((err, req, res, next) => {
  if (err?.message === 'Only PDF, images, and Word docs allowed') {
    return res.status(400).json({ message: err.message });
  }
  return next(err);
});

module.exports = { notesRouter: router };
