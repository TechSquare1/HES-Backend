const mongoose = require('mongoose');

const examSchema = new mongoose.Schema({
  examName: {
    type: String,
    required: [true, 'Exam name is required'],
    trim: true,
  },
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
  examDate: {
    type: Date,
    required: [true, 'Exam date is required'],
  },
  totalMarks: {
    type: Number,
    required: [true, 'Total marks is required'],
    default: 100,
  },
  results: [{
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    marks: {
      type: Number,
      required: true,
      min: 0,
    },
    grade: {
      type: String,
      enum: ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F'],
    },
    remarks: {
      type: String,
      trim: true,
    },
  }],
  isPublished: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

// Calculate grade based on marks
examSchema.methods.calculateGrade = function(marks, totalMarks) {
  const percentage = (marks / totalMarks) * 100;
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B+';
  if (percentage >= 60) return 'B';
  if (percentage >= 50) return 'C+';
  if (percentage >= 40) return 'C';
  if (percentage >= 33) return 'D';
  return 'F';
};

module.exports = mongoose.model('Exam', examSchema);

