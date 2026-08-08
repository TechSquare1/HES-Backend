const mongoose = require('mongoose');

const COMPLAINT_CATEGORIES = [
  'app_issue',
  'teacher_related',
  'student_related',
  'fees_issue',
  'attendance_issue',
  'other',
];

const complaintSchema = new mongoose.Schema(
  {
    fromUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    fromRole: {
      type: String,
      enum: ['student', 'teacher', 'admin'],
      required: true,
    },
    category: {
      type: String,
      enum: COMPLAINT_CATEGORIES,
      required: [true, 'Category is required'],
    },
    message: {
      type: String,
      required: [true, 'Message is required'],
      trim: true,
      maxlength: [2000, 'Message cannot exceed 2000 characters'],
    },
    toUserIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      default: null,
    },
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    status: {
      type: String,
      enum: ['open', 'solved'],
      default: 'open',
    },
    solvedAt: {
      type: Date,
      default: null,
    },
    solvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

complaintSchema.index({ fromUserId: 1, createdAt: -1 });
complaintSchema.index({ toUserIds: 1, createdAt: -1 });
complaintSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Complaint', complaintSchema);
module.exports.COMPLAINT_CATEGORIES = COMPLAINT_CATEGORIES;
