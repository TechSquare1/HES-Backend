const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const { getFileUrl } = require('../middleware/upload');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
  try {
    if (process.env.ALLOW_PUBLIC_REGISTRATION !== 'true') {
      return res.status(403).json({
        success: false,
        message: 'Registration is disabled. Ask an administrator to create your account.',
      });
    }

    const { email, password, name, studentId, parentPhone, classId, fatherName, gender } = req.body;

    // Self-service registration is student-only (never trust client-supplied role for staff)
    const role = 'student';

    if (!name || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name and password are required',
      });
    }
    if (!studentId || !String(studentId).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Student ID is required',
      });
    }
    if (!fatherName || !String(fatherName).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Father name is required',
      });
    }
    if (!parentPhone || !String(parentPhone).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Parent phone is required',
      });
    }

    // Check if user exists by email (if provided)
    if (email) {
      const userExists = await User.findOne({ email: email.toLowerCase().trim() });
      if (userExists) {
        return res.status(400).json({
          success: false,
          message: 'User already exists with this email',
        });
      }
    }

    // Check if studentId already exists (for students)
    if (role === 'student' && studentId) {
      const studentExists = await User.findOne({ studentId });
      if (studentExists) {
        return res.status(400).json({
          success: false,
          message: 'Student ID already exists',
        });
      }
    }

    // Create user (student only)
    const user = await User.create({
      email: email ? email.toLowerCase().trim() : undefined,
      password,
      name: String(name).trim(),
      role,
      studentId: String(studentId).trim(),
      parentPhone: String(parentPhone).trim(),
      classId: classId || undefined,
      fatherName: String(fatherName).trim(),
      gender: gender === 'male' || gender === 'female' ? gender : undefined,
    });

    if (user) {
      const token = generateToken(user._id);
      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          token,
          user: {
            id: user._id,
            email: user.email,
            name: user.name,
            role: user.role,
            studentId: user.studentId,
          },
        },
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Invalid user data',
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { loginId, password } = req.body;

    if (!loginId || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide login ID and password',
      });
    }

    const trimmedLoginId = loginId.trim();

    // Try to find user by any of the ID fields
    let user = await User.findOne({
      $or: [
        { studentId: trimmedLoginId },
        { teacherId: trimmedLoginId },
        { nazimId: trimmedLoginId },
        { adminId: trimmedLoginId },
        { email: trimmedLoginId.toLowerCase() }, // Also allow email login as fallback
      ],
    }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Your account has been deactivated',
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    const token = generateToken(user._id);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          studentId: user.studentId,
          teacherId: user.teacherId,
          nazimId: user.nazimId,
          adminId: user.adminId,
          profileImage: user.profileImage,
          gender: user.gender,
          feeScope: user.role === 'nazim' ? (user.feeScope || 'male') : undefined,
        },
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          studentId: user.studentId,
          teacherId: user.teacherId,
          nazimId: user.nazimId,
          adminId: user.adminId,
          profileImage: user.profileImage,
          parentPhone: user.parentPhone,
          fatherName: user.fatherName,
          classId: user.classId,
          gender: user.gender,
          feeScope: user.role === 'nazim' ? (user.feeScope || 'male') : undefined,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Update profile
// @route   PUT /api/auth/profile
// @access  Private
exports.updateProfile = async (req, res) => {
  try {
    const { name, email, parentPhone, adminId, fatherName, gender } = req.body;
    // Updated for GCP Cloud Storage support (async) - old: synchronous local file URL
    const profileImage = req.file ? await getFileUrl(req, req.file) : undefined;

    // Get current user to check existing adminId
    const currentUser = await User.findById(req.user.id);

    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email.toLowerCase().trim();
    if (profileImage) updateData.profileImage = profileImage;
    if (parentPhone) updateData.parentPhone = parentPhone;
    if (adminId && req.user.role === 'admin' && adminId !== currentUser.adminId) updateData.adminId = adminId;
    if (req.user.role === 'student' && fatherName !== undefined && fatherName !== null) {
      const trimmed = String(fatherName).trim();
      if (!trimmed) {
        return res.status(400).json({
          success: false,
          message: 'Parent name is required',
        });
      }
      updateData.fatherName = trimmed;
    }

    if (['teacher', 'nazim', 'admin'].includes(req.user.role) && gender !== undefined && gender !== null) {
      const raw = String(gender).trim().toLowerCase();
      if (raw === '') {
        // omit — keep existing gender
      } else if (['male', 'female'].includes(raw)) {
        updateData.gender = raw;
      } else {
        return res.status(400).json({
          success: false,
          message: 'Invalid gender',
        });
      }
    }

    const user = await User.findByIdAndUpdate(req.user.id, updateData, {
      new: true,
      runValidators: true,
    }).select('-password');

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          studentId: user.studentId,
          teacherId: user.teacherId,
          nazimId: user.nazimId,
          adminId: user.adminId,
          profileImage: user.profileImage,
          parentPhone: user.parentPhone,
          fatherName: user.fatherName,
          gender: user.gender,
          feeScope: user.role === 'nazim' ? (user.feeScope || 'male') : undefined,
        },
      },
    });
  } catch (error) {
    let errorMessage = 'Server error';

    // Handle MongoDB duplicate key error
    if (error.code === 11000) {
      if (error.message.includes('adminId')) {
        errorMessage = 'Admin ID already exists. Please choose a different ID.';
      } else if (error.message.includes('email')) {
        errorMessage = 'Email already exists. Please choose a different email.';
      } else {
        errorMessage = 'Duplicate value error. Please check your input.';
      }
    } else if (error.name === 'ValidationError') {
      errorMessage = 'Validation error: ' + Object.values(error.errors).map(err => err.message).join(', ');
    }

    res.status(error.code === 11000 ? 400 : 500).json({
      success: false,
      message: errorMessage,
      error: error.message,
    });
  }
};

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both current and new password',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long',
      });
    }

    // Get user with password
    const user = await User.findById(req.user.id).select('+password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }

    // Update password (will be hashed by pre-save hook)
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};
