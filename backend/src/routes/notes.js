const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { Readable } = require('stream');
const { Note } = require('../models/Note');
const { User } = require('../models/User');
const { authRequired, authOptional } = require('../middleware/auth');
// Cloudinary removed
const { supabase } = require('../lib/supabase');
// PDF compression removed
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

const baseMulterOptions = {
  // Allow PDFs up to 50MB
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file?.mimetype || !allowedMimeTypes.has(file.mimetype)) {
      return cb(new Error('Only PDF, images, and Word docs allowed'));
    }
    return cb(null, true);
  },
};

const uploadDisk = multer({
  ...baseMulterOptions,
  storage,
});

// Faster on hosted envs: avoids writing temp files to ephemeral disk.
const uploadMemory = multer({
  ...baseMulterOptions,
  storage: multer.memoryStorage(),
});

// Public list + search/filter
router.get('/', async (req, res) => {
  try {
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
  } catch (e) {
    console.error('[notes:list] error:', e);
    return res.status(500).json({ message: 'Failed to load notes' });
  }
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
router.post(
  '/',
  authRequired,
  uploadDisk.single('file'),
  async (req, res) => {
  const { title, subject, semester, description = '' } = req.body || {};

  if (!title || !subject || !semester) {
    return res.status(400).json({ message: 'title, subject, semester are required' });
  }
  if (!req.file) {
    return res.status(400).json({ message: 'file is required' });
  }

  // Upload file to Supabase Storage
  let fileUrl = '';
  try {
    const bucket = process.env.SUPABASE_BUCKET;
    const fileExt = path.extname(req.file.originalname);
    const supabasePath = `${Date.now()}_${Math.round(Math.random() * 1e9)}${fileExt}`;
    const { data, error } = await supabase.storage.from(bucket).upload(supabasePath, req.file.buffer, {
      contentType: req.file.mimetype,
      upsert: false,
    });
    if (error) throw error;
    // Get public URL
    const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(supabasePath);
    fileUrl = publicUrlData.publicUrl;
    // Remove temp file if present
    if (req.file.path) {
      try { await fs.promises.unlink(req.file.path); } catch (e) {}
    }
  } catch (e) {
    return res.status(502).json({ message: 'Failed to upload file to Supabase Storage', error: String(e.message || e) });
  }

  const note = await Note.create({
    title: String(title),
    subject: String(subject),
    semester: String(semester),
    description: String(description || ''),
    filePath: req.file.filename || String(req.file.originalname || 'upload'),
    fileUrl,
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
    downloadCount: 0,
    uploadedBy: req.user.id,
  });

  return res.status(201).json({ note });
});

// Public preview - stream file for PDF preview in iframe
router.get('/:id/preview', async (req, res) => {
  try {
    const note = await Note.findById(req.params.id).select('fileUrl mimeType originalName').lean();
    if (!note) return res.status(404).json({ message: 'Note not found' });

    if (!note.fileUrl) {
      return res.status(404).json({ message: 'Preview not available - no file URL stored' });
    }

    // Always redirect to Supabase public URL for preview
    return res.redirect(note.fileUrl);
  } catch (e) {
    console.error('Preview error:', e.message);
    return res.status(502).json({ message: 'Failed to fetch file' });
  }
});

// Protected download + track
router.get('/:id/download', authRequired, async (req, res) => {
  const note = await Note.findById(req.params.id);
  if (!note) return res.status(404).json({ message: 'Note not found' });

  if (!note.fileUrl) {
    return res.status(404).json({ message: 'No file URL found for this note.' });
  }
  // Track download
  await Promise.all([
    User.updateOne(
      { _id: req.user.id },
      { $push: { downloads: { note: note._id, downloadedAt: new Date() } } }
    ),
    Note.updateOne({ _id: note._id }, { $inc: { downloadCount: 1 } }),
  ]);
  // Redirect to Supabase public URL
  return res.redirect(note.fileUrl);
});

// Protected: uploader can delete their own uploaded note/file
router.delete('/:id', authRequired, async (req, res) => {
  const note = await Note.findById(req.params.id).select(
    'uploadedBy filePath fileUrl'
  );
  if (!note) return res.status(404).json({ message: 'Note not found' });

  if (String(note.uploadedBy) !== String(req.user.id)) {
    return res.status(403).json({ message: 'You can only delete your own uploads' });
  }

  // Delete from Supabase Storage if fileUrl exists
  if (note.fileUrl) {
    try {
      const bucket = process.env.SUPABASE_BUCKET;
      // Extract path from public URL
      const url = new URL(note.fileUrl);
      const pathParts = url.pathname.split('/');
      const fileKey = pathParts.slice(3).join('/'); // /storage/v1/object/public/bucket/fileKey
      const { error } = await supabase.storage.from(bucket).remove([fileKey]);
      if (error) {
        console.error('[delete] supabase error:', error.message || error);
      }
    } catch (e) {
      console.error('[delete] supabase error:', e.message || e);
    }
  }

  await Promise.all([
    Note.deleteOne({ _id: note._id }),
    User.updateMany(
      {},
      {
        $pull: {
          bookmarks: note._id,
          downloads: { note: note._id },
        },
      }
    ),
  ]);

  return res.json({ deleted: true, id: String(note._id) });
});

router.use((err, req, res, next) => {
  // Multer errors (e.g. file too large)
  if (err && err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ message: 'File size too large. Please upload a file smaller than 10MB.' });
    }
    return res.status(400).json({ message: 'Upload failed. Please check your file and try again.' });
  }

  if (err?.message === 'Only PDF, images, and Word docs allowed') {
    return res.status(400).json({ message: err.message });
  }
  return next(err);
});

module.exports = { notesRouter: router };
