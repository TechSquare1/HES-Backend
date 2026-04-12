const mongoose = require('mongoose');

const classScheduleSchema = new mongoose.Schema({
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: [true, 'Class is required'],
  },
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Teacher is required'],
  },
  from: {
    type: String,
    required: [true, 'Start time is required'],
    trim: true,
  },
  to: {
    type: String,
    required: [true, 'End time is required'],
    trim: true,
  },
}, {
  timestamps: true,
});

classScheduleSchema.index({ classId: 1, teacherId: 1 }, { unique: true });

module.exports = mongoose.model('ClassSchedule', classScheduleSchema);
