const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
  },
  content: {
    type: String,
    required: [true, 'Content is required'],
  },
  language: {
    type: String,
    enum: ['english', 'urdu'],
    default: 'english',
  },
  pdfUrl: {
    type: String,
    default: null,
  },
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Admin is required'],
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  targetAudience: {
    type: String,
    enum: ['all', 'teachers', 'students', 'parents'],
    default: 'all',
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Announcement', announcementSchema);

