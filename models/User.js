const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    unique: true,
    sparse: true, // Allow null values but ensure uniqueness when present
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false, // Don't return password by default
  },
  role: {
    type: String,
    enum: ['admin', 'teacher', 'student', 'nazim'],
    required: [true, 'Role is required'],
  },
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
  },
  fatherName: {
    type: String,
    required: function() {
      return this.role === 'student';
    },
    trim: true,
  },
  profileImage: {
    type: String,
    default: null,
  },
  // Admin specific field
  adminId: {
    type: String,
    required: function() {
      return this.role === 'admin';
    },
    unique: true,
    sparse: true,
    trim: true,
  },
  // Teacher specific fields
  teacherId: {
    type: String,
    required: function() {
      return this.role === 'teacher';
    },
    unique: true,
    sparse: true,
    trim: true,
  },
  classes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
  }],
  // Student specific fields
  studentId: {
    type: String,
    required: function() {
      return this.role === 'student';
    },
    unique: true,
    sparse: true,
  },
  gender: {
    type: String,
    enum: ['male', 'female'],
    required: false,
  },
  parentPhone: {
    type: String,
    required: function() {
      return this.role === 'student';
    },
  },
  // Nazim specific fields
  nazimId: {
    type: String,
    required: function() {
      return this.role === 'nazim';
    },
    unique: true,
    sparse: true,
    trim: true,
  },
  feeScope: {
    type: String,
    enum: ['male', 'female'],
    default: function() {
      return this.role === 'nazim' ? 'male' : undefined;
    },
  },
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
