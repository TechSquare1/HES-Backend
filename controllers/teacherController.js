const Class = require('../models/Class');
const Exam = require('../models/Exam');
const Attendance = require('../models/Attendance');
const Fees = require('../models/Fees');
const User = require('../models/User');
const Announcement = require('../models/Announcement');
const ResultCard = require('../models/ResultCard');
const ClassExamResult = require('../models/ClassExamResult');
const ClassSchedule = require('../models/ClassSchedule');

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
      message: 'Failed to mark attendance. Please try again.',
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
      message: 'Failed to mark attendance. Please try again.',
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
      message: 'Failed to mark attendance. Please try again.',
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

    // Validate required fields
    if (!examName || !classId || !examDate) {
      return res.status(400).json({
        success: false,
        message: 'Please provide exam name, class, and date',
      });
    }

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
    console.error('Create exam error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark attendance. Please try again.',
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
      message: 'Failed to mark attendance. Please try again.',
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
      message: 'Failed to mark attendance. Please try again.',
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

    // Parse date safely to avoid timezone shifting (treat as UTC day)
    let attendanceDate;
    if (date) {
      // If date is in YYYY-MM-DD format, create date at noon UTC to avoid timezone issues
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        const [year, month, day] = date.split('-').map(Number);
        // Create date at noon UTC to avoid daylight saving issues
        attendanceDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
      } else {
        attendanceDate = new Date(date);
        // Normalize to noon UTC
        attendanceDate = new Date(Date.UTC(
          attendanceDate.getUTCFullYear(),
          attendanceDate.getUTCMonth(),
          attendanceDate.getUTCDate(),
          12, 0, 0, 0
        ));
      }
    } else {
      const now = new Date();
      attendanceDate = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        12, 0, 0, 0
      ));
    }

    // Bulk attendance marking
    if (attendanceList && Array.isArray(attendanceList)) {
      const results = [];
      const Notification = require('../models/Notification');
      const absentNotifications = [];

      // Pre-compute day boundaries once (same for every student)
      const startOfDay = new Date(Date.UTC(
        attendanceDate.getUTCFullYear(),
        attendanceDate.getUTCMonth(),
        attendanceDate.getUTCDate(),
        0, 0, 0, 0
      ));
      const endOfDay = new Date(Date.UTC(
        attendanceDate.getUTCFullYear(),
        attendanceDate.getUTCMonth(),
        attendanceDate.getUTCDate(),
        23, 59, 59, 999
      ));

      for (const item of attendanceList) {
        if (!item.studentId || !item.classId) continue; // skip invalid entries

        try {
          const existingAttendance = await Attendance.findOne({
            studentId: item.studentId,
            classId: item.classId,
            date: { $gte: startOfDay, $lte: endOfDay },
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

          if (item.status === 'absent') {
            absentNotifications.push({
              userId: item.studentId,
              title: 'Absence Alert',
              message: `You were marked absent on ${attendanceDate.toLocaleDateString()}`,
              type: 'attendance',
            });
          }
        } catch (itemError) {
          console.error(`Error processing attendance for student ${item.studentId}:`, itemError);
        }
      }

      // Best-effort notifications — never let this fail the attendance response
      try {
        if (absentNotifications.length > 0) {
          await Notification.insertMany(absentNotifications);
        }
      } catch (notifErr) {
        console.error('Non-fatal: failed to create absence notifications:', notifErr.message);
      }

      return res.status(201).json({
        success: true,
        message: 'Attendance marked successfully for all students',
        count: results.length,
        data: results,
      });
    }

    // Single attendance marking
    if (!studentId || !classId) {
      return res.status(400).json({
        success: false,
        message: 'studentId and classId are required',
      });
    }

    const startOfDaySingle = new Date(Date.UTC(
      attendanceDate.getUTCFullYear(),
      attendanceDate.getUTCMonth(),
      attendanceDate.getUTCDate(),
      0, 0, 0, 0
    ));
    const endOfDaySingle = new Date(Date.UTC(
      attendanceDate.getUTCFullYear(),
      attendanceDate.getUTCMonth(),
      attendanceDate.getUTCDate(),
      23, 59, 59, 999
    ));

    const existingAttendance = await Attendance.findOne({
      studentId,
      classId,
      date: { $gte: startOfDaySingle, $lte: endOfDaySingle },
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
      message: 'Failed to mark attendance. Please try again.',
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
      message: 'Failed to mark attendance. Please try again.',
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
      message: 'Failed to mark attendance. Please try again.',
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

    // Remove student from old class atomically
    if (student.classId) {
      await Class.findByIdAndUpdate(student.classId, { $pull: { students: student._id } });
    }
    // Add student to new class atomically
    await Class.findByIdAndUpdate(classId, { $addToSet: { students: student._id } });

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
    console.error('Add student to class error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark attendance. Please try again.',
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

      // Remove student from old class atomically
      if (student.classId) {
        await Class.findByIdAndUpdate(student.classId, { $pull: { students: student._id } });
      }
      // Add student to new class atomically
      await Class.findByIdAndUpdate(classId, { $addToSet: { students: student._id } });

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
      message: 'Failed to mark attendance. Please try again.',
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

      // Remove student from class atomically
      await Class.findByIdAndUpdate(student.classId, { $pull: { students: student._id } });

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
      message: 'Failed to mark attendance. Please try again.',
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
      message: 'Failed to mark attendance. Please try again.',
      error: error.message,
    });
  }
};

// @desc    Get announcements for teachers
// @route   GET /api/teacher/announcements
// @access  Private/Teacher
exports.getAnnouncements = async (req, res) => {
  try {
    const announcements = await Announcement.find({
      isActive: true,
      $or: [
        { targetAudience: 'all' },
        { targetAudience: 'teachers' },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      success: true,
      count: announcements.length,
      data: announcements,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to mark attendance. Please try again.',
      error: error.message,
    });
  }
};

// @desc    Get simple class progress report (monthly or yearly)
// @route   GET /api/teacher/reports/class
// @access  Private/Teacher
exports.getClassProgressReport = async (req, res) => {
  try {
    const { classId, type = 'monthly', month, year } = req.query;

    if (!classId) {
      return res.status(400).json({
        success: false,
        message: 'Class ID is required',
      });
    }

    // Verify class belongs to this teacher and get teacher name
    const cls = await Class.findOne({ _id: classId, teacherId: req.user.id })
      .populate('teacherId', 'name');
    if (!cls) {
      return res.status(404).json({
        success: false,
        message: 'Class not found or not assigned to you',
      });
    }

    const now = new Date();
    const reportYear = year ? parseInt(year, 10) : now.getFullYear();

    let startDate;
    let endDate;
    let periodLabel;
    let reportMonthForAttendance = null;

    if (type === 'yearly') {
      startDate = new Date(reportYear, 0, 1);
      endDate = new Date(reportYear, 11, 31, 23, 59, 59, 999);
      periodLabel = `${reportYear}`;
    } else {
      reportMonthForAttendance = month ? parseInt(month, 10) : now.getMonth() + 1;
      if (reportMonthForAttendance < 1 || reportMonthForAttendance > 12) {
        return res.status(400).json({
          success: false,
          message: 'Invalid month',
        });
      }
      startDate = new Date(reportYear, reportMonthForAttendance - 1, 1);
      endDate = new Date(reportYear, reportMonthForAttendance, 0, 23, 59, 59, 999);
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      periodLabel = `${monthNames[reportMonthForAttendance - 1]} ${reportYear}`;
    }

    // Fee snapshot: monthly uses selected month/year; yearly uses today's month number
    // in the *selected report year* (e.g. report year 2025 + March → March 2025), not whole-year totals.
    const feesMonth =
      type === 'yearly' ? now.getMonth() + 1 : reportMonthForAttendance;
    const feesYear = reportYear;

    // Attendance for this class and period
    const attendanceRecords = await Attendance.find({
      classId: classId,
      date: { $gte: startDate, $lte: endDate },
    });

    const totalMarked = attendanceRecords.length;
    const presentCount = attendanceRecords.filter(a => a.status === 'present').length;
    const absentCount = attendanceRecords.filter(a => a.status === 'absent').length;
    const leaveCount = attendanceRecords.filter(a => a.status === 'leave').length;
    const attendancePercentage =
      totalMarked > 0 ? Math.round((presentCount / totalMarked) * 100) : 0;

    // Get students in this class
    const classStudents = await User.find({ classId: classId, role: 'student' });
    const studentIds = classStudents.map(s => s._id);

    // Fees: single month (selected month for monthly, current month for yearly report)
    const feesQuery = {
      studentId: { $in: studentIds },
      year: feesYear,
      month: feesMonth.toString(),
    };

    const feesRecords = await Fees.find(feesQuery);

    /**
     * One bucket per student for a single month (feesMonth/feesYear):
     * - "paid": every fee row for that month is paid (and at least one row exists)
     * - "unpaid": no row for that month, OR any row is pending/partial
     */
    let paidCount = 0;
    let unpaidCount = 0;
    for (const id of studentIds) {
      const sid = id.toString();
      const records = feesRecords.filter((f) => f.studentId.toString() === sid);
      if (records.length === 0) {
        unpaidCount += 1;
        continue;
      }
      const allPaid = records.every((f) => f.status === 'paid');
      if (allPaid) paidCount += 1;
      else unpaidCount += 1;
    }

    // Get students in this class with detailed information
    const students = await User.find({
      classId: classId,
      role: 'student'
    }).select('name studentId').sort({ name: 1 });

    // Get attendance records for each student in this period
    const studentAttendanceMap = new Map();
    const studentFeesMap = new Map();
    const studentResultsMap = new Map();

    // Get attendance for each student
    for (const student of students) {
      try {
        const studentAttendance = await Attendance.find({
          studentId: student._id,
          date: { $gte: startDate, $lte: endDate },
        }).sort({ date: 1 });

        // Calculate attendance summary
        const totalDays = studentAttendance.length;
        const presentDays = studentAttendance.filter(a => a.status === 'present').length;
        const absentDays = studentAttendance.filter(a => a.status === 'absent').length;
        const leaveDays = studentAttendance.filter(a => a.status === 'leave').length;

        studentAttendanceMap.set(student._id.toString(), {
          totalDays,
          presentDays,
          absentDays,
          leaveDays,
          records: studentAttendance
        });

        // Get fees for this student (same month as class-level fee summary)
        const studentFeesQuery = {
          studentId: student._id,
          year: feesYear,
          month: feesMonth.toString(),
        };

        const studentFees = await Fees.find(studentFeesQuery);
        const paidFees = studentFees.filter(f => f.status === 'paid').length;
        const unpaidFees = studentFees.filter(f => f.status !== 'paid').length;

        studentFeesMap.set(student._id.toString(), {
          paid: paidFees,
          unpaid: unpaidFees,
          total: studentFees.length
        });

        // Get exam results for this student
        const studentResults = await ResultCard.find({
          studentId: student._id,
          createdAt: { $gte: startDate, $lte: endDate },
        });

        const studentExamResults = studentResults.map(result => ({
          examName: result.examName || 'Unknown Exam',
          examYear: result.examYear || '',
          obtainedMarks: result.obtainedMarks || 0,
          totalMarks: result.totalMarks || 0,
          percentage: result.totalMarks ?
            Math.round((result.obtainedMarks / result.totalMarks) * 100) : 0
        }));

        studentResultsMap.set(student._id.toString(), studentExamResults);
      } catch (studentError) {
        console.error(`Error processing student ${student._id}:`, studentError);
        // Continue with other students even if one fails
        studentAttendanceMap.set(student._id.toString(), {
          totalDays: 0, presentDays: 0, absentDays: 0, leaveDays: 0, records: []
        });
        studentFeesMap.set(student._id.toString(), {
          paid: 0, unpaid: 0, total: 0
        });
        studentResultsMap.set(student._id.toString(), []);
      }
    }

    // Get unique exam names for participation check
    const examNames = new Set();
    students.forEach(student => {
      const results = studentResultsMap.get(student._id.toString()) || [];
      results.forEach(result => {
        if (result.examName && result.examYear) {
          examNames.add(`${result.examName} ${result.examYear}`);
        }
      });
    });

    // Build detailed student records
    const studentRecords = students.map(student => {
      const attendance = studentAttendanceMap.get(student._id.toString()) || {
        totalDays: 0, presentDays: 0, absentDays: 0, leaveDays: 0, records: []
      };
      const fees = studentFeesMap.get(student._id.toString()) || {
        paid: 0, unpaid: 0, total: 0
      };
      const examResults = studentResultsMap.get(student._id.toString()) || [];

      return {
        id: student._id,
        studentId: student.studentId,
        name: student.name,
        attendance: {
          totalDays: attendance.totalDays,
          presentDays: attendance.presentDays,
          absentDays: attendance.absentDays,
          leaveDays: attendance.leaveDays,
          status: attendance.totalDays > 0 ?
            (attendance.presentDays / attendance.totalDays >= 0.8 ? 'Good' :
             attendance.presentDays / attendance.totalDays >= 0.6 ? 'Average' : 'Poor') : 'No Record'
        },
        fees: {
          paid: fees.paid,
          unpaid: fees.unpaid,
          status: fees.total > 0 ?
            (fees.paid === fees.total ? 'Paid' :
             fees.unpaid === 0 ? 'Paid' : 'Partial') : 'No Fees'
        },
        exams: examResults
      };
    });

    // Calculate participation rate after studentRecords is defined
    const participationRate = students.length > 0 ?
      Math.round((studentRecords.filter(s => s.exams.length > 0).length / students.length) * 100) : 0;

    res.json({
      success: true,
      data: {
        class: {
          id: cls._id,
          name: cls.className,
          section: cls.section || '',
          totalStudents: students.length,
          teacherName: cls.teacherId ? cls.teacherId.name : undefined,
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
          percentage: attendancePercentage,
        },
        fees: {
          paidCount,
          unpaidCount,
          month: feesMonth,
          year: feesYear,
        },
        exams: {
          examNames: Array.from(examNames),
          totalExams: 0, // Will be updated with actual exam count if needed
          totalResults: 0, // Will be updated with actual results count if needed
          averagePercentage: 0, // Will be updated with actual average if needed
          passRate: 0, // Will be updated with actual pass rate if needed
        },
      },
    });
  } catch (error) {
    console.error('Class progress report error:', error);
    console.error('Error stack:', error.stack);
    console.error('Request params:', req.query);
    res.status(500).json({
      success: false,
      message: 'Failed to generate class progress report. Please try again.',
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

    // Count unique exam name-year combinations
    const classExamResults = classIds.length > 0
      ? await ClassExamResult.find({ classId: { $in: classIds } }).select('examName examYear')
      : [];
    const uniqueClassExams = new Set();
    classExamResults.forEach(r => uniqueClassExams.add(`${r.examName}-${r.examYear}`));
    const classResultCount = uniqueClassExams.size;

    const resultCardResults = classIds.length > 0
      ? await ResultCard.find({ classId: { $in: classIds } }).select('examName examYear')
      : [];
    const uniqueResultCards = new Set();
    resultCardResults.forEach(r => uniqueResultCards.add(`${r.examName}-${r.examYear}`));
    const resultCardCount = uniqueResultCards.size;

    const [myClasses, myStudents, newAnnouncements, newClassExams, newResultCards] = await Promise.all([
      Class.countDocuments({ teacherId: req.user.id }),
      User.countDocuments({ classId: { $in: classIds } }),
      Announcement.countDocuments({ 
        isActive: true,
        createdAt: { $gte: twoDaysAgo },
        $or: [
          { targetAudience: 'all' },
          { targetAudience: 'teachers' },
        ],
      }),
      classIds.length > 0
        ? ClassExamResult.countDocuments({ classId: { $in: classIds }, createdAt: { $gte: twoDaysAgo } })
        : 0,
      classIds.length > 0
        ? ResultCard.countDocuments({ classId: { $in: classIds }, createdAt: { $gte: twoDaysAgo } })
        : 0,
    ]);

    res.json({
      success: true,
      data: {
        classes: myClasses,
        students: myStudents,
        exams: classResultCount + resultCardCount,
        classResults: classResultCount,
        resultCards: resultCardCount,
        newExams: newClassExams + newResultCards,
        newAnnouncements,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to mark attendance. Please try again.',
      error: error.message,
    });
  }
};

// @desc    Get result cards for my classes
// @route   GET /api/teacher/result-cards
// @access  Private/Teacher
exports.getMyClassResultCards = async (req, res) => {
  try {
    const { classId, examName, examYear } = req.query;

    // Get teacher's classes
    const classes = await Class.find({ teacherId: req.user.id });
    const classIds = classes.map((c) => c._id);

    const query = { classId: { $in: classIds } };
    if (classId) query.classId = classId;
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
    console.error('Get my class result cards error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark attendance. Please try again.',
      error: error.message,
    });
  }
};

// @desc    Get class exam results for my classes
// @route   GET /api/teacher/class-exam-results
// @access  Private/Teacher
exports.getMyClassExamResults = async (req, res) => {
  try {
    const { classId, examName, examYear } = req.query;

    // Get teacher's classes
    const classes = await Class.find({ teacherId: req.user.id });
    const classIds = classes.map((c) => c._id);

    const query = { classId: { $in: classIds } };
    if (classId) query.classId = classId;
    if (examName) query.examName = examName;
    if (examYear) query.examYear = parseInt(examYear);

    const classExamResults = await ClassExamResult.find(query)
      .populate({
        path: 'classId',
        select: 'className section',
        populate: { path: 'teacherId', select: 'name' }
      })
      .sort({ examYear: -1, createdAt: -1 });

    res.json({
      success: true,
      count: classExamResults.length,
      data: classExamResults,
    });
  } catch (error) {
    console.error('Get my class exam results error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark attendance. Please try again.',
      error: error.message,
    });
  }
};

// ── Class Schedule ──────────────────────────────────────────────

// @desc    Get schedule for a class
// @route   GET /api/teacher/schedule/:classId
// @access  Private/Teacher
exports.getClassSchedule = async (req, res) => {
  try {
    const schedule = await ClassSchedule.findOne({
      classId: req.params.classId,
      teacherId: req.user.id,
    });
    res.json({ success: true, data: schedule });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Create or update schedule for a class
// @route   PUT /api/teacher/schedule/:classId
// @access  Private/Teacher
exports.upsertClassSchedule = async (req, res) => {
  try {
    const { from, to } = req.body;
    if (!from || !to) {
      return res.status(400).json({ success: false, message: 'from and to are required' });
    }

    const schedule = await ClassSchedule.findOneAndUpdate(
      { classId: req.params.classId, teacherId: req.user.id },
      { from, to },
      { new: true, upsert: true, runValidators: true }
    );

    res.json({ success: true, message: 'Schedule saved', data: schedule });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

