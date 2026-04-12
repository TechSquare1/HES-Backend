const Fees = require('../models/Fees');
const User = require('../models/User');

// @desc    Get dashboard stats for Nazim (Monthly-based)
// @route   GET /api/nazim/dashboard
// @access  Private/Nazim
exports.getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    const currentMonth = (today.getMonth() + 1).toString(); // 1-12
    const currentYear = today.getFullYear();

    // Get fees for current month only
    const currentMonthFees = await Fees.find({
      month: currentMonth,
      year: currentYear,
    }).populate('studentId', '_id');

    const totalStudents = await User.countDocuments({ role: 'student' });
    
    // Count unique students who are paid/unpaid for current month
    const paidStudentIds = new Set();
    const unpaidStudentIds = new Set();

    currentMonthFees.forEach((fee) => {
      const studentId = fee.studentId?._id || fee.studentId;
      if (!studentId) return;

      if (fee.status === 'paid') {
        paidStudentIds.add(studentId.toString());
        // Remove from unpaid if it was there
        unpaidStudentIds.delete(studentId.toString());
      } else {
        unpaidStudentIds.add(studentId.toString());
        // Remove from paid if it was there
        paidStudentIds.delete(studentId.toString());
      }
    });

    const paidCount = paidStudentIds.size;
    const unpaidCount = unpaidStudentIds.size;

    res.json({
      success: true,
      data: {
        totalStudents,
        paidCount, // Unique students paid for current month
        unpaidCount, // Unique students unpaid for current month
        currentMonth: currentMonth,
        currentYear: currentYear,
      },
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get all fees (Nazim)
// @route   GET /api/nazim/fees
// @access  Private/Nazim
exports.getAllFees = async (req, res) => {
  try {
    const { status, month, year } = req.query;
    
    let query = {};
    
    if (status && status !== 'all') {
      query.status = status;
    }
    
    if (month && year) {
      query.month = month;
      query.year = parseInt(year);
    } else if (year) {
      query.year = parseInt(year);
    }

    const fees = await Fees.find(query)
      .populate({
        path: 'studentId',
        select: 'name studentId classId parentPhone',
        populate: { path: 'classId', select: 'className' },
      })
      .sort({ dueDate: -1 });

    const today = new Date();
    const todayDay = today.getDate();

    const feesWithReminder = fees.map((fee) => {
      const feeObj = fee.toObject();
      const dueDate = fee.dueDate ? new Date(fee.dueDate) : null;

      // Fee is overdue after 10th of the due month
      let isOverdueReminder = false;
      if (fee.status !== 'paid' && dueDate) {
        const dueMonth = dueDate.getMonth();
        const dueYear = dueDate.getFullYear();
        const overdueDate = new Date(dueYear, dueMonth, 10);
        isOverdueReminder = today > overdueDate;
      }

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

// @desc    Create new fee record (single student)
// @route   POST /api/nazim/fees
// @access  Private/Nazim
exports.createFee = async (req, res) => {
  try {
    const { studentId, amount, dueDate, month, year, remarks } = req.body;

    // Validate required fields - amount can be 0 for simple paid/unpaid tracking
    if (!studentId || !dueDate) {
      return res.status(400).json({
        success: false,
        message: 'Please provide studentId and dueDate',
      });
    }

    // Check if student exists
    const student = await User.findOne({ _id: studentId, role: 'student' });
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found',
      });
    }

    // Check if fee already exists for this student in the same month/year
    if (month && year) {
      const existingFee = await Fees.findOne({
        studentId,
        month,
        year: parseInt(year),
      });

      if (existingFee) {
        return res.status(400).json({
          success: false,
          message: `Fee for ${month} ${year} already exists for this student`,
        });
      }
    }

    const fee = await Fees.create({
      studentId,
      amount: amount !== undefined ? parseFloat(amount) : 0,
      dueDate: new Date(dueDate),
      month: month || null,
      year: year ? parseInt(year) : null,
      remarks: remarks || '',
      status: 'pending',
      paidAmount: 0,
    });

    const populatedFee = await Fees.findById(fee._id).populate(
      'studentId',
      'name studentId'
    );

    res.status(201).json({
      success: true,
      message: 'Fee created successfully',
      data: populatedFee,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Bulk create fee records for ALL students for a month/year
// @route   POST /api/nazim/fees/bulk
// @access  Private/Nazim
exports.bulkCreateFees = async (req, res) => {
  try {
    const { month, year, dueDay } = req.body;

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

    // Default due date = 10th of the month (can be overridden by dueDay)
    const day = dueDay && Number.isInteger(dueDay) ? dueDay : 10;
    const dueDate = new Date(reportYear, reportMonth - 1, day);

    // Get all active students
    const students = await User.find({ role: 'student' }).select('_id');

    if (!students || students.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No students found to create fee records',
      });
    }

    let createdCount = 0;
    let skippedCount = 0;

    for (const student of students) {
      // Skip if fee already exists for this student/month/year
      const existingFee = await Fees.findOne({
        studentId: student._id,
        month: month.toString(),
        year: reportYear,
      });

      if (existingFee) {
        skippedCount++;
        continue;
      }

      await Fees.create({
        studentId: student._id,
        amount: 0,
        dueDate,
        month: month.toString(),
        year: reportYear,
        status: 'pending',
        paidAmount: 0,
      });

      createdCount++;
    }

    res.status(201).json({
      success: true,
      message: 'Fee records created for all students',
      data: {
        createdCount,
        skippedCount,
        totalStudents: students.length,
      },
    });
  } catch (error) {
    console.error('Bulk create fees error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Update fee record
// @route   PUT /api/nazim/fees/:id
// @access  Private/Nazim
exports.updateFee = async (req, res) => {
  try {
    const { amount, dueDate, status, paidAmount, paidDate, remarks } = req.body;

    const fee = await Fees.findById(req.params.id);
    if (!fee) {
      return res.status(404).json({
        success: false,
        message: 'Fee record not found',
      });
    }

    // Update fields if provided
    if (amount !== undefined) fee.amount = parseFloat(amount);
    if (dueDate) fee.dueDate = new Date(dueDate);
    if (remarks !== undefined) fee.remarks = remarks;

    // Handle status and payment
    if (status) {
      fee.status = status;
      
      if (status === 'paid') {
        fee.paidAmount = fee.amount;
        fee.paidDate = paidDate ? new Date(paidDate) : new Date();
      } else if (status === 'partial' && paidAmount !== undefined) {
        fee.paidAmount = parseFloat(paidAmount);
        fee.paidDate = paidDate ? new Date(paidDate) : new Date();
      } else if (status === 'pending') {
        fee.paidAmount = 0;
        fee.paidDate = null;
      }
    } else if (paidAmount !== undefined) {
      fee.paidAmount = parseFloat(paidAmount);
      if (fee.paidAmount >= fee.amount) {
        fee.status = 'paid';
        fee.paidDate = paidDate ? new Date(paidDate) : new Date();
      } else if (fee.paidAmount > 0) {
        fee.status = 'partial';
        fee.paidDate = paidDate ? new Date(paidDate) : new Date();
      }
    }

    await fee.save();

    const updatedFee = await Fees.findById(fee._id).populate(
      'studentId',
      'name studentId'
    );

    res.json({
      success: true,
      message: 'Fee updated successfully',
      data: updatedFee,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Delete fee record
// @route   DELETE /api/nazim/fees/:id
// @access  Private/Nazim
exports.deleteFee = async (req, res) => {
  try {
    const fee = await Fees.findByIdAndDelete(req.params.id);

    if (!fee) {
      return res.status(404).json({
        success: false,
        message: 'Fee record not found',
      });
    }

    res.json({
      success: true,
      message: 'Fee deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Bulk delete fee records
// @route   POST /api/nazim/fees/bulk-delete
// @access  Private/Nazim
exports.bulkDeleteFees = async (req, res) => {
  try {
    const { feeIds } = req.body;

    if (!feeIds || !Array.isArray(feeIds) || feeIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of fee IDs to delete',
      });
    }

    const result = await Fees.deleteMany({ _id: { $in: feeIds } });

    res.json({
      success: true,
      message: `${result.deletedCount} fee record(s) deleted`,
      data: { deletedCount: result.deletedCount },
    });
  } catch (error) {
    console.error('Bulk delete fees error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get all students (for fee creation)
// @route   GET /api/nazim/students
// @access  Private/Nazim
exports.getAllStudents = async (req, res) => {
  try {
    const students = await User.find({ role: 'student' })
      .select('name studentId parentPhone classId')
      .populate('classId', 'className')
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

// @desc    Get monthly fee collection report
// @route   GET /api/nazim/monthly-report
// @access  Private/Nazim
exports.getMonthlyFeeReport = async (req, res) => {
  try {
    const { month, year } = req.query;

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

    // Calculate date range for the month
    const startDate = new Date(reportYear, reportMonth - 1, 1);
    const endDate = new Date(reportYear, reportMonth, 0, 23, 59, 59);

    // Get all fees - search by dueDate range (primary) or month/year fields
    const fees = await Fees.find({
      $or: [
        // Search by dueDate range
        { dueDate: { $gte: startDate, $lte: endDate } },
        // Also search by month/year fields if they exist
        { month: month.toString(), year: reportYear },
        { month: reportMonth.toString(), year: reportYear },
      ]
    }).populate({
      path: 'studentId',
      select: 'name studentId fatherName classId',
      populate: { path: 'classId', select: 'className' }
    });

    // Calculate statistics (simplified - focus on paid/unpaid counts)
    let paidCount = 0;
    let unpaidCount = 0;
    let partialCount = 0;

    fees.forEach(fee => {
      if (fee.status === 'paid') {
        paidCount++;
      } else if (fee.status === 'partial') {
        partialCount++;
        unpaidCount++;
      } else {
        unpaidCount++;
      }
    });

    // Month name
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    res.json({
      success: true,
      data: {
        report: {
          month: monthNames[reportMonth - 1],
          year: reportYear,
        },
        summary: {
          totalStudents: fees.length,
          paidStudents: paidCount,
          unpaidStudents: unpaidCount,
          partialStudents: partialCount,
        },
        fees: fees.filter(fee => fee.studentId).map(fee => ({
          studentName: fee.studentId.name,
          studentId: fee.studentId.studentId,
          fatherName: fee.studentId.fatherName || '',
          className: fee.studentId.classId ? fee.studentId.classId.className : 'No Class',
          status: fee.status,
          dueDate: fee.dueDate,
          paidDate: fee.paidDate,
        })),
      },
    });
  } catch (error) {
    console.error('Monthly fee report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};