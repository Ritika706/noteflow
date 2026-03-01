const express = require('express');
const { authRequired } = require('../middleware/auth');
const { User } = require('../models/User');
const { Note } = require('../models/Note');

const router = express.Router();

router.get('/', authRequired, async (req, res) => {
  const user = await User.findById(req.user.id).select('name email bookmarks').lean();
  if (!user) return res.status(404).json({ message: 'User not found' });

  const uploads = await Note.find({ uploadedBy: req.user.id })
    .sort({ createdAt: -1 })
    .select('title subject semester description mimeType originalName createdAt')
    .lean();

  const populated = await User.findById(req.user.id)
    .populate({
      path: 'downloads.note',
      select: 'title subject semester description mimeType originalName createdAt downloadCount likesCount ratingAvg ratingCount',
    })
    .populate({ path: 'bookmarks', select: 'title subject semester description mimeType originalName createdAt downloadCount likesCount ratingAvg ratingCount' })
    .select('downloads bookmarks')
    .lean();

  return res.json({
    user: { id: req.user.id, name: user.name, email: user.email },
    uploads,
    downloads: populated?.downloads || [],
    bookmarks: populated?.bookmarks || [],
  });
});

router.get('/bookmarks', authRequired, async (req, res) => {
  const me = await User.findById(req.user.id)
    .populate({ path: 'bookmarks', select: 'title subject semester description mimeType originalName createdAt downloadCount likesCount ratingAvg ratingCount' })
    .select('bookmarks')
    .lean();
  return res.json({ bookmarks: me?.bookmarks || [] });
});

router.post('/bookmarks/:noteId', authRequired, async (req, res) => {
  const note = await Note.findById(req.params.noteId).select('_id');
  if (!note) return res.status(404).json({ message: 'Note not found' });

  const me = await User.findById(req.user.id).select('bookmarks');
  if (!me) return res.status(404).json({ message: 'User not found' });

  const already = (me.bookmarks || []).some((n) => String(n) === String(note._id));
  if (already) {
    await User.updateOne({ _id: req.user.id }, { $pull: { bookmarks: note._id } });
    return res.json({ bookmarked: false });
  }

  await User.updateOne({ _id: req.user.id }, { $addToSet: { bookmarks: note._id } });
  return res.json({ bookmarked: true });
});

module.exports = { userRouter: router };
