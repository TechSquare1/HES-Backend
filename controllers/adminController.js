const User = require('../models/User');
const Class = require('../models/Class');
const Exam = require('../models/Exam');
const Attendance = require('../models/Attendance');
const Fees = require('../models/Fees');
const Announcement = require('../models/Announcement');
const { getFileUrl } = require('../middleware/upload');

// @desc    Get all teachers
// @route   GET /api/admin/teachers
// @access  Private/Admin
exports.getAllTeachers = async (req, res) => {
  try {
    const teachers = await User.find({ role: 'teacher' }).select('-password');
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

// @desc    Update student class or ID
// @route   PUT /api/admin/students/:id
// @access  Private/Admin
exports.updateStudent = async (req, res) => {
  try {
    const { studentId, classId } = req.body;
    const student = await User.findById(req.params.id);

    if (!student || student.role !== 'student') {
      return res.status(404).json({
        success: false,
        message: 'Student not found',
      });
    }

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
    if (classId) {
      const newClass = await Class.findById(classId);
      if (!newClass) {
        return res.status(404).json({
          success: false,
          message: 'Class not found',
        });
      }

      // Remove student from old class
      if (student.classId) {
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

      student.classId = classId;
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
      .populate('studentId', 'name studentId')
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
    const { studentId, month, year } = req.query;

    if (!studentId || !month || !year) {
      return res.status(400).json({
        success: false,
        message: 'Student ID, month, and year are required',
      });
    }

    // Find student
    const student = await User.findOne({ 
      studentId: studentId.trim(),
      role: 'student' 
    }).select('-password').populate('classId', 'className section');

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found',
      });
    }

    // Parse month and year
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

    // Get attendance for the month
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
    
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(reportYear, reportMonth - 1, day);
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

    // Get exams for the month
    const exams = await Exam.find({
      examDate: {
        $gte: startDate,
        $lte: endDate,
      },
      'results.studentId': student._id,
      isPublished: true,
    }).populate('classId', 'className');

    // Calculate exam pass/fail status
    let examStatus = 'No Exams';
    let passedExams = 0;
    let totalExams = exams.length;

    if (exams.length > 0) {
      exams.forEach(exam => {
        const result = exam.results.find(r => r.studentId.toString() === student._id.toString());
        if (result) {
          const percentage = (result.marks / exam.totalMarks) * 100;
          if (percentage >= 33) {
            passedExams++;
          }
        }
      });
      
      if (passedExams === totalExams) {
        examStatus = 'Pass';
      } else if (passedExams > 0) {
        examStatus = 'Partial Pass';
      } else {
        examStatus = 'Fail';
      }
    }

    // Get fees for the month
    const fees = await Fees.find({
      studentId: student._id,
      month: month.toString(),
      year: reportYear,
    });

    // Check if fees were paid on time
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

    // Month name
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    res.json({
      success: true,
      data: {
        student: {
          name: student.name,
          fatherName: student.fatherName,
          studentId: student.studentId,
          class: student.classId ? `${student.classId.className} ${student.classId.section || ''}` : 'No Class',
        },
        report: {
          month: monthNames[reportMonth - 1],
          year: reportYear,
          attendance: {
            present: presentDays,
            total: totalWorkingDays,
            percentage: totalWorkingDays > 0 ? Math.round((presentDays / totalWorkingDays) * 100) : 0,
          },
          exams: {
            status: examStatus,
            passed: passedExams,
            total: totalExams,
          },
          fees: {
            onTime: feesOnTime,
            total: fees.length,
            paid: fees.filter(f => f.status === 'paid').length,
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

// @desc    Get dashboard stats
// @route   GET /api/admin/dashboard
// @access  Private/Admin
exports.getDashboardStats = async (req, res) => {
  try {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const [teachers, students, nazims, exams, announcements, newAnnouncements] = await Promise.all([
      User.countDocuments({ role: 'teacher' }),
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'nazim' }),
      Exam.countDocuments(),
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
        nazims,
        exams,
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
