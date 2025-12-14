const Class = require('../models/Class');
const Exam = require('../models/Exam');
const Attendance = require('../models/Attendance');
const Fees = require('../models/Fees');
const User = require('../models/User');
const Announcement = require('../models/Announcement');

// @desc    Get teacher's classes
// @route   GET /api/teacher/classes
// @access  Private/Teacher
exports.getMyClasses = async (req, res) => {
  try {
    const classes = await Class.find({ teacherId: req.user.id })
      .populate('students', 'name studentId')
      .populate('teacherId', 'name');

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

// @desc    Get teacher's students
// @route   GET /api/teacher/students
// @access  Private/Teacher
exports.getMyStudents = async (req, res) => {
  try {
    const classes = await Class.find({ teacherId: req.user.id });
    const classIds = classes.map(c => c._id);

    const students = await User.find({
      role: 'student',
      classId: { $in: classIds },
    }).populate('classId', 'className section');

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

// @desc    Get teacher's exams
// @route   GET /api/teacher/exams
// @access  Private/Teacher
exports.getMyExams = async (req, res) => {
  try {
    const exams = await Exam.find({ teacherId: req.user.id })
      .populate('classId', 'className section')
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

// @desc    Create exam
// @route   POST /api/teacher/exams
// @access  Private/Teacher
exports.createExam = async (req, res) => {
  try {
    const { examName, classId, examDate, totalMarks } = req.body;

    const exam = await Exam.create({
      examName,
      classId,
      examDate,
      totalMarks: totalMarks || 100,
      teacherId: req.user.id,
    });

    res.status(201).json({
      success: true,
      message: 'Exam created successfully',
      data: exam,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Add exam results
// @route   PUT /api/teacher/exams/:id/results
// @access  Private/Teacher
exports.addExamResults = async (req, res) => {
  try {
    const { results } = req.body;
    const Notification = require('../models/Notification');
    const exam = await Exam.findById(req.params.id)
      .populate('classId', 'students');

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found',
      });
    }

    if (exam.teacherId.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
    }

    // Calculate grades for each result
    const resultsWithGrades = results.map(result => {
      const grade = exam.calculateGrade(result.marks, exam.totalMarks);
      return {
        ...result,
        grade,
      };
    });

    exam.results = resultsWithGrades;
    exam.isPublished = true;
    await exam.save();

    // Create notifications for students
    const notifications = results.map(result => ({
      userId: result.studentId,
      type: 'exam_result',
      title: 'New Exam Result Available',
      message: `Your result for ${exam.examName} has been published.`,
      relatedId: exam._id,
      relatedModel: 'Exam',
      isRead: false,
    }));

    await Notification.insertMany(notifications);

    res.json({
      success: true,
      message: 'Results added successfully',
      data: exam,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get exam results
// @route   GET /api/teacher/exams/:id/results
// @access  Private/Teacher
exports.getExamResults = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id)
      .populate('classId', 'className section')
      .populate('results.studentId', 'name studentId');

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found',
      });
    }

    if (exam.teacherId.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
    }

    res.json({
      success: true,
      data: exam,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Mark attendance (single or bulk)
// @route   POST /api/teacher/attendance
// @access  Private/Teacher
exports.markAttendance = async (req, res) => {
  try {
    const { studentId, classId, date, status, attendanceList } = req.body;
    const attendanceDate = date ? new Date(date) : new Date();
    attendanceDate.setHours(0, 0, 0, 0);

    // Bulk attendance marking
    if (attendanceList && Array.isArray(attendanceList)) {
      const results = [];
      
      for (const item of attendanceList) {
        const existingAttendance = await Attendance.findOne({
          studentId: item.studentId,
          classId: item.classId,
          date: {
            $gte: new Date(attendanceDate),
            $lt: new Date(attendanceDate.getTime() + 24 * 60 * 60 * 1000),
          },
        });

        if (existingAttendance) {
          existingAttendance.status = item.status || 'present';
          existingAttendance.markedBy = req.user.id;
          await existingAttendance.save();
          results.push(existingAttendance);
        } else {
          const newAttendance = await Attendance.create({
            studentId: item.studentId,
            classId: item.classId,
            date: attendanceDate,
            status: item.status || 'present',
            markedBy: req.user.id,
          });
          results.push(newAttendance);
        }
      }

      return res.status(201).json({
        success: true,
        message: 'Attendance marked successfully for all students',
        count: results.length,
        data: results,
      });
    }

    // Single attendance marking
    const existingAttendance = await Attendance.findOne({
      studentId,
      classId,
      date: {
        $gte: new Date(attendanceDate),
        $lt: new Date(attendanceDate.getTime() + 24 * 60 * 60 * 1000),
      },
    });

    let attendance;
    if (existingAttendance) {
      existingAttendance.status = status || 'present';
      existingAttendance.markedBy = req.user.id;
      attendance = await existingAttendance.save();
    } else {
      attendance = await Attendance.create({
        studentId,
        classId,
        date: attendanceDate,
        status: status || 'present',
        markedBy: req.user.id,
      });
    }

    res.status(201).json({
      success: true,
      message: 'Attendance marked successfully',
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

// @desc    Get class attendance
// @route   GET /api/teacher/attendance/:classId
// @access  Private/Teacher
exports.getClassAttendance = async (req, res) => {
  try {
    const attendance = await Attendance.find({ classId: req.params.classId })
      .populate('studentId', 'name studentId')
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

// @desc    Get all available students (not assigned to any class or assigned to other classes)
// @route   GET /api/teacher/students/available
// @access  Private/Teacher
exports.getAllAvailableStudents = async (req, res) => {
  try {
    // Get all students, optionally filter by those not in any class or in other classes
    const students = await User.find({ role: 'student' })
      .select('-password')
      .populate('classId', 'className section teacherId')
      .sort({ name: 1 });

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

// @desc    Add existing student to class
// @route   POST /api/teacher/students/:studentId/add-to-class
// @access  Private/Teacher
exports.addStudentToClass = async (req, res) => {
  try {
    const { classId } = req.body;
    const { studentId } = req.params;

    if (!classId) {
      return res.status(400).json({
        success: false,
        message: 'Class ID is required',
      });
    }

    // Verify that the class belongs to this teacher
    const classObj = await Class.findById(classId);
    if (!classObj || classObj.teacherId.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only add students to your own classes',
      });
    }

    // Find the student
    const student = await User.findById(studentId);
    if (!student || student.role !== 'student') {
      return res.status(404).json({
        success: false,
        message: 'Student not found',
      });
    }

    // Remove student from old class if exists
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
    if (!classObj.students.includes(student._id)) {
      classObj.students.push(student._id);
      await classObj.save();
    }

    // Update student's classId
    student.classId = classId;
    await student.save();

    const updatedStudent = await User.findById(studentId)
      .select('-password')
      .populate('classId', 'className section');

    res.json({
      success: true,
      message: 'Student added to class successfully',
      data: updatedStudent,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Update student class (teachers cannot edit student ID)
// @route   PUT /api/teacher/students/:id
// @access  Private/Teacher
exports.updateStudent = async (req, res) => {
  try {
    const { classId } = req.body; // Only allow classId, not studentId
    const student = await User.findById(req.params.id);

    if (!student || student.role !== 'student') {
      return res.status(404).json({
        success: false,
        message: 'Student not found',
      });
    }

    // Verify student belongs to teacher's class
    if (student.classId) {
      const currentClass = await Class.findById(student.classId);
      if (!currentClass || currentClass.teacherId.toString() !== req.user.id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You can only update students from your own classes',
        });
      }
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

      // Verify new class belongs to this teacher
      if (newClass.teacherId.toString() !== req.user.id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You can only move students to your own classes',
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

// @desc    Remove student from class (NOT delete from platform)
// @route   DELETE /api/teacher/students/:id
// @access  Private/Teacher
exports.removeStudent = async (req, res) => {
  try {
    const student = await User.findById(req.params.id);
    
    if (!student || student.role !== 'student') {
      return res.status(404).json({
        success: false,
        message: 'Student not found',
      });
    }

    // Verify that the student belongs to one of this teacher's classes
    if (student.classId) {
      const classObj = await Class.findById(student.classId);
      if (!classObj || classObj.teacherId.toString() !== req.user.id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You can only remove students from your own classes',
        });
      }

      // Remove student from class
      classObj.students = classObj.students.filter(
        (id) => id.toString() !== student._id.toString()
      );
      await classObj.save();

      // Remove classId from student (but don't delete the student)
      student.classId = undefined;
      await student.save();
    }

    res.json({
      success: true,
      message: 'Student removed from class successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get student fees (view only)
// @route   GET /api/teacher/fees
// @access  Private/Teacher
exports.getStudentFees = async (req, res) => {
  try {
    const classes = await Class.find({ teacherId: req.user.id });
    const classIds = classes.map(c => c._id);
    const students = await User.find({ classId: { $in: classIds } });
    const studentIds = students.map(s => s._id);

    const fees = await Fees.find({ studentId: { $in: studentIds } })
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

// @desc    Get dashboard stats
// @route   GET /api/teacher/dashboard
// @access  Private/Teacher
exports.getDashboardStats = async (req, res) => {
  try {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const classes = await Class.find({ teacherId: req.user.id });
    const classIds = classes.map(c => c._id);
    const students = await User.find({ classId: { $in: classIds } });
    const studentIds = students.map(s => s._id);

    const [myClasses, myStudents, myExams, newAnnouncements] = await Promise.all([
      Class.countDocuments({ teacherId: req.user.id }),
      User.countDocuments({ classId: { $in: classIds } }),
      Exam.countDocuments({ teacherId: req.user.id }),
      Announcement.countDocuments({ 
        isActive: true,
        createdAt: { $gte: twoDaysAgo },
        $or: [
          { targetAudience: 'all' },
          { targetAudience: 'teachers' },
        ],
      }),
    ]);

    res.json({
      success: true,
      data: {
        classes: myClasses,
        students: myStudents,
        exams: myExams,
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

