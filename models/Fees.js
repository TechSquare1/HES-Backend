const mongoose = require('mongoose');

const feesSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Student is required'],
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: 0,
  },
  dueDate: {
    type: Date,
    required: [true, 'Due date is required'],
  },
  paidDate: {
    type: Date,
    default: null,
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'partial'],
    default: 'pending',
  },
  paidAmount: {
    type: Number,
    default: 0,
    min: 0,
  },
  remarks: {
    type: String,
    trim: true,
  },
  month: {
    type: String,
    trim: true,
  },
  year: {
    type: Number,
  },
}, {
  timestamps: true,
});

// Index for efficient queries
feesSchema.index({ studentId: 1, status: 1 });
feesSchema.index({ dueDate: 1 });

module.exports = mongoose.model('Fees', feesSchema);

