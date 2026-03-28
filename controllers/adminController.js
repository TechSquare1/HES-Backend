const User = require('../models/User');
const Class = require('../models/Class');
const Exam = require('../models/Exam');
const Attendance = require('../models/Attendance');
const Fees = require('../models/Fees');
const Announcement = require('../models/Announcement');
const ResultCard = require('../models/ResultCard');
const ClassExamResult = require('../models/ClassExamResult');
const { getFileUrl } = require('../middleware/upload');

// @desc    Get all teachers
// @route   GET /api/admin/teachers
// @access  Private/Admin
exports.getAllTeachers = async (req, res) => {
  try {
    const teachers = await User.find({ role: 'teacher' })
      .select('-password')
      .populate('classes', 'className section');
    res.json({
      success: true,
      count: teachers.length,
      data: teachers,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get all nazims
// @route   GET /api/admin/nazims
// @access  Private/Admin
exports.getAllNazims = async (req, res) => {
  try {
    const nazims = await User.find({ role: 'nazim' }).select('-password');
    res.json({
      success: true,
      count: nazims.length,
      data: nazims,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get all students
// @route   GET /api/admin/students
// @access  Private/Admin
exports.getAllStudents = async (req, res) => {
  try {
    const students = await User.find({ role: 'student' })
      .select('-password')
      .populate('classId', 'className section');
    res.json({
      success: true,
      count: students.length,
      data: students,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Create teacher
// @route   POST /api/admin/teachers
// @access  Private/Admin
exports.createTeacher = async (req, res) => {
  try {
    const { name, teacherId, email, phone, classes } = req.body;

    // Basic validations
    if (!name || !teacherId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name and Teacher ID.',
      });
    }

    // Classes are required - at least one class
    if (!classes || !Array.isArray(classes) || classes.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please assign at least one class to the teacher.',
      });
    }

    const trimmedTeacherId = teacherId.toString().trim();

    if (trimmedTeacherId.length < 2 || trimmedTeacherId.length > 22) {
      return res.status(400).json({
        success: false,
        message: 'Teacher ID must be between 2 and 22 characters.',
      });
    }

    // Check if teacherId already exists
    const teacherIdExists = await User.findOne({ teacherId: trimmedTeacherId });
    if (teacherIdExists) {
      return res.status(400).json({
        success: false,
        message: 'Teacher ID is already in use. Please use a different Teacher ID.',
      });
    }

    // Check if email already exists (if provided)
    if (email && email.trim() !== '') {
      const emailExists = await User.findOne({ email: email.toLowerCase().trim() });
      if (emailExists) {
        return res.status(400).json({
          success: false,
          message: 'Email is already in use. Please use a different email.',
        });
      }
    }

    // Validate classes (if provided) - free text between 2 and 22 characters
    let normalizedClasses = [];
    if (classes && Array.isArray(classes)) {
      for (const rawName of classes) {
        const className = (rawName || '').toString().trim();
        if (!className) {
          return res.status(400).json({
            success: false,
            message: 'Class name cannot be empty.',
          });
        }
        if (className.length < 2) {
          return res.status(400).json({
            success: false,
            message: 'Class name must be at least 2 characters long.',
          });
        }
        if (className.length > 22) {
          return res.status(400).json({
            success: false,
            message: 'Class name must not exceed 22 characters.',
          });
        }
        normalizedClasses.push(className);
      }
    }

    // Auto-generate default password
    const defaultPassword = 'MKbW.123';

    const teacher = await User.create({
      name: name.trim(),
      teacherId: trimmedTeacherId,
      email: (email && email.trim() !== '') ? email.toLowerCase().trim() : undefined,
      password: defaultPassword,
      role: 'teacher',
      parentPhone: phone ? phone.trim() : undefined, // reuse parentPhone for phone
    });

    // Create classes for the teacher if provided
    const createdClasses = [];
    if (normalizedClasses.length > 0) {
      for (const className of normalizedClasses) {
        const newClass = await Class.create({
          className,
          teacherId: teacher._id,
        });
        createdClasses.push(newClass._id);
      }
      
      // Update teacher with class references
      teacher.classes = createdClasses;
      await teacher.save();
    }

    const teacherWithClasses = await User.findById(teacher._id)
      .populate('classes', 'className')
      .select('-password');

    res.status(201).json({
      success: true,
      message: 'Teacher created successfully',
      data: teacherWithClasses,
    });
  } catch (error) {
    if (error.code === 11000) {
      if (error.keyPattern?.teacherId) {
        return res.status(400).json({
          success: false,
          message: 'Teacher ID is already in use. Please use a different Teacher ID.',
        });
      }
      if (error.keyPattern?.email) {
        return res.status(400).json({
          success: false,
          message: 'Email is already in use. Please use a different email.',
        });
      }
    }
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Create student
// @route   POST /api/admin/students
// @access  Private/Admin
exports.createStudent = async (req, res) => {
  try {
    const { email, name, fatherName, studentId, parentPhone, gender, classId } = req.body;

    // Validate required fields
    if (!name || !fatherName || !studentId || !parentPhone || !gender) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: name, fatherName, studentId, parentPhone, and gender',
      });
    }

    // Check if email already exists (if provided and not empty)
    if (email && email.trim() !== '') {
      const userExists = await User.findOne({ email: email.toLowerCase().trim() });
      if (userExists) {
        return res.status(400).json({
          success: false,
          message: 'Email is already in use. Please use a different email.',
        });
      }
    }

    // Check if studentId already exists
    const studentIdExists = await User.findOne({ studentId: studentId.trim() });
    if (studentIdExists) {
      return res.status(400).json({
        success: false,
        message: 'Student ID is already in use. Please use a different Student ID.',
      });
    }

    // Auto-generate password for all students
    const defaultPassword = 'MKbW.123';

    // Validate classId if provided
    if (classId) {
      const classObj = await Class.findById(classId);
      if (!classObj) {
        return res.status(400).json({
          success: false,
          message: 'Class not found',
        });
      }
    }

    const student = await User.create({
      email: (email && email.trim() !== '') ? email.toLowerCase().trim() : undefined,
      password: defaultPassword,
      name: name.trim(),
      fatherName: fatherName.trim(),
      role: 'student',
      studentId: studentId.trim(),
      parentPhone: parentPhone.trim(),
      gender,
      classId: classId || undefined,
    });

    // If classId is provided, add student to class
    if (classId) {
      const classObj = await Class.findById(classId);
      if (classObj && !classObj.students.includes(student._id)) {
        classObj.students.push(student._id);
        await classObj.save();
      }
    }

    const createdStudent = await User.findById(student._id)
      .select('-password')
      .populate('classId', 'className section');

    res.status(201).json({
      success: true,
      message: 'Student created successfully',
      data: createdStudent,
    });
  } catch (error) {
    console.error('Create student error:', error);
    if (error.code === 11000) {
      if (error.keyPattern.email) {
        return res.status(400).json({
          success: false,
          message: 'Email is already in use. Please use a different email.',
        });
      }
      if (error.keyPattern.studentId) {
        return res.status(400).json({
          success: false,
          message: 'Student ID is already in use. Please use a different Student ID.',
        });
      }
    }
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', '),
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Create nazim
// @route   POST /api/admin/nazims
// @access  Private/Admin
exports.createNazim = async (req, res) => {
  try {
    const { name, nazimId, email, phone } = req.body;

    // Validate required fields
    if (!name || !nazimId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name and Nazim ID',
      });
    }

    const trimmedNazimId = nazimId.toString().trim();

    if (trimmedNazimId.length < 2 || trimmedNazimId.length > 22) {
      return res.status(400).json({
        success: false,
        message: 'Nazim ID must be between 2 and 22 characters.',
      });
    }

    // Check if email already exists (if provided)
    if (email && email.trim() !== '') {
      const emailExists = await User.findOne({ email: email.toLowerCase().trim() });
      if (emailExists) {
        return res.status(400).json({
          success: false,
          message: 'Email is already in use. Please use a different email.',
        });
      }
    }

    // Check if nazimId already exists
    const nazimIdExists = await User.findOne({ nazimId: trimmedNazimId });
    if (nazimIdExists) {
      return res.status(400).json({
        success: false,
        message: 'Nazim ID is already in use. Please use a different Nazim ID.',
      });
    }

    // Auto-generate password for all nazims
    const defaultPassword = 'MKbW.123';

    const nazim = await User.create({
      name: name.trim(),
      email: (email && email.trim() !== '') ? email.toLowerCase().trim() : undefined,
      password: defaultPassword,
      role: 'nazim',
      nazimId: trimmedNazimId,
      parentPhone: phone ? phone.trim() : undefined, // reuse existing phone field
    });

    res.status(201).json({
      success: true,
      message: 'Nazim created successfully',
      data: nazim,
    });
  } catch (error) {
    if (error.code === 11000) {
      if (error.keyPattern?.email) {
        return res.status(400).json({
          success: false,
          message: 'Email is already in use. Please use a different email.',
        });
      }
      if (error.keyPattern?.nazimId) {
        return res.status(400).json({
          success: false,
          message: 'Nazim ID is already in use. Please use a different Nazim ID.',
        });
      }
    }
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get all classes
// @route   GET /api/admin/classes
// @access  Private/Admin
exports.getAllClasses = async (req, res) => {
  try {
    const classes = await Class.find()
      .populate('teacherId', 'name email teacherId')
      .populate('students', 'name studentId')
      .sort({ className: 1 });

    res.json({
      success: true,
      count: classes.length,
      data: classes,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Create a new class
// @route   POST /api/admin/classes
// @access  Private/Admin
exports.createClass = async (req, res) => {
  try {
    const { className, teacherId } = req.body;
    console.log('Create class request:', { className, teacherId });

    if (!className) {
      return res.status(400).json({
        success: false,
        message: 'Class name is required',
      });
    }

    // Check if class already exists
    const existingClass = await Class.findOne({
      className: className.trim(),
    });

    if (existingClass) {
      return res.status(400).json({
        success: false,
        message: 'Class with this name already exists',
      });
    }

    // Validate teacher if provided
    if (teacherId && teacherId.trim()) {
      console.log('Validating teacher ID:', teacherId);
      const teacher = await User.findOne({ _id: teacherId, role: 'teacher' });
      console.log('Teacher found:', teacher ? teacher.name : 'Not found');
      if (!teacher) {
        return res.status(400).json({
          success: false,
          message: 'Invalid teacher ID',
        });
      }
    }

    const newClass = new Class({
      className: className.trim(),
      teacherId: teacherId && teacherId.trim() ? teacherId : undefined,
    });

    await newClass.save();

    const populatedClass = await Class.findById(newClass._id)
      .populate('teacherId', 'name email teacherId')
      .populate('students', 'name studentId');

    res.status(201).json({
      success: true,
      message: 'Class created successfully',
      data: populatedClass,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Update a class
// @route   PUT /api/admin/classes/:id
// @access  Private/Admin
exports.updateClass = async (req, res) => {
  try {
    const { id } = req.params;
    const { className, teacherId } = req.body;

    if (!className) {
      return res.status(400).json({
        success: false,
        message: 'Class name is required',
      });
    }

    const classToUpdate = await Class.findById(id);
    if (!classToUpdate) {
      return res.status(404).json({
        success: false,
        message: 'Class not found',
      });
    }

    // Check if another class with same name exists
    const existingClass = await Class.findOne({
      className: className.trim(),
      _id: { $ne: id },
    });

    if (existingClass) {
      return res.status(400).json({
        success: false,
        message: 'Another class with this name already exists',
      });
    }

    // Validate teacher if provided
    if (teacherId && teacherId.trim()) {
      const teacher = await User.findOne({ _id: teacherId, role: 'teacher' });
      if (!teacher) {
        return res.status(400).json({
          success: false,
          message: 'Invalid teacher ID',
        });
      }
    }

    classToUpdate.className = className.trim();
    classToUpdate.teacherId = teacherId && teacherId.trim() ? teacherId : undefined;

    await classToUpdate.save();

    const updatedClass = await Class.findById(id)
      .populate('teacherId', 'name email teacherId')
      .populate('students', 'name studentId');

    res.json({
      success: true,
      message: 'Class updated successfully',
      data: updatedClass,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Delete a class
// @route   DELETE /api/admin/classes/:id
// @access  Private/Admin
exports.deleteClass = async (req, res) => {
  try {
    const { id } = req.params;

    const classToDelete = await Class.findById(id);
    if (!classToDelete) {
      return res.status(404).json({
        success: false,
        message: 'Class not found',
      });
    }

    // Remove all students from this class
    await User.updateMany(
      { classId: id },
      { $unset: { classId: 1 } }
    );

    await Class.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Class deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get exam names from result cards by class for admin
// @route   GET /api/admin/exams/class/:classId
// @access  Private/Admin
exports.getExamsByClass = async (req, res) => {
  try {
    const { classId } = req.params;
    const { year } = req.query;

    // Build query - filter by class and optionally by year
    const query = { classId: classId };
    if (year) {
      query.examYear = parseInt(year);
    }

    // Get unique exam names from result cards for this class
    const resultCards = await ResultCard.find(query)
      .select('examName examYear')
      .sort({ examYear: -1, examName: 1 });

    // Group by exam name and get the latest year for each exam
    const examMap = new Map();
    resultCards.forEach(card => {
      const key = card.examName;
      if (!examMap.has(key)) {
        examMap.set(key, {
          name: card.examName,
          year: card.examYear,
          studentCount: 0
        });
      }
      examMap.get(key).studentCount++;
    });

    // Convert to array and add IDs for frontend compatibility
    const formattedExams = Array.from(examMap.values()).map((exam, index) => ({
      _id: `exam_${index}`,
      name: exam.name,
      examDate: null, // Result cards don't have exam dates
      year: exam.year,
      studentCount: exam.studentCount
    }));

    res.json({
      success: true,
      data: formattedExams
    });
  } catch (error) {
    console.error('Get exams by class error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch exams'
    });
  }
};

// @desc    Update student class or ID
// @route   PUT /api/admin/students/:id
// @access  Private/Admin
exports.updateStudent = async (req, res) => {
  try {
    const { name, fatherName, studentId, email, parentPhone, gender, classId } = req.body;
    const student = await User.findById(req.params.id);

    if (!student || student.role !== 'student') {
      return res.status(404).json({
        success: false,
        message: 'Student not found',
      });
    }

    // Update basic fields
    if (name !== undefined) student.name = name.trim();
    if (fatherName !== undefined) student.fatherName = fatherName.trim();
    if (email !== undefined) student.email = email ? email.toLowerCase().trim() : undefined;
    if (parentPhone !== undefined) student.parentPhone = parentPhone ? parentPhone.trim() : undefined;
    if (gender !== undefined) student.gender = gender;

    // Check if new studentId already exists (if provided and different)
    if (studentId && studentId.trim() !== student.studentId) {
      const studentIdExists = await User.findOne({
        studentId: studentId.trim(),
        _id: { $ne: req.params.id }
      });
      if (studentIdExists) {
        return res.status(400).json({
          success: false,
          message: 'Student ID is already in use. Please use a different Student ID.',
        });
      }
      student.studentId = studentId.trim();
    }

    // Update class if provided
    if (classId !== undefined) {
      if (classId) {
        const newClass = await Class.findById(classId);
        if (!newClass) {
          return res.status(404).json({
            success: false,
            message: 'Class not found',
          });
        }

        // Remove student from old class
        if (student.classId && student.classId.toString() !== classId) {
          const oldClass = await Class.findById(student.classId);
          if (oldClass) {
            oldClass.students = oldClass.students.filter(
              (id) => id.toString() !== student._id.toString()
            );
            await oldClass.save();
          }
        }

        // Add student to new class
        if (!newClass.students.includes(student._id)) {
          newClass.students.push(student._id);
          await newClass.save();
        }
      } else {
        // Remove from current class if classId is empty
        if (student.classId) {
          const oldClass = await Class.findById(student.classId);
          if (oldClass) {
            oldClass.students = oldClass.students.filter(
              (id) => id.toString() !== student._id.toString()
            );
            await oldClass.save();
          }
        }
      }

      student.classId = classId || undefined;
    }

    await student.save();

    const updatedStudent = await User.findById(req.params.id)
      .select('-password')
      .populate('classId', 'className section');

    res.json({
      success: true,
      message: 'Student updated successfully',
      data: updatedStudent,
    });
  } catch (error) {
    if (error.code === 11000 && error.keyPattern.studentId) {
      return res.status(400).json({
        success: false,
        message: 'Student ID is already in use. Please use a different Student ID.',
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Update user
// @route   PUT /api/admin/users/:id
// @access  Private/Admin
exports.updateUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      message: 'User updated successfully',
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Change user password
// @route   PUT /api/admin/users/:id/password
// @access  Private/Admin
exports.changeUserPassword = async (req, res) => {
  try {
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long',
      });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Update password (will be hashed by pre-save hook)
    user.password = password;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    console.error('Change user password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Delete user
// @route   DELETE /api/admin/users/:id
// @access  Private/Admin
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get all exams
// @route   GET /api/admin/exams
// @access  Private/Admin
exports.getAllExams = async (req, res) => {
  try {
    const exams = await Exam.find()
      .populate('classId', 'className section')
      .populate('teacherId', 'name email teacherId')
      .sort({ examDate: -1 });

    res.json({
      success: true,
      count: exams.length,
      data: exams,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get all attendance
// @route   GET /api/admin/attendance
// @access  Private/Admin
exports.getAllAttendance = async (req, res) => {
  try {
    const attendance = await Attendance.find()
      .populate('studentId', 'name studentId')
      .populate('classId', 'className section')
      .sort({ date: -1 });

    res.json({
      success: true,
      count: attendance.length,
      data: attendance,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get all fees
// @route   GET /api/admin/fees
// @access  Private/Admin
exports.getAllFees = async (req, res) => {
  try {
    const fees = await Fees.find()
      .populate({
        path: 'studentId',
        select: 'name studentId classId',
        populate: {
          path: 'classId',
          select: 'className section teacherId',
          populate: {
            path: 'teacherId',
            select: 'name'
          }
        }
      })
      .sort({ dueDate: -1 });

    const today = new Date();
    const todayDay = today.getDate();

    const feesWithReminder = fees.map((fee) => {
      const feeObj = fee.toObject();
      const dueDate = fee.dueDate ? new Date(fee.dueDate) : null;

      const isOverdueReminder =
        fee.status !== 'paid' &&
        dueDate &&
        dueDate < today &&
        todayDay > 10;

      feeObj.isOverdueReminder = isOverdueReminder;
      return feeObj;
    });

    res.json({
      success: true,
      count: feesWithReminder.length,
      data: feesWithReminder,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Create announcement
// @route   POST /api/admin/announcements
// @access  Private/Admin
exports.createAnnouncement = async (req, res) => {
  try {
    const { title, content, language, targetAudience } = req.body;
    
    // Validate required fields
    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: 'Please provide title and content',
      });
    }
    
    // Get PDF URL if file was uploaded
    const pdfUrl = req.file ? getFileUrl(req, req.file) : null;

    const announcement = await Announcement.create({
      title,
      content,
      language: language || 'english',
      targetAudience: targetAudience || 'all',
      pdfUrl,
      adminId: req.user.id,
    });

    res.status(201).json({
      success: true,
      message: 'Announcement created successfully',
      data: announcement,
    });
  } catch (error) {
    console.error('Create announcement error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get all announcements
// @route   GET /api/admin/announcements
// @access  Private/Admin
exports.getAllAnnouncements = async (req, res) => {
  try {
    const announcements = await Announcement.find()
      .populate('adminId', 'name')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: announcements.length,
      data: announcements,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Update announcement
// @route   PUT /api/admin/announcements/:id
// @access  Private/Admin
exports.updateAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found',
      });
    }

    res.json({
      success: true,
      message: 'Announcement updated successfully',
      data: announcement,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Delete announcement
// @route   DELETE /api/admin/announcements/:id
// @access  Private/Admin
exports.deleteAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.findByIdAndDelete(req.params.id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found',
      });
    }

    res.json({
      success: true,
      message: 'Announcement deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get monthly report for a student
// @route   GET /api/admin/reports/monthly
// @access  Private/Admin
exports.getMonthlyReport = async (req, res) => {
  try {
    const { studentId, month, year, type = 'monthly' } = req.query;

    // Month names array for consistent use throughout the function
    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];

    if (!studentId || !year) {
      return res.status(400).json({
        success: false,
        message: 'Student ID and year are required',
      });
    }

    // Find student
    const student = await User.findOne({
      studentId: studentId.trim(),
      role: 'student',
    })
      .select('-password')
      .populate({
        path: 'classId',
        select: 'className section teacherId',
        populate: {
          path: 'teacherId',
          select: 'name'
        }
      });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found',
      });
    }

    const reportYear = parseInt(year, 10);
    let startDate;
    let endDate;
    let daysInRange;
    let reportMonth = month ? parseInt(month, 10) : undefined;

    if (type === 'yearly') {
      startDate = new Date(reportYear, 0, 1);
      endDate = new Date(reportYear, 11, 31, 23, 59, 59);
      // Approximate working days later by counting Sundays in loop
      daysInRange = Math.round(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1;
    } else {
      if (!month) {
        return res.status(400).json({
          success: false,
          message: 'Month is required for monthly reports',
        });
      }

      if (reportMonth < 1 || reportMonth > 12) {
        return res.status(400).json({
          success: false,
          message: 'Invalid month. Month must be between 1 and 12',
        });
      }

      startDate = new Date(reportYear, reportMonth - 1, 1);
      endDate = new Date(reportYear, reportMonth, 0, 23, 59, 59);
      daysInRange = endDate.getDate();
    }

    // Get attendance for the period
    const attendanceRecords = await Attendance.find({
      studentId: student._id,
      date: {
        $gte: startDate,
        $lte: endDate,
      },
    });

    // Count present days (excluding Sundays)
    let presentDays = 0;
    let totalWorkingDays = 0;

    const loopStart = new Date(startDate);
    for (let i = 0; i < daysInRange; i++) {
      const currentDate = new Date(
        loopStart.getFullYear(),
        loopStart.getMonth(),
        loopStart.getDate() + i
      );
      const dayOfWeek = currentDate.getDay();

      // Skip Sundays (0 = Sunday)
      if (dayOfWeek !== 0) {
        totalWorkingDays++;
        const dateStr = currentDate.toISOString().split('T')[0];
        const record = attendanceRecords.find(a => {
          const recordDate = new Date(a.date).toISOString().split('T')[0];
          return recordDate === dateStr;
        });
        if (record && record.status === 'present') {
          presentDays++;
        }
      }
    }

    // Get exams for the period
    const exams = await Exam.find({
      examDate: {
        $gte: startDate,
        $lte: endDate,
      },
      'results.studentId': student._id,
      isPublished: true,
    }).populate('classId', 'className');

    // Process individual exam results
    let examResults = [];
    let passedExams = 0;
    let totalExams = exams.length;

    if (exams.length > 0) {
      exams.forEach(exam => {
        const result = exam.results.find(
          r => r.studentId.toString() === student._id.toString()
        );
        if (result) {
          const percentage = (result.marks / exam.totalMarks) * 100;
          const isPassed = percentage >= 33;
          if (isPassed) {
            passedExams++;
          }

          examResults.push({
            examName: exam.examName || `Exam ${exam.subject || 'Unknown'}`,
            subject: exam.subject || 'Unknown',
            marks: result.marks,
            totalMarks: exam.totalMarks,
            percentage: Math.round(percentage),
            status: isPassed ? 'Pass' : 'Fail',
            examDate: exam.examDate,
          });
        }
      });
    }

    // For yearly reports, limit to 2 most recent exams
    if (type === 'yearly' && examResults.length > 2) {
      examResults = examResults
        .sort((a, b) => new Date(b.examDate) - new Date(a.examDate))
        .slice(0, 2);
    }

    // Calculate overall status
    let examStatus = 'No Exams';
    if (totalExams > 0) {
      if (passedExams === totalExams) {
        examStatus = 'Pass';
      } else if (passedExams > 0) {
        examStatus = 'Partial Pass';
      } else {
        examStatus = 'Fail';
      }
    }

    // Get fees for the period
    let feesQuery = {
      studentId: student._id,
      year: reportYear,
    };
    if (type === 'monthly') {
      feesQuery.month = month.toString();
    }

    const fees = await Fees.find(feesQuery);

    // Calculate fees information based on report type
    let feesInfo = {};
    if (type === 'monthly') {
      // For monthly reports, show current month status
      // Try to match by month name or month number
      const currentMonthName = monthNames[(reportMonth || 1) - 1];

      const currentMonthFees = fees.find(f =>
        f.month === currentMonthName ||
        f.month === reportMonth.toString() ||
        f.month === (reportMonth || 1).toString()
      );

      if (currentMonthFees) {
        feesInfo = {
          currentMonthStatus: currentMonthFees.status === 'paid' ? 'Paid' : 'Unpaid',
          currentMonthAmount: currentMonthFees.amount || 0,
          currentMonthPaid: currentMonthFees.paidAmount || 0,
        };
      } else {
        feesInfo = {
          currentMonthStatus: 'No Fee Record',
          currentMonthAmount: 0,
          currentMonthPaid: 0,
        };
      }
    } else {
      // For yearly reports, show total months and paid months
      const totalMonths = fees.length;
      const paidMonths = fees.filter(f => f.status === 'paid').length;

      feesInfo = {
        totalMonths: totalMonths,
        paidMonths: paidMonths,
        unpaidMonths: totalMonths - paidMonths,
      };
    }

    // Check if fees were paid on time (keeping for backward compatibility)
    let feesOnTime = 'N/A';
    if (fees.length > 0) {
      const allPaidOnTime = fees.every(fee => {
        if (fee.status === 'paid' && fee.paidDate) {
          return fee.paidDate <= fee.dueDate;
        }
        return false;
      });
      feesOnTime = allPaidOnTime ? 'Yes' : 'No';
    }

    const reportHeader =
      type === 'yearly' && !reportMonth
        ? { month: 'All Months', year: reportYear }
        : {
            month: monthNames[(reportMonth || 1) - 1],
            year: reportYear,
          };

    res.json({
      success: true,
      data: {
        student: {
          name: student.name,
          fatherName: student.fatherName,
          studentId: student.studentId,
          class: student.classId
            ? `${student.classId.className} ${student.classId.section || ''}`
            : 'No Class',
          teacherName: student.classId?.teacherId?.name || 'No Teacher Assigned',
        },
        report: {
          ...reportHeader,
          attendance: {
            present: presentDays,
            total: totalWorkingDays,
            percentage:
              totalWorkingDays > 0
                ? Math.round((presentDays / totalWorkingDays) * 100)
                : 0,
          },
          exams: {
            status: examStatus,
            passed: passedExams,
            total: totalExams,
            results: examResults,
          },
          fees: {
            onTime: feesOnTime,
            total: fees.length,
            paid: fees.filter(f => f.status === 'paid').length,
            ...feesInfo,
          },
        },
      },
    });
  } catch (error) {
    console.error('Monthly report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get monthly attendance report for all students
// @route   GET /api/admin/reports/attendance
// @access  Private/Admin
exports.getMonthlyAttendanceReport = async (req, res) => {
  try {
    const { month, year, classId } = req.query;

    if (!month || !year) {
      return res.status(400).json({
        success: false,
        message: 'Month and year are required',
      });
    }

    const reportMonth = parseInt(month);
    const reportYear = parseInt(year);

    if (reportMonth < 1 || reportMonth > 12) {
      return res.status(400).json({
        success: false,
        message: 'Invalid month. Month must be between 1 and 12',
      });
    }

    // Calculate date range for the month
    const startDate = new Date(reportYear, reportMonth - 1, 1);
    const endDate = new Date(reportYear, reportMonth, 0, 23, 59, 59);
    const daysInMonth = endDate.getDate();

    // Calculate working days (excluding Sundays)
    let totalWorkingDays = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(reportYear, reportMonth - 1, day);
      if (currentDate.getDay() !== 0) { // 0 = Sunday
        totalWorkingDays++;
      }
    }

    // Get students (filtered by class if provided)
    let studentQuery = { role: 'student' };
    if (classId) {
      studentQuery.classId = classId;
    }

    const students = await User.find(studentQuery)
      .select('-password')
      .populate('classId', 'className section');

    // Get all attendance records for the month
    let attendanceQuery = {
      date: {
        $gte: startDate,
        $lte: endDate,
      },
    };
    if (classId) {
      attendanceQuery.classId = classId;
    }

    const attendanceRecords = await Attendance.find(attendanceQuery);

    // Build report data for each student
    let totalPresent = 0;
    let totalAbsent = 0;
    let totalLeave = 0;

    const studentReports = students.map(student => {
      const studentAttendance = attendanceRecords.filter(
        a => a.studentId.toString() === student._id.toString()
      );

      let present = 0;
      let absent = 0;
      let leave = 0;

      studentAttendance.forEach(record => {
        if (record.status === 'present') present++;
        else if (record.status === 'absent') absent++;
        else if (record.status === 'leave') leave++;
      });

      // Count unmarked days as absent
      const unmarkedDays = totalWorkingDays - (present + absent + leave);
      if (unmarkedDays > 0) {
        absent += unmarkedDays;
      }

      totalPresent += present;
      totalAbsent += absent;
      totalLeave += leave;

      const total = present + absent + leave;
      const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

      return {
        studentId: student.studentId,
        name: student.name,
        fatherName: student.fatherName || 'N/A',
        className: student.classId ? `${student.classId.className}${student.classId.section ? ' ' + student.classId.section : ''}` : 'No Class',
        present,
        absent,
        leave,
        total,
        percentage,
      };
    });

    // Sort by name
    studentReports.sort((a, b) => a.name.localeCompare(b.name));

    // Calculate average attendance
    const avgAttendance = studentReports.length > 0
      ? Math.round(studentReports.reduce((sum, s) => sum + s.percentage, 0) / studentReports.length)
      : 0;

    res.json({
      success: true,
      data: {
        summary: {
          totalStudents: studentReports.length,
          avgAttendance,
          totalPresent,
          totalAbsent,
          totalLeave,
          totalWorkingDays,
        },
        students: studentReports,
      },
    });
  } catch (error) {
    console.error('Monthly attendance report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get yearly attendance report for all students
// @route   GET /api/admin/reports/attendance/yearly
// @access  Private/Admin
exports.getYearlyAttendanceReport = async (req, res) => {
  try {
    const { year, classId } = req.query;

    if (!year) {
      return res.status(400).json({
        success: false,
        message: 'Year is required',
      });
    }

    const reportYear = parseInt(year);

    // Calculate date range for the year
    const startDate = new Date(reportYear, 0, 1);
    const endDate = new Date(reportYear, 11, 31, 23, 59, 59);

    // Get students (filtered by class if provided)
    let studentQuery = { role: 'student' };
    if (classId) {
      studentQuery.classId = classId;
    }

    const students = await User.find(studentQuery)
      .select('-password')
      .populate('classId', 'className section');

    // Get all attendance records for the year
    let attendanceQuery = {
      date: {
        $gte: startDate,
        $lte: endDate,
      },
    };
    if (classId) {
      attendanceQuery.classId = classId;
    }

    const attendanceRecords = await Attendance.find(attendanceQuery);

    // Build report data for each student
    let totalPresent = 0;
    let totalAbsent = 0;
    let totalLeave = 0;

    const studentReports = students.map(student => {
      const studentAttendance = attendanceRecords.filter(
        a => a.studentId.toString() === student._id.toString()
      );

      let present = 0;
      let absent = 0;
      let leave = 0;

      studentAttendance.forEach(record => {
        if (record.status === 'present') present++;
        else if (record.status === 'absent') absent++;
        else if (record.status === 'leave') leave++;
      });

      totalPresent += present;
      totalAbsent += absent;
      totalLeave += leave;

      const total = present + absent + leave;
      const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

      return {
        studentId: student.studentId,
        name: student.name,
        fatherName: student.fatherName || 'N/A',
        className: student.classId
          ? `${student.classId.className}${
              student.classId.section ? ' ' + student.classId.section : ''
            }`
          : 'No Class',
        present,
        absent,
        leave,
        total,
        percentage,
      };
    });

    // Sort by name
    studentReports.sort((a, b) => a.name.localeCompare(b.name));

    // Calculate average attendance
    const avgAttendance =
      studentReports.length > 0
        ? Math.round(
            studentReports.reduce((sum, s) => sum + s.percentage, 0) /
              studentReports.length
          )
        : 0;

    res.json({
      success: true,
      data: {
        summary: {
          totalStudents: studentReports.length,
          avgAttendance,
          totalPresent,
          totalAbsent,
          totalLeave,
        },
        students: studentReports,
      },
    });
  } catch (error) {
    console.error('Yearly attendance report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get monthly fees report for all students
// @route   GET /api/admin/reports/fees
// @access  Private/Admin
exports.getMonthlyFeesReport = async (req, res) => {
  try {
    const { month, year, classId } = req.query;

    if (!month || !year) {
      return res.status(400).json({
        success: false,
        message: 'Month and year are required',
      });
    }

    const reportMonth = parseInt(month);
    const reportYear = parseInt(year);

    // Calculate date range for the month
    const startDate = new Date(reportYear, reportMonth - 1, 1);
    const endDate = new Date(reportYear, reportMonth, 0, 23, 59, 59);

    // Get fees for the month
    let feesQuery = {
      $or: [
        { dueDate: { $gte: startDate, $lte: endDate } },
        { month: month.toString(), year: reportYear },
      ]
    };

    const fees = await Fees.find(feesQuery).populate({
      path: 'studentId',
      select: 'name studentId fatherName classId',
      populate: { path: 'classId', select: 'className' }
    });

    // Filter by class if specified
    let filteredFees = fees.filter(fee => fee.studentId);
    if (classId) {
      filteredFees = filteredFees.filter(fee => 
        fee.studentId.classId && fee.studentId.classId._id.toString() === classId
      );
    }

    // Group fees by student and determine current month status
    const studentMap = new Map();

    filteredFees.forEach(fee => {
      const studentKey = fee.studentId._id.toString();

      if (!studentMap.has(studentKey)) {
        studentMap.set(studentKey, {
          studentId: fee.studentId.studentId,
          name: fee.studentId.name,
          fatherName: fee.studentId.fatherName || 'N/A',
          className: fee.studentId.classId
            ? fee.studentId.classId.className
            : 'No Class',
          currentMonthStatus: fee.status === 'paid' ? 'Paid' : 'Unpaid',
        });
      }
    });

    // Convert map to array
    const studentReports = Array.from(studentMap.values());

    // Sort by name
    studentReports.sort((a, b) => a.name.localeCompare(b.name));

    // Calculate summary
    const totalPaid = studentReports.filter(s => s.currentMonthStatus === 'Paid').length;
    const totalPending = studentReports.filter(s => s.currentMonthStatus === 'Unpaid').length;

    res.json({
      success: true,
      data: {
        summary: {
          totalStudents: studentReports.length,
          paidCount: totalPaid,
          pendingCount: totalPending,
          collectionRate: studentReports.length > 0 
            ? Math.round((totalPaid / studentReports.length) * 100) 
            : 0,
        },
        students: studentReports,
      },
    });
  } catch (error) {
    console.error('Monthly fees report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get yearly fees report for all students
// @route   GET /api/admin/reports/fees/yearly
// @access  Private/Admin
exports.getYearlyFeesReport = async (req, res) => {
  try {
    const { year, classId } = req.query;

    if (!year) {
      return res.status(400).json({
        success: false,
        message: 'Year is required',
      });
    }

    const reportYear = parseInt(year);

    // Calculate date range for the year
    const startDate = new Date(reportYear, 0, 1);
    const endDate = new Date(reportYear, 11, 31, 23, 59, 59);

    // Get fees for the year
    let feesQuery = {
      $or: [
        { dueDate: { $gte: startDate, $lte: endDate } },
        { year: reportYear },
      ],
    };

    const fees = await Fees.find(feesQuery).populate({
      path: 'studentId',
      select: 'name studentId fatherName classId',
      populate: { path: 'classId', select: 'className' },
    });

    // Filter by class if specified
    let filteredFees = fees.filter(fee => fee.studentId);
    if (classId) {
      filteredFees = filteredFees.filter(
        fee =>
          fee.studentId.classId &&
          fee.studentId.classId._id.toString() === classId
      );
    }

    // Group fees by student and calculate summary for each student
    const studentMap = new Map();

    filteredFees.forEach(fee => {
      const studentKey = fee.studentId._id.toString();
      const isPaid = fee.status === 'paid';

      if (!studentMap.has(studentKey)) {
        studentMap.set(studentKey, {
          studentId: fee.studentId.studentId,
          name: fee.studentId.name,
          fatherName: fee.studentId.fatherName || 'N/A',
          className: fee.studentId.classId
            ? fee.studentId.classId.className
            : 'No Class',
          totalMonths: 0,
          paidMonths: 0,
          unpaidMonths: 0,
        });
      }

      const studentData = studentMap.get(studentKey);
      studentData.totalMonths++;
      if (isPaid) {
        studentData.paidMonths++;
      } else {
        studentData.unpaidMonths++;
      }
    });

    // Convert map to array
    const studentReports = Array.from(studentMap.values());

    // Sort by name
    studentReports.sort((a, b) => a.name.localeCompare(b.name));

    // Calculate summary
    const totalPaid = studentReports.reduce((sum, student) => sum + student.paidMonths, 0);
    const totalPending = studentReports.reduce((sum, student) => sum + student.unpaidMonths, 0);

    res.json({
      success: true,
      data: {
        summary: {
          totalStudents: studentReports.length,
          paidCount: totalPaid,
          pendingCount: totalPending,
          collectionRate:
            studentReports.length > 0
              ? Math.round((totalPaid / studentReports.length) * 100)
              : 0,
        },
        students: studentReports,
      },
    });
  } catch (error) {
    console.error('Yearly fees report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get simple class progress report for admin (monthly or yearly)
// @route   GET /api/admin/reports/class
// @access  Private/Admin
exports.getClassProgressReportAdmin = async (req, res) => {
  try {
    const { classId, type = 'monthly', month, year } = req.query;

    if (!classId) {
      return res.status(400).json({
        success: false,
        message: 'Class ID is required',
      });
    }

    const cls = await Class.findById(classId).populate('teacherId', 'name');
    if (!cls) {
      return res.status(404).json({
        success: false,
        message: 'Class not found',
      });
    }

    const now = new Date();
    const reportYear = year ? parseInt(year, 10) : now.getFullYear();

    let startDate;
    let endDate;
    let periodLabel;

    if (type === 'yearly') {
      startDate = new Date(reportYear, 0, 1);
      endDate = new Date(reportYear, 11, 31, 23, 59, 59, 999);
      periodLabel = `${reportYear}`;
    } else {
      const reportMonth = month ? parseInt(month, 10) : now.getMonth() + 1;
      if (reportMonth < 1 || reportMonth > 12) {
        return res.status(400).json({
          success: false,
          message: 'Invalid month',
        });
      }
      startDate = new Date(reportYear, reportMonth - 1, 1);
      endDate = new Date(reportYear, reportMonth, 0, 23, 59, 59, 999);
      const monthNames = [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
      ];
      periodLabel = `${monthNames[reportMonth - 1]} ${reportYear}`;
    }

    const attendanceRecords = await Attendance.find({
      classId: classId,
      date: { $gte: startDate, $lte: endDate },
    });

    const totalMarked = attendanceRecords.length;
    const presentCount = attendanceRecords.filter(
      a => a.status === 'present'
    ).length;
    const absentCount = attendanceRecords.filter(
      a => a.status === 'absent'
    ).length;
    const leaveCount = attendanceRecords.filter(
      a => a.status === 'leave'
    ).length;
    const attendancePercentage =
      totalMarked > 0 ? Math.round((presentCount / totalMarked) * 100) : 0;

    const exams = await Exam.find({
      classId: classId,
      examDate: { $gte: startDate, $lte: endDate },
      isPublished: true,
    });

    let totalResults = 0;
    let totalPercentSum = 0;
    let passedResults = 0;
    let examNames = [];

    exams.forEach(exam => {
      if (!exam.results || exam.results.length === 0) return;

      // Add exam name to list (for participation check)
      if (exam.examName && !examNames.includes(exam.examName)) {
        examNames.push(exam.examName);
      }

      exam.results.forEach(result => {
        if (typeof result.marks !== 'number' || !exam.totalMarks) return;
        const percent = (result.marks / exam.totalMarks) * 100;
        totalResults += 1;
        totalPercentSum += percent;
        if (percent >= 33) {
          passedResults += 1;
        }
      });
    });

    const averagePercentage =
      totalResults > 0 ? Math.round((totalPercentSum / totalResults) * 10) / 10 : 0;
    const passRate =
      totalResults > 0 ? Math.round((passedResults / totalResults) * 100) : 0;

    // Get fees data for the class
    let feesQuery = {
      $or: [
        { dueDate: { $gte: startDate, $lte: endDate } },
        { month: type === 'monthly' ? (month ? month.toString() : undefined) : undefined, year: reportYear },
      ],
    };

    const classFees = await Fees.find({
      ...feesQuery,
      studentId: { $in: cls.students || [] },
    });

    // One bucket per student (yearly + monthly): avoids double-counting when a student
    // has both paid and unpaid fee rows in the same period.
    const classStudentIds = cls.students || [];
    let paidFees = 0;
    let unpaidFees = 0;
    for (const id of classStudentIds) {
      const sid = id.toString();
      const records = classFees.filter((f) => f.studentId.toString() === sid);
      if (records.length === 0) {
        unpaidFees += 1;
        continue;
      }
      const allPaid = records.every((f) => f.status === 'paid');
      if (allPaid) paidFees += 1;
      else unpaidFees += 1;
    }

    // Calculate overall progress rating
    const totalStudents = cls.students ? cls.students.length : 0;
    let progressRating = 'unknown';

    if (totalStudents > 0) {
      // Calculate scores (0-100 scale)
      const attendanceScore = type === 'monthly' ? attendancePercentage : 0; // Only monthly has attendance percentage
      const feesScore = totalStudents > 0 ? (paidFees / totalStudents) * 100 : 0;
      const examScore = totalStudents > 0 ? (totalResults / totalStudents) * 100 : 0;

      // Weight the scores (attendance 40%, fees 35%, exams 25%)
      const overallScore = type === 'monthly'
        ? (attendanceScore * 0.4) + (feesScore * 0.35) + (examScore * 0.25)
        : (feesScore * 0.5) + (examScore * 0.5); // For yearly, focus more on fees and exams

      // Determine rating
      if (overallScore >= 85) {
        progressRating = 'excellent';
      } else if (overallScore >= 70) {
        progressRating = 'good';
      } else if (overallScore >= 55) {
        progressRating = 'average';
      } else if (overallScore >= 40) {
        progressRating = 'needs_improvement';
      } else {
        progressRating = 'poor';
      }
    }

    // Add progress rating to the existing response
    const responseData = {
      class: {
        id: cls._id,
        name: cls.className,
        section: cls.section || '',
        totalStudents: cls.students ? cls.students.length : 0,
        teacherName: cls.teacherId ? cls.teacherId.name : undefined,
        teacherId: cls.teacherId,
      },
      period: {
        type,
        label: periodLabel,
        year: reportYear,
      },
      attendance: {
        totalMarked,
        present: presentCount,
        absent: absentCount,
        leave: leaveCount,
        percentage: type === 'monthly' ? attendancePercentage : undefined,
      },
      exams: {
        totalResults,
        examNames,
      },
      fees: {
        paidCount: paidFees,
        unpaidCount: unpaidFees,
      },
      overallProgress: progressRating,
    };

    res.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error('Admin class progress report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get exams report (monthly or yearly) for admin
// @route   GET /api/admin/reports/exams
// @access  Private/Admin

exports.getExamReports = async (req, res) => {
  try {
    const { type = 'monthly', month, year, classId } = req.query;

    if (!year) {
      return res.status(400).json({
        success: false,
        message: 'Year is required',
      });
    }

    const reportYear = parseInt(year, 10);

    let startDate;
    let endDate;
    let periodLabel;

    if (type === 'yearly') {
      startDate = new Date(reportYear, 0, 1);
      endDate = new Date(reportYear, 11, 31, 23, 59, 59, 999);
      periodLabel = `${reportYear}`;
    } else {
      const reportMonth = month ? parseInt(month, 10) : new Date().getMonth() + 1;
      if (reportMonth < 1 || reportMonth > 12) {
        return res.status(400).json({
          success: false,
          message: 'Invalid month',
        });
      }
      startDate = new Date(reportYear, reportMonth - 1, 1);
      endDate = new Date(reportYear, reportMonth, 0, 23, 59, 59, 999);
      const monthNames = [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
      ];
      periodLabel = `${monthNames[reportMonth - 1]} ${reportYear}`;
    }

    const examQuery = {
      examDate: { $gte: startDate, $lte: endDate },
      isPublished: true,
    };
    if (classId) {
      examQuery.classId = classId;
    }

    const exams = await Exam.find(examQuery)
      .populate('classId', 'className section')
      .populate('teacherId', 'name');

    let totalResults = 0;
    let totalPercentSum = 0;
    let passedResults = 0;

    const examSummaries = exams.map(exam => {
      if (!exam.results || exam.results.length === 0 || !exam.totalMarks) {
        return {
          id: exam._id,
          name: exam.examName,
          className: exam.classId ? exam.classId.className : 'No Class',
          teacherName: exam.teacherId ? exam.teacherId.name : 'N/A',
          examDate: exam.examDate,
          averagePercentage: 0,
          passRate: 0,
          totalStudents: 0,
        };
      }

      let examTotalPercent = 0;
      let examPassed = 0;

      exam.results.forEach(result => {
        if (typeof result.marks !== 'number') return;
        const percent = (result.marks / exam.totalMarks) * 100;
        examTotalPercent += percent;
        totalPercentSum += percent;
        totalResults += 1;
        if (percent >= 33) {
          examPassed += 1;
          passedResults += 1;
        }
      });

      const studentCount = exam.results.length;
      const avgPercent =
        studentCount > 0 ? Math.round((examTotalPercent / studentCount) * 10) / 10 : 0;
      const examPassRate =
        studentCount > 0 ? Math.round((examPassed / studentCount) * 100) : 0;

      return {
        id: exam._id,
        name: exam.examName,
        className: exam.classId ? exam.classId.className : 'No Class',
        teacherName: exam.teacherId ? exam.teacherId.name : 'N/A',
        examDate: exam.examDate,
        averagePercentage: avgPercent,
        passRate: examPassRate,
        totalStudents: studentCount,
      };
    });

    const overallAverage =
      totalResults > 0 ? Math.round((totalPercentSum / totalResults) * 10) / 10 : 0;
    const overallPassRate =
      totalResults > 0 ? Math.round((passedResults / totalResults) * 100) : 0;

    res.json({
      success: true,
      data: {
        period: {
          type,
          label: periodLabel,
          year: reportYear,
        },
        summary: {
          totalExams: exams.length,
          totalResults,
          averagePercentage: overallAverage,
          passRate: overallPassRate,
        },
        exams: examSummaries,
      },
    });
  } catch (error) {
    console.error('Admin exam reports error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get dashboard stats
// @route   GET /api/admin/dashboard
// @access  Private/Admin
exports.getDashboardStats = async (req, res) => {
  try {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    // Count unique exam name-year combinations from ClassExamResult
    const classExamResults = await ClassExamResult.find().select('examName examYear');
    const uniqueExams = new Set();
    classExamResults.forEach(result => {
      uniqueExams.add(`${result.examName}-${result.examYear}`);
    });
    const examCount = uniqueExams.size;

    const [teachers, students, classes, nazims, announcements, newAnnouncements] = await Promise.all([
      User.countDocuments({ role: 'teacher' }),
      User.countDocuments({ role: 'student' }),
      Class.countDocuments(),
      User.countDocuments({ role: 'nazim' }),
      Announcement.countDocuments({ isActive: true }),
      Announcement.countDocuments({
        isActive: true,
        createdAt: { $gte: twoDaysAgo },
      }),
    ]);

    res.json({
      success: true,
      data: {
        teachers,
        students,
        classes,
        nazims,
        exams: examCount,
        announcements,
        newAnnouncements,
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

// @desc    Save result card
// @route   POST /api/admin/result-cards
// @access  Private/Admin
exports.saveResultCard = async (req, res) => {
  try {
    const {
      studentId,
      classId,
      examName,
      examYear,
      subjects,
      totalMarks,
      obtainedMarks,
      position,
      date,
      practicalStatus,
      managerSignatureLabel,
      signatureName,
      htmlContent,
    } = req.body;

    if (!studentId || !classId || !examName || !examYear || !subjects || !htmlContent) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields',
      });
    }

    const resultCard = await ResultCard.create({
      studentId,
      classId,
      examName,
      examYear,
      subjects,
      totalMarks,
      obtainedMarks,
      position: position || '',
      date,
      practicalStatus: practicalStatus || 'کوئی نہیں',
      managerSignatureLabel: managerSignatureLabel || 'دستخط مدیر',
      signatureName: signatureName || '',
      htmlContent,
      createdBy: req.user.id,
    });

    res.status(201).json({
      success: true,
      message: 'Result card saved successfully',
      data: resultCard,
    });
  } catch (error) {
    console.error('Save result card error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get result cards for a student
// @route   GET /api/admin/result-cards/student/:studentId
// @access  Private/Admin
exports.getStudentResultCards = async (req, res) => {
  try {
    const { studentId } = req.params;
    const resultCards = await ResultCard.find({ studentId })
      .populate({
        path: 'classId',
        select: 'className section',
        populate: { path: 'teacherId', select: 'name' }
      })
      .populate('studentId', 'name studentId fatherName')
      .sort({ examYear: -1, createdAt: -1 });

    res.json({
      success: true,
      count: resultCards.length,
      data: resultCards,
    });
  } catch (error) {
    console.error('Get student result cards error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get result cards for a class and exam
// @route   GET /api/admin/result-cards/class/:classId
// @access  Private/Admin
exports.getClassResultCards = async (req, res) => {
  try {
    const { classId } = req.params;
    const { examName, examYear } = req.query;

    const query = { classId };
    if (examName) query.examName = examName;
    if (examYear) query.examYear = parseInt(examYear);

    const resultCards = await ResultCard.find(query)
      .populate('studentId', 'name studentId fatherName')
      .populate({
        path: 'classId',
        select: 'className section',
        populate: { path: 'teacherId', select: 'name' }
      })
      .sort({ examYear: -1, createdAt: -1 });

    res.json({
      success: true,
      count: resultCards.length,
      data: resultCards,
    });
  } catch (error) {
    console.error('Get class result cards error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Generate and save class exam result
// @route   POST /api/admin/class-exam-results
// @access  Private/Admin
exports.saveClassExamResult = async (req, res) => {
  try {
    const { classId, examName, examYear, htmlContent } = req.body;

    if (!classId || !examName || !examYear || !htmlContent) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields',
      });
    }

    // Get all result cards for this class and exam
    const resultCards = await ResultCard.find({
      classId,
      examName,
      examYear,
    }).populate('studentId', 'name studentId fatherName');

    if (resultCards.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No result cards found for this class and exam',
      });
    }

    // Prepare student results
    const studentResults = resultCards.map((card) => ({
      studentId: card.studentId._id,
      studentName: card.studentId.name,
      studentIdNumber: card.studentId.studentId,
      fatherName: card.studentId.fatherName || '',
      totalMarks: card.totalMarks,
      obtainedMarks: card.obtainedMarks,
      position: card.position || '',
    }));

    // Sort by obtained marks (descending) and assign positions if not set
    studentResults.sort((a, b) => b.obtainedMarks - a.obtainedMarks);
    studentResults.forEach((result, index) => {
      if (!result.position) {
        result.position = String(index + 1);
      }
    });

    const classExamResult = await ClassExamResult.create({
      classId,
      examName,
      examYear,
      resultCards: resultCards.map((card) => card._id),
      studentResults,
      htmlContent,
      createdBy: req.user.id,
    });

    // Create notifications for all students in the class and the teacher
    const Notification = require('../models/Notification');
    const classData = await Class.findById(classId).populate('students', '_id').populate('teacherId', '_id');
    const studentIds = classData?.students?.map(s => s._id) || [];
    const teacherId = classData?.teacherId?._id;
    
    const notifications = [];
    
    // Notify all students
    studentIds.forEach(studentId => {
      notifications.push({
        userId: studentId,
        type: 'exam_result',
        title: 'New Exam Result Available',
        message: `New! ${examName} - ${examYear} result is published. Click for more`,
        relatedId: classExamResult._id,
        relatedModel: 'ClassExamResult',
        isRead: false,
      });
    });
    
    // Notify teacher
    if (teacherId) {
      notifications.push({
        userId: teacherId,
        type: 'exam_result',
        title: 'New Exam Result Available',
        message: `New! ${examName} - ${examYear} class result is published. Click for more`,
        relatedId: classExamResult._id,
        relatedModel: 'ClassExamResult',
        isRead: false,
      });
    }

    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }

    res.status(201).json({
      success: true,
      message: 'Class exam result saved successfully',
      data: classExamResult,
    });
  } catch (error) {
    console.error('Save class exam result error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get class exam results
// @route   GET /api/admin/class-exam-results
// @access  Private/Admin
exports.getClassExamResults = async (req, res) => {
  try {
    const { classId, examName, examYear } = req.query;

    const query = {};
    if (classId) query.classId = classId;
    if (examName) query.examName = examName;
    if (examYear) query.examYear = parseInt(examYear);

    const classExamResults = await ClassExamResult.find(query)
      .populate({
        path: 'classId',
        select: 'className section',
        populate: { path: 'teacherId', select: 'name' }
      })
      .populate('createdBy', 'name')
      .sort({ examYear: -1, createdAt: -1 });

    res.json({
      success: true,
      count: classExamResults.length,
      data: classExamResults,
    });
  } catch (error) {
    console.error('Get class exam results error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Delete result card
// @route   DELETE /api/admin/result-cards/:id
// @access  Private/Admin
exports.deleteResultCard = async (req, res) => {
  try {
    const { id } = req.params;

    const resultCard = await ResultCard.findById(id);
    if (!resultCard) {
      return res.status(404).json({
        success: false,
        message: 'Result card not found',
      });
    }

    await ResultCard.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Result card deleted successfully',
    });
  } catch (error) {
    console.error('Delete result card error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Delete class exam result
// @route   DELETE /api/admin/class-exam-results/:id
// @access  Private/Admin
exports.deleteClassExamResult = async (req, res) => {
  try {
    const { id } = req.params;

    const classExamResult = await ClassExamResult.findById(id);
    if (!classExamResult) {
      return res.status(404).json({
        success: false,
        message: 'Class exam result not found',
      });
    }

    await ClassExamResult.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Class exam result deleted successfully',
    });
  } catch (error) {
    console.error('Delete class exam result error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get individual exam report with student results
// @route   GET /api/admin/exam-report/:examId
// @access  Private/Admin
exports.getExamReport = async (req, res) => {
  try {
    const { examId } = req.params;

    if (!examId) {
      return res.status(400).json({
        success: false,
        message: 'Exam ID is required',
      });
    }

    // Find all result cards for this exam
    const resultCards = await ResultCard.find({ examName: examId })
      .populate('studentId', 'name studentId')
      .sort({ obtainedMarks: -1 });

    if (resultCards.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No result cards found for this exam',
      });
    }

    // Get exam details from the first result card
    const firstCard = resultCards[0];
    const examData = {
      name: firstCard.examName,
      examDate: firstCard.examDate,
      totalMarks: firstCard.totalMarks,
    };

    // Get class and teacher information
    const classInfo = await Class.findById(firstCard.classId)
      .populate('teacherId', 'name');

    if (classInfo) {
      examData.className = classInfo.className;
      examData.teacherName = classInfo.teacherId?.name || 'No Teacher';
    }

    // Process student results
    const students = resultCards.map(card => ({
      name: card.studentId?.name || 'Unknown Student',
      studentId: card.studentId?.studentId || 'N/A',
      marks: card.obtainedMarks,
      status: card.status || (card.obtainedMarks >= (card.totalMarks * 0.4) ? 'pass' : 'fail'),
    }));

    res.json({
      success: true,
      data: {
        exam: examData,
        students: students,
      },
    });
  } catch (error) {
    console.error('Get exam report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};
