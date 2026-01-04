const mongoose = require('mongoose');

const classExamResultSchema = new mongoose.Schema({
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
  resultCards: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ResultCard',
  }],
  studentResults: [{
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    studentName: {
      type: String,
      required: true,
    },
    studentIdNumber: {
      type: String,
      required: true,
    },
    fatherName: {
      type: String,
      default: '',
    },
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
  }],
  htmlContent: {
    type: String,
    required: true,
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
classExamResultSchema.index({ classId: 1, examName: 1, examYear: 1 });

module.exports = mongoose.model('ClassExamResult', classExamResultSchema);

