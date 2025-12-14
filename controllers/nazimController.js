const Fees = require('../models/Fees');
const User = require('../models/User');

// @desc    Get dashboard stats for Nazim
// @route   GET /api/nazim/dashboard
// @access  Private/Nazim
exports.getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    // Get fees statistics
    const allFees = await Fees.find();
    const monthlyFees = await Fees.find({
      dueDate: { $gte: startOfMonth, $lte: endOfMonth },
    });

    const totalStudents = await User.countDocuments({ role: 'student' });
    
    // Calculate totals
    let totalPending = 0;
    let totalPaid = 0;
    let totalOverdue = 0;

    allFees.forEach((fee) => {
      if (fee.status === 'paid') {
        totalPaid += fee.amount;
      } else if (fee.status === 'partial') {
        totalPaid += fee.paidAmount || 0;
        totalPending += fee.amount - (fee.paidAmount || 0);
      } else {
        totalPending += fee.amount;
      }

      // Check for overdue (after 10th of the month)
      if (fee.status !== 'paid' && fee.dueDate) {
        const dueDate = new Date(fee.dueDate);
        const dueMonth = dueDate.getMonth();
        const dueYear = dueDate.getFullYear();
        // Fee is overdue after 10th of the due month
        const overdueDate = new Date(dueYear, dueMonth, 10);
        if (today > overdueDate) {
          totalOverdue++;
        }
      }
    });

    res.json({
      success: true,
      data: {
        totalStudents,
        totalFees: allFees.length,
        totalPending,
        totalPaid,
        totalOverdue,
        monthlyFeesCount: monthlyFees.length,
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
      .populate('studentId', 'name studentId classId parentPhone')
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

// @desc    Create new fee record
// @route   POST /api/nazim/fees
// @access  Private/Nazim
exports.createFee = async (req, res) => {
  try {
    const { studentId, amount, dueDate, month, year, remarks } = req.body;

    // Validate required fields
    if (!studentId || !amount || !dueDate) {
      return res.status(400).json({
        success: false,
        message: 'Please provide studentId, amount, and dueDate',
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
      amount: parseFloat(amount),
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

    console.log('Fee Report Query - Month:', reportMonth, 'Year:', reportYear);
    console.log('Date Range:', startDate, 'to', endDate);

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

    console.log('Found fees:', fees.length);

    // Calculate statistics
    let totalAmount = 0;
    let totalPaid = 0;
    let totalPending = 0;
    let paidCount = 0;
    let unpaidCount = 0;
    let partialCount = 0;

    fees.forEach(fee => {
      totalAmount += fee.amount;
      if (fee.status === 'paid') {
        totalPaid += fee.amount;
        paidCount++;
      } else if (fee.status === 'partial') {
        totalPaid += fee.paidAmount || 0;
        totalPending += fee.amount - (fee.paidAmount || 0);
        partialCount++;
        unpaidCount++;
      } else {
        totalPending += fee.amount;
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
          totalAmount: totalAmount.toFixed(2),
          totalCollected: totalPaid.toFixed(2),
          totalPending: totalPending.toFixed(2),
          collectionRate: fees.length > 0 ? ((paidCount / fees.length) * 100).toFixed(2) : 0,
        },
        fees: fees.filter(fee => fee.studentId).map(fee => ({
          studentName: fee.studentId.name,
          studentId: fee.studentId.studentId,
          fatherName: fee.studentId.fatherName || '',
          className: fee.studentId.classId ? fee.studentId.classId.className : 'No Class',
          amount: fee.amount,
          paidAmount: fee.paidAmount || 0,
          pendingAmount: fee.amount - (fee.paidAmount || 0),
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