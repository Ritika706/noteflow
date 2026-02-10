const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    subject: { type: String, required: true, trim: true },
    semester: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    filePath: { type: String, required: true },
    fileUrl: { type: String, default: '' },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    downloadCount: { type: Number, default: 0 },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    likesCount: { type: Number, default: 0 },
    likedBy: { type: [mongoose.Schema.Types.ObjectId], ref: 'User', default: [] },

    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    ratings: {
      type: [
        {
          user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
          value: { type: Number, required: true, min: 1, max: 5 },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

const Note = mongoose.model('Note', noteSchema);
module.exports = { Note };
