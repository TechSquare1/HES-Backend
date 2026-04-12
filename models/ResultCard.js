const mongoose = require('mongoose');

const resultCardSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Student is required'],
  },
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: [true, 'Class is required'],
  },
  examName: {
    type: String,
    required: [true, 'Exam name is required'],
    trim: true,
  },
  examYear: {
    type: Number,
    required: [true, 'Exam year is required'],
  },
  subjects: [{
    name: {
      type: String,
      required: true,
    },
    totalMarks: {
      type: Number,
      required: true,
    },
    obtainedMarks: {
      type: Number,
      required: true,
    },
  }],
  totalMarks: {
    type: Number,
    required: true,
  },
  obtainedMarks: {
    type: Number,
    required: true,
  },
  position: {
    type: String,
    default: '',
  },
  date: {
    type: String,
    required: true,
  },
  practicalStatus: {
    type: String,
    enum: ['کوئی نہیں', 'بہتر', 'مناسب', 'کمزور'],
    default: 'کوئی نہیں',
  },
  managerSignatureLabel: {
    type: String,
    default: 'دستخط مدیر',
  },
  signatureName: {
    type: String,
    default: '',
  },
  htmlContent: {
    type: String,
    required: true,
  },
  attachmentUrl: {
    type: String,
    default: null,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, {
  timestamps: true,
});

// Index for efficient queries
resultCardSchema.index({ studentId: 1, examName: 1, examYear: 1 });
resultCardSchema.index({ classId: 1, examName: 1, examYear: 1 });

module.exports = mongoose.model('ResultCard', resultCardSchema);

