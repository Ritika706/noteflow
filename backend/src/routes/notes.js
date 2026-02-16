const express = require('express');

const { Note } = require('../models/Note');
const { User } = require('../models/User');
const { authRequired, authOptional } = require('../middleware/auth');
const { supabase } = require('../lib/supabase');
const { envBool, envString } = require('../lib/env');
const Joi = require('joi');

const router = express.Router();




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
    e.status = 500;
    e.message = 'Failed to load notes';
    return next(e);
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

  try {
    const note = await Note.findById(req.params.id)
      .populate('uploadedBy', 'name')
      .lean();
    if (!note) {
      const err = new Error('Note not found');
      err.status = 404;
      throw err;
    }

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
  } catch (e) {
    return next(e);
  }
});

// Protected: toggle like
router.post('/:id/like', authRequired, async (req, res) => {

  try {
    const note = await Note.findById(req.params.id).select('likedBy likesCount');
    if (!note) {
      const err = new Error('Note not found');
      err.status = 404;
      throw err;
    }

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
  } catch (e) {
    return next(e);
  }
});

// Protected: rate note (1-5)
router.post('/:id/rate', authRequired, async (req, res) => {
  try {
    const value = Number(req.body?.value);
    if (!Number.isFinite(value) || value < 1 || value > 5) {
      const err = new Error('value must be between 1 and 5');
      err.status = 400;
      throw err;
    }

    const note = await Note.findById(req.params.id).select('ratings ratingAvg ratingCount');
    if (!note) {
      const err = new Error('Note not found');
      err.status = 404;
      throw err;
    }

    const hasDownloaded = await User.exists({ _id: req.user.id, 'downloads.note': note._id });
    if (!hasDownloaded) {
      const err = new Error('Download required to rate this note');
      err.status = 403;
      throw err;
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
  } catch (e) {
    return next(e);
  }
});

// Protected upload
router.post(
  '/',
  authRequired,
  async (req, res, next) => {
    const schema = Joi.object({
      title: Joi.string().min(2).max(120).required(),
      subject: Joi.string().min(2).max(60).required(),
      semester: Joi.string().min(1).max(2).required(),
      description: Joi.string().max(500).allow('').optional(),
      fileUrl: Joi.string().uri().required(),
      originalName: Joi.string().min(1).max(255).required(),
      mimeType: Joi.string().min(3).max(100).required(),
    });
    try {
      const { error, value } = schema.validate(req.body || {}, { abortEarly: false });
      if (error) {
        const err = new Error(error.details.map((d) => d.message).join(', '));
        err.status = 400;
        throw err;
      }
      const note = await Note.create({
        title: value.title,
        subject: value.subject,
        semester: value.semester,
        description: value.description || '',
        filePath: value.originalName,
        fileUrl: value.fileUrl,
        originalName: value.originalName,
        mimeType: value.mimeType,
        downloadCount: 0,
        uploadedBy: req.user.id,
      });
      return res.status(201).json({ note });
    } catch (e) {
      return next(e);
    }
  }
);

// Public preview - stream file for PDF preview in iframe
router.get('/:id/preview', async (req, res) => {
  try {
    const note = await Note.findById(req.params.id).select('fileUrl mimeType originalName').lean();
    if (!note) {
      return res.status(404).send('Note not found');
    }
    if (!note.fileUrl) {
      return res.status(404).send('Preview not available - no file URL stored');
    }

    // Fetch file from Supabase storage (public URL)
    const response = await fetch(note.fileUrl);
    if (!response.ok) {
      return res.status(502).send('Failed to fetch file from storage');
    }

    // Set headers for inline PDF viewing
    res.setHeader('Content-Type', note.mimeType || 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${note.originalName || 'file.pdf'}"`);

    // Stream file to client
    response.body.pipe(res);
  } catch (e) {
    return res.status(502).send('Failed to fetch file');
  }
});

// Protected download + track
router.get('/:id/download', authRequired, async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) {
      const err = new Error('Note not found');
      err.status = 404;
      throw err;
    }

    if (!note.fileUrl) {
      const err = new Error('No file URL found for this note.');
      err.status = 404;
      throw err;
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
  } catch (e) {
    return next(e);
  }
});

// Protected: uploader can delete their own uploaded note/file
router.delete('/:id', authRequired, async (req, res) => {
  try {
    const note = await Note.findById(req.params.id).select(
      'uploadedBy filePath fileUrl'
    );
    if (!note) {
      const err = new Error('Note not found');
      err.status = 404;
      throw err;
    }

    if (String(note.uploadedBy) !== String(req.user.id)) {
      const err = new Error('You can only delete your own uploads');
      err.status = 403;
      throw err;
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
  } catch (e) {
    return next(e);
  }
});




module.exports = { notesRouter: router };
