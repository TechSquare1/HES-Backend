const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Exam = require('../models/Exam');
const Fees = require('../models/Fees');
const Announcement = require('../models/Announcement');
const Notification = require('../models/Notification');
const ResultCard = require('../models/ResultCard');
const ClassExamResult = require('../models/ClassExamResult');
const ClassSchedule = require('../models/ClassSchedule');

// @desc    Get my attendance
// @route   GET /api/student/attendance
// @access  Private/Student
exports.getMyAttendance = async (req, res) => {
  try {
    const attendance = await Attendance.find({ studentId: req.user.id })
      .populate('classId', 'className section')
      .sort({ date: -1 });

    // Calculate attendance stats
    const totalDays = attendance.length;
    const presentDays = attendance.filter(a => a.status === 'present').length;
    const absentDays = attendance.filter(a => a.status === 'absent').length;
    const leaveDays = attendance.filter(a => a.status === 'leave').length;
    const lateDays = attendance.filter(a => a.status === 'late').length;
    const attendancePercentage = totalDays > 0 ? (presentDays / totalDays) * 100 : 0;

    res.json({
      success: true,
      count: attendance.length,
      stats: {
        totalDays,
        presentDays,
        absentDays,
        leaveDays,
        lateDays,
        attendancePercentage: attendancePercentage.toFixed(2),
      },
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

// @desc    Get my results
// @route   GET /api/student/results
// @access  Private/Student
exports.getMyResults = async (req, res) => {
  try {
    const exams = await Exam.find({
      'results.studentId': req.user.id,
      isPublished: true,
    })
      .populate('classId', 'className section')
      .populate('teacherId', 'name')
      .sort({ examDate: -1 });

    // Extract student's results from each exam
    const results = exams.map(exam => {
      const studentResult = exam.results.find(
        r => r.studentId.toString() === req.user.id.toString()
      );
      return {
        examId: exam._id,
        examName: exam.examName,
        examDate: exam.examDate,
        totalMarks: exam.totalMarks,
        marks: studentResult.marks,
        grade: studentResult.grade,
        remarks: studentResult.remarks,
        className: exam.classId.className,
        teacherName: exam.teacherId.name,
      };
    });

    res.json({
      success: true,
      count: results.length,
      data: results,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get result by student ID
// @route   GET /api/student/results/:studentId
// @access  Public (for result lookup)
exports.getResultByStudentId = async (req, res) => {
  try {
    const { studentId } = req.params;

    const student = await require('../models/User').findOne({ studentId, role: 'student' });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found',
      });
    }

    const exams = await Exam.find({
      'results.studentId': student._id,
      isPublished: true,
    })
      .populate('classId', 'className section')
      .populate('teacherId', 'name')
      .sort({ examDate: -1 });

    const results = exams.map(exam => {
      const studentResult = exam.results.find(
        r => r.studentId.toString() === student._id.toString()
      );
      return {
        examId: exam._id,
        examName: exam.examName,
        examDate: exam.examDate,
        totalMarks: exam.totalMarks,
        marks: studentResult.marks,
        grade: studentResult.grade,
        remarks: studentResult.remarks,
        className: exam.classId.className,
        teacherName: exam.teacherId.name,
      };
    });

    res.json({
      success: true,
      student: {
        name: student.name,
        studentId: student.studentId,
      },
      count: results.length,
      data: results,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get my fees status
// @route   GET /api/student/fees
// @access  Private/Student
exports.getMyFees = async (req, res) => {
  try {
    const fees = await Fees.find({ studentId: req.user.id })
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

    // Calculate fees stats
    const totalFees = fees.reduce((sum, fee) => sum + fee.amount, 0);
    const paidFees = fees.reduce((sum, fee) => sum + fee.paidAmount, 0);
    const pendingFees = fees.filter(f => f.status === 'pending').length;
    const paidFeesCount = fees.filter(f => f.status === 'paid').length;

    res.json({
      success: true,
      count: feesWithReminder.length,
      stats: {
        totalFees,
        paidFees,
        remainingFees: totalFees - paidFees,
        pendingFees,
        paidFeesCount,
      },
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

// @desc    Get announcements
// @route   GET /api/student/announcements
// @access  Private/Student
exports.getAnnouncements = async (req, res) => {
  try {
    const announcements = await Announcement.find({
      isActive: true,
      $or: [
        { targetAudience: 'all' },
        { targetAudience: 'students' },
        { targetAudience: 'parents' },
      ],
    })
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

// @desc    Get dashboard stats
// @route   GET /api/student/dashboard
// @access  Private/Student
exports.getDashboardStats = async (req, res) => {
  try {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const today = new Date();

    const studentForExams = await User.findById(req.user.id);
    const studentClassId = studentForExams?.classId;

    // Students only see their own result cards — not class-wide exam PDFs
    const myResultCards = await ResultCard.find({ studentId: req.user.id })
      .select('examName examYear createdAt');
    const uniqueMyCardExams = new Set();
    myResultCards.forEach((r) => uniqueMyCardExams.add(`${r.examName}-${r.examYear}`));
    const resultCardCount = uniqueMyCardExams.size;

    const newExamsCount = await ResultCard.countDocuments({
      studentId: req.user.id,
      createdAt: { $gte: twoDaysAgo },
    });

    // Calculate current month attendance
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    const startOfMonth = new Date(currentYear, currentMonth, 1);
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);

    const [attendance, fees, announcements, newAnnouncements, studentFees] = await Promise.all([
      Attendance.countDocuments({
        studentId: req.user.id,
        date: { $gte: startOfMonth, $lte: endOfMonth },
        status: 'present'
      }),
      Fees.countDocuments({ studentId: req.user.id }),
      Announcement.countDocuments({
        isActive: true,
        $or: [
          { targetAudience: 'all' },
          { targetAudience: 'students' },
          { targetAudience: 'parents' },
        ],
      }),
      Announcement.countDocuments({
        isActive: true,
        createdAt: { $gte: twoDaysAgo },
        $or: [
          { targetAudience: 'all' },
          { targetAudience: 'students' },
          { targetAudience: 'parents' },
        ],
      }),
      // Get student's fees to check for overdue
      Fees.find({ studentId: req.user.id, status: { $ne: 'paid' } }),
    ]);

    // Calculate overdue fees (after 10th of the due month)
    let overdueFees = 0;
    studentFees.forEach((fee) => {
      if (fee.dueDate) {
        const dueDate = new Date(fee.dueDate);
        const dueMonth = dueDate.getMonth();
        const dueYear = dueDate.getFullYear();
        const overdueDate = new Date(dueYear, dueMonth, 10);
        if (today > overdueDate) {
          overdueFees++;
        }
      }
    });

    // Get student's class and teacher info
    const student = await User.findById(req.user.id).populate({
      path: 'classId',
      populate: { path: 'teacherId', select: 'name gender' },
    });
    const classInfo = student?.classId
      ? {
          className: student.classId.className || student.classId.name,
          section: student.classId.section,
          teacherName: student.classId.teacherId?.name || null,
          teacherGender: student.classId.teacherId?.gender || null,
        }
      : null;

    res.json({
      success: true,
      data: {
        attendance,
        exams: resultCardCount,
        classResults: 0,
        resultCards: resultCardCount,
        newExams: newExamsCount,
        fees,
        announcements,
        newAnnouncements,
        overdueFees,
        classInfo,
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

// @desc    Get my notifications
// @route   GET /api/student/notifications
// @access  Private/Student
exports.getMyNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50);

    const unreadCount = await Notification.countDocuments({
      userId: req.user.id,
      isRead: false,
    });

    res.json({
      success: true,
      count: notifications.length,
      unreadCount,
      data: notifications,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Mark notification as read
// @route   PUT /api/student/notifications/:id/read
// @access  Private/Student
exports.markNotificationAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    notification.isRead = true;
    await notification.save();

    res.json({
      success: true,
      message: 'Notification marked as read',
      data: notification,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get my monthly report
// @route   GET /api/student/monthly-report
// @access  Private/Student
exports.getMyMonthlyReport = async (req, res) => {
  try {
    const { month, year } = req.query;
    const User = require('../models/User');
    const Class = require('../models/Class');
    const Attendance = require('../models/Attendance');
    const Exam = require('../models/Exam');
    const Fees = require('../models/Fees');

    if (!month || !year) {
      return res.status(400).json({
        success: false,
        message: 'Please provide month and year',
      });
    }

    const reportMonth = parseInt(month);
    const reportYear = parseInt(year);

    if (reportMonth < 1 || reportMonth > 12) {
      return res.status(400).json({
        success: false,
        message: 'Invalid month',
      });
    }

    const student = await User.findById(req.user.id).populate('classId', 'className section');
    
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found',
      });
    }

    // Calculate date range for the month
    const startDate = new Date(reportYear, reportMonth - 1, 1);
    const endDate = new Date(reportYear, reportMonth, 0);
    const daysInMonth = endDate.getDate();

    // Get attendance for the month
    const attendanceRecords = await Attendance.find({
      studentId: student._id,
      date: {
        $gte: startDate,
        $lte: endDate,
      },
    });

    // Count attendance stats for the month (excluding Sundays)
    let presentDays = 0;
    let leaveDays = 0;
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
        if (record) {
          if (record.status === 'present') {
            presentDays++;
          } else if (record.status === 'leave') {
            leaveDays++;
          }
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

    // Process individual exam results
    const examResults = exams.map(exam => {
      const result = exam.results.find(r => r.studentId.toString() === student._id.toString());
      let status = 'Not Attempted';
      let percentage = 0;

      if (result) {
        percentage = (result.marks / exam.totalMarks) * 100;
        status = percentage >= 33 ? 'Pass' : 'Fail';
      }

      return {
        examName: exam.examName,
        examDate: exam.examDate,
        status: status,
        marks: result ? result.marks : 0,
        totalMarks: exam.totalMarks,
        percentage: Math.round(percentage),
      };
    });

    // Calculate overall exam statistics
    const passedExams = examResults.filter(exam => exam.status === 'Pass').length;
    const totalExams = examResults.length;
    let overallStatus = 'No Exams';

    if (totalExams > 0) {
      if (passedExams === totalExams) {
        overallStatus = 'Pass';
      } else if (passedExams > 0) {
        overallStatus = 'Partial Pass';
      } else {
        overallStatus = 'Fail';
      }
    }

    // Get fees for the month
    const fees = await Fees.find({
      studentId: student._id,
      month: month.toString(),
      year: reportYear,
    });

    // Check if fees were paid on time & overall status (Paid / Unpaid / N/A)
    let feesOnTime = 'N/A';
    let feesStatus = 'N/A';

    if (fees.length > 0) {
      const allPaidOnTime = fees.every(fee => {
        if (fee.status === 'paid' && fee.paidDate) {
          return fee.paidDate <= fee.dueDate;
        }
        return false;
      });
      feesOnTime = allPaidOnTime ? 'Yes' : 'No';

      const hasUnpaid = fees.some(fee => fee.status !== 'paid');
      feesStatus = hasUnpaid ? 'Unpaid' : 'Paid';
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
            leave: leaveDays,
            total: totalWorkingDays,
            percentage: totalWorkingDays > 0 ? Math.round((presentDays / totalWorkingDays) * 100) : 0,
          },
          exams: {
            status: overallStatus,
            passed: passedExams,
            total: totalExams,
            results: examResults,
          },
          fees: {
            onTime: feesOnTime,
            status: feesStatus,
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

// @desc    Get my result cards
// @route   GET /api/student/result-cards
// @access  Private/Student
exports.getMyResultCards = async (req, res) => {
  try {
    const resultCards = await ResultCard.find({ studentId: req.user.id })
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
    console.error('Get my result cards error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Class-wide exam results (full class PDF) — not exposed to students; they only see their own result cards.
// @route   GET /api/student/class-exam-results
// @access  Private/Student
exports.getMyClassExamResults = async (req, res) => {
  try {
    res.json({
      success: true,
      count: 0,
      data: [],
    });
  } catch (error) {
    console.error('Get my class exam results error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get my class schedule
// @route   GET /api/student/schedule
// @access  Private/Student
exports.getMySchedule = async (req, res) => {
  try {
    const student = await User.findById(req.user.id);
    if (!student || !student.classId) {
      return res.json({ success: true, data: null });
    }
    const schedule = await ClassSchedule.findOne({ classId: student.classId })
      .populate('classId', 'className section')
      .populate('teacherId', 'name');
    res.json({ success: true, data: schedule });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

