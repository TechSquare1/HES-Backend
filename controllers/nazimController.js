const Fees = require('../models/Fees');
const User = require('../models/User');
const Class = require('../models/Class');
const {
  MONTH_NAMES,
  getNazimFeeScope,
  studentGenderFilter,
  parseMonthYear,
  monthYearQuery,
  isCurrentCalendarMonth,
  feeStatusForUi,
  dueDateForMonth,
} = require('../utils/nazimFeeHelpers');

async function getScopedStudentIds(feeScope) {
  const students = await User.find(studentGenderFilter(feeScope)).select('_id');
  return students.map((s) => s._id);
}

async function findFeeForStudentMonth(studentId, reportMonth, reportYear) {
  return Fees.findOne({
    studentId,
    ...monthYearQuery(reportMonth, reportYear),
  });
}

/** Ensure unpaid fee rows exist for the given students + month/year (any month). */
async function ensureFeesForStudents(studentIds, reportMonth, reportYear) {
  if (!studentIds.length) return 0;

  const dueDate = dueDateForMonth(reportMonth, reportYear);
  const monthStr = String(reportMonth);

  const existing = await Fees.find({
    studentId: { $in: studentIds },
    ...monthYearQuery(reportMonth, reportYear),
  }).select('studentId');

  const existingSet = new Set(existing.map((f) => f.studentId.toString()));
  const toCreate = studentIds.filter((id) => !existingSet.has(id.toString()));

  if (toCreate.length === 0) return 0;

  await Fees.insertMany(
    toCreate.map((studentId) => ({
      studentId,
      amount: 0,
      dueDate,
      month: monthStr,
      year: reportYear,
      status: 'pending',
      paidAmount: 0,
    })),
    { ordered: false }
  );

  return toCreate.length;
}

async function verifyFeeBelongsToScope(feeId, feeScope) {
  const fee = await Fees.findById(feeId).populate('studentId', 'gender role');
  if (!fee) return { ok: false, status: 404, message: 'Fee record not found' };
  if (!fee.studentId || fee.studentId.role !== 'student') {
    return { ok: false, status: 404, message: 'Student not found' };
  }
  if (fee.studentId.gender !== feeScope) {
    return { ok: false, status: 403, message: "Not authorized to manage this student's fees" };
  }
  return { ok: true, fee };
}

async function getScopedStudentsInClass(classId, feeScope) {
  return User.find({
    classId,
    ...studentGenderFilter(feeScope),
  })
    .select('name studentId gender classId')
    .sort({ name: 1 });
}

// @desc    Get dashboard stats for Nazim (current month, gender-scoped)
// @route   GET /api/nazim/dashboard
// @access  Private/Nazim
exports.getDashboardStats = async (req, res) => {
  try {
    const feeScope = getNazimFeeScope(req.user);
    const today = new Date();
    const reportMonth = today.getMonth() + 1;
    const reportYear = today.getFullYear();

    const scopedIds = await getScopedStudentIds(feeScope);
    const totalStudents = scopedIds.length;

    if (isCurrentCalendarMonth(reportMonth, reportYear) && scopedIds.length > 0) {
      await ensureFeesForStudents(scopedIds, reportMonth, reportYear);
    }

    const currentMonthFees = await Fees.find({
      studentId: { $in: scopedIds },
      ...monthYearQuery(reportMonth, reportYear),
    }).populate('studentId', '_id');

    const paidStudentIds = new Set();
    const unpaidStudentIds = new Set();

    currentMonthFees.forEach((fee) => {
      const studentId = fee.studentId?._id || fee.studentId;
      if (!studentId) return;
      const sid = studentId.toString();
      if (fee.status === 'paid') {
        paidStudentIds.add(sid);
        unpaidStudentIds.delete(sid);
      } else {
        unpaidStudentIds.add(sid);
        paidStudentIds.delete(sid);
      }
    });

    res.json({
      success: true,
      data: {
        totalStudents,
        paidCount: paidStudentIds.size,
        unpaidCount: unpaidStudentIds.size,
        currentMonth: reportMonth,
        currentYear: reportYear,
        feeScope,
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

// @desc    Classes that have students in this nazim's fee scope
// @route   GET /api/nazim/classes
// @access  Private/Nazim
exports.getFeeClasses = async (req, res) => {
  try {
    const feeScope = getNazimFeeScope(req.user);
    const classes = await Class.find({ isActive: { $ne: false } })
      .select('className section')
      .sort({ className: 1 });

    const result = [];
    for (const cls of classes) {
      const studentCount = await User.countDocuments({
        classId: cls._id,
        ...studentGenderFilter(feeScope),
      });
      if (studentCount > 0) {
        result.push({
          _id: cls._id,
          className: cls.className,
          section: cls.section,
          studentCount,
        });
      }
    }

    res.json({
      success: true,
      count: result.length,
      data: result,
      feeScope,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Fee sheet for a class + month (attendance-style list)
// @route   GET /api/nazim/fee-sheet
// @access  Private/Nazim
exports.getFeeSheet = async (req, res) => {
  try {
    const feeScope = getNazimFeeScope(req.user);
    const { month, year, classId } = req.query;

    const parsed = parseMonthYear(month, year);
    if (!parsed) {
      return res.status(400).json({ success: false, message: 'Please provide valid month and year' });
    }
    if (!classId) {
      return res.status(400).json({ success: false, message: 'Please provide classId' });
    }

    const { reportMonth, reportYear } = parsed;
    const isCurrent = isCurrentCalendarMonth(reportMonth, reportYear);

    const cls = await Class.findById(classId).select('className section');
    if (!cls) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    const studentsInClass = await getScopedStudentsInClass(classId, feeScope);

    // Same behavior for current, past, and future months: list all scoped students
    // and create missing unpaid fee rows so nazim can mark paid/unpaid.
    if (studentsInClass.length > 0) {
      await ensureFeesForStudents(
        studentsInClass.map((s) => s._id),
        reportMonth,
        reportYear
      );
    }

    const fees = await Fees.find({
      studentId: { $in: studentsInClass.map((s) => s._id) },
      ...monthYearQuery(reportMonth, reportYear),
    });

    const feeByStudent = {};
    fees.forEach((f) => {
      feeByStudent[f.studentId.toString()] = f;
    });

    const rows = studentsInClass.map((student) => {
      const fee = feeByStudent[student._id.toString()];
      return {
        studentId: student._id,
        name: student.name,
        studentIdNumber: student.studentId,
        feeId: fee ? fee._id : null,
        status: fee ? feeStatusForUi(fee.status) : 'unpaid',
        dbStatus: fee ? fee.status : null,
      };
    });

    res.json({
      success: true,
      data: {
        classId: cls._id,
        className: cls.className,
        month: reportMonth,
        year: reportYear,
        monthName: MONTH_NAMES[reportMonth - 1],
        isCurrentMonth: isCurrent,
        feeScope,
        students: rows,
      },
    });
  } catch (error) {
    console.error('Get fee sheet error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Bulk save fee statuses for a class (attendance-style save)
// @route   POST /api/nazim/fees/bulk-status
// @access  Private/Nazim
exports.bulkUpdateFeeStatus = async (req, res) => {
  try {
    const feeScope = getNazimFeeScope(req.user);
    const { month, year, classId, entries } = req.body;

    const parsed = parseMonthYear(month, year);
    if (!parsed) {
      return res.status(400).json({ success: false, message: 'Please provide valid month and year' });
    }
    if (!classId || !Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide classId and entries array',
      });
    }

    const { reportMonth, reportYear } = parsed;
    const dueDate = dueDateForMonth(reportMonth, reportYear);
    const monthStr = String(reportMonth);

    const cls = await Class.findById(classId).select('className');
    if (!cls) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    const classStudents = await getScopedStudentsInClass(classId, feeScope);
    const allowedIds = new Set(classStudents.map((s) => s._id.toString()));

    let updated = 0;
    let created = 0;
    let skipped = 0;

    for (const entry of entries) {
      const { studentId, status } = entry;
      if (!studentId || !['paid', 'unpaid'].includes(status)) {
        skipped++;
        continue;
      }
      if (!allowedIds.has(studentId.toString())) {
        skipped++;
        continue;
      }

      const dbStatus = status === 'paid' ? 'paid' : 'pending';
      let fee = await findFeeForStudentMonth(studentId, reportMonth, reportYear);

      if (!fee) {
        // Create for any month (past / current / future) so nazim can mark fees freely
        await Fees.create({
          studentId,
          amount: 0,
          dueDate,
          month: monthStr,
          year: reportYear,
          status: dbStatus,
          paidAmount: 0,
          paidDate: dbStatus === 'paid' ? new Date() : null,
        });
        created++;
        continue;
      }

      fee.status = dbStatus;
      if (dbStatus === 'paid') {
        fee.paidDate = new Date();
        fee.paidAmount = fee.amount || 0;
      } else {
        fee.paidDate = null;
        fee.paidAmount = 0;
      }
      await fee.save();
      updated++;
    }

    res.json({
      success: true,
      message: 'Fee statuses saved',
      data: { updated, created, skipped },
    });
  } catch (error) {
    console.error('Bulk update fee status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get all fees (gender-scoped)
// @route   GET /api/nazim/fees
// @access  Private/Nazim
exports.getAllFees = async (req, res) => {
  try {
    const feeScope = getNazimFeeScope(req.user);
    const scopedIds = await getScopedStudentIds(feeScope);
    const { status, month, year } = req.query;

    let query = { studentId: { $in: scopedIds } };

    if (status && status !== 'all') {
      if (status === 'unpaid') {
        query.status = { $in: ['pending', 'partial'] };
      } else {
        query.status = status;
      }
    }

    if (month && year) {
      const monthYearParsed = parseMonthYear(month, year);
      if (monthYearParsed) {
        query = {
          ...query,
          ...monthYearQuery(monthYearParsed.reportMonth, monthYearParsed.reportYear),
        };
      }
    } else if (year) {
      query.year = parseInt(year, 10);
    }

    const fees = await Fees.find(query)
      .populate({
        path: 'studentId',
        select: 'name studentId classId parentPhone gender',
        populate: { path: 'classId', select: 'className' },
      })
      .sort({ dueDate: -1 });

    const feesWithReminder = fees.map((fee) => {
      const feeObj = fee.toObject();
      const dueDate = fee.dueDate ? new Date(fee.dueDate) : null;
      let isOverdueReminder = false;
      if (fee.status !== 'paid' && dueDate) {
        const overdueDate = new Date(dueDate.getFullYear(), dueDate.getMonth(), 10);
        isOverdueReminder = new Date() > overdueDate;
      }
      feeObj.isOverdueReminder = isOverdueReminder;
      feeObj.uiStatus = feeStatusForUi(fee.status);
      return feeObj;
    });

    res.json({
      success: true,
      count: feesWithReminder.length,
      data: feesWithReminder,
      feeScope,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Create new fee record (single student, scoped)
// @route   POST /api/nazim/fees
// @access  Private/Nazim
exports.createFee = async (req, res) => {
  try {
    const feeScope = getNazimFeeScope(req.user);
    const { studentId, amount, dueDate, month, year, remarks } = req.body;

    if (!studentId || !dueDate) {
      return res.status(400).json({
        success: false,
        message: 'Please provide studentId and dueDate',
      });
    }

    const student = await User.findOne({ _id: studentId, ...studentGenderFilter(feeScope) });
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found or not in your fee scope',
      });
    }

    if (month && year) {
      const monthYearParsed = parseMonthYear(month, year);
      if (monthYearParsed) {
        const existingFee = await findFeeForStudentMonth(
          studentId,
          monthYearParsed.reportMonth,
          monthYearParsed.reportYear
        );
        if (existingFee) {
          return res.status(400).json({
            success: false,
            message: `Fee for ${month} ${year} already exists for this student`,
          });
        }
      }
    }

    const fee = await Fees.create({
      studentId,
      amount: amount !== undefined ? parseFloat(amount) : 0,
      dueDate: new Date(dueDate),
      month: month || null,
      year: year ? parseInt(year, 10) : null,
      remarks: remarks || '',
      status: 'pending',
      paidAmount: 0,
    });

    const populatedFee = await Fees.findById(fee._id).populate('studentId', 'name studentId');

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

// @desc    Bulk create fee records for scoped students for a month/year
// @route   POST /api/nazim/fees/bulk
// @access  Private/Nazim
exports.bulkCreateFees = async (req, res) => {
  try {
    const feeScope = getNazimFeeScope(req.user);
    const { month, year, dueDay } = req.body;

    const parsed = parseMonthYear(month, year);
    if (!parsed) {
      return res.status(400).json({
        success: false,
        message: 'Please provide month and year',
      });
    }

    const { reportMonth, reportYear } = parsed;
    const dueDate = dueDateForMonth(reportMonth, reportYear, dueDay);
    const monthStr = String(reportMonth);

    const students = await User.find(studentGenderFilter(feeScope)).select('_id');

    if (!students.length) {
      return res.status(400).json({
        success: false,
        message: 'No students found in your fee scope',
      });
    }

    let createdCount = 0;
    let skippedCount = 0;

    for (const student of students) {
      const existingFee = await findFeeForStudentMonth(student._id, reportMonth, reportYear);
      if (existingFee) {
        skippedCount++;
        continue;
      }

      await Fees.create({
        studentId: student._id,
        amount: 0,
        dueDate,
        month: monthStr,
        year: reportYear,
        status: 'pending',
        paidAmount: 0,
      });
      createdCount++;
    }

    res.status(201).json({
      success: true,
      message: 'Fee records created',
      data: {
        createdCount,
        skippedCount,
        totalStudents: students.length,
        feeScope,
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

// @desc    Update fee record (scoped)
// @route   PUT /api/nazim/fees/:id
// @access  Private/Nazim
exports.updateFee = async (req, res) => {
  try {
    const feeScope = getNazimFeeScope(req.user);
    const check = await verifyFeeBelongsToScope(req.params.id, feeScope);
    if (!check.ok) {
      return res.status(check.status).json({ success: false, message: check.message });
    }

    const fee = check.fee;
    const { amount, dueDate, status, paidAmount, paidDate, remarks } = req.body;

    if (amount !== undefined) fee.amount = parseFloat(amount);
    if (dueDate) fee.dueDate = new Date(dueDate);
    if (remarks !== undefined) fee.remarks = remarks;

    if (status) {
      if (status === 'unpaid' || status === 'pending') {
        fee.status = 'pending';
        fee.paidAmount = 0;
        fee.paidDate = null;
      } else if (status === 'paid') {
        fee.status = 'paid';
        fee.paidAmount = fee.amount || 0;
        fee.paidDate = paidDate ? new Date(paidDate) : new Date();
      } else if (status === 'partial') {
        fee.status = 'pending';
        fee.paidAmount = 0;
        fee.paidDate = null;
      }
    } else if (paidAmount !== undefined) {
      fee.paidAmount = parseFloat(paidAmount);
      if (fee.paidAmount >= fee.amount) {
        fee.status = 'paid';
        fee.paidDate = paidDate ? new Date(paidDate) : new Date();
      } else {
        fee.status = 'pending';
        fee.paidDate = null;
      }
    }

    await fee.save();

    const updatedFee = await Fees.findById(fee._id).populate('studentId', 'name studentId');

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

// @desc    Delete fee record (scoped)
// @route   DELETE /api/nazim/fees/:id
// @access  Private/Nazim
exports.deleteFee = async (req, res) => {
  try {
    const feeScope = getNazimFeeScope(req.user);
    const check = await verifyFeeBelongsToScope(req.params.id, feeScope);
    if (!check.ok) {
      return res.status(check.status).json({ success: false, message: check.message });
    }

    await Fees.findByIdAndDelete(req.params.id);

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

// @desc    Bulk delete fee records (scoped)
// @route   POST /api/nazim/fees/bulk-delete
// @access  Private/Nazim
exports.bulkDeleteFees = async (req, res) => {
  try {
    const feeScope = getNazimFeeScope(req.user);
    const scopedIds = await getScopedStudentIds(feeScope);
    const { feeIds } = req.body;

    if (!feeIds || !Array.isArray(feeIds) || feeIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of fee IDs to delete',
      });
    }

    const result = await Fees.deleteMany({
      _id: { $in: feeIds },
      studentId: { $in: scopedIds },
    });

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

// @desc    Get students in nazim fee scope
// @route   GET /api/nazim/students
// @access  Private/Nazim
exports.getAllStudents = async (req, res) => {
  try {
    const feeScope = getNazimFeeScope(req.user);
    const students = await User.find(studentGenderFilter(feeScope))
      .select('name studentId parentPhone classId gender')
      .populate('classId', 'className')
      .sort({ name: 1 });

    res.json({
      success: true,
      count: students.length,
      data: students,
      feeScope,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get monthly fee collection report (gender-scoped)
// @route   GET /api/nazim/monthly-report
// @access  Private/Nazim
exports.getMonthlyFeeReport = async (req, res) => {
  try {
    const feeScope = getNazimFeeScope(req.user);
    const scopedIds = await getScopedStudentIds(feeScope);
    const { month, year } = req.query;

    const parsed = parseMonthYear(month, year);
    if (!parsed) {
      return res.status(400).json({
        success: false,
        message: 'Please provide month and year',
      });
    }

    const { reportMonth, reportYear } = parsed;
    const startDate = new Date(reportYear, reportMonth - 1, 1);
    const endDate = new Date(reportYear, reportMonth, 0, 23, 59, 59);

    const fees = await Fees.find({
      studentId: { $in: scopedIds },
      $or: [
        { dueDate: { $gte: startDate, $lte: endDate } },
        ...monthYearQuery(reportMonth, reportYear).$or,
      ],
    }).populate({
      path: 'studentId',
      select: 'name studentId fatherName classId gender',
      populate: { path: 'classId', select: 'className' },
    });

    let paidCount = 0;
    let unpaidCount = 0;

    fees.forEach((fee) => {
      if (fee.status === 'paid') {
        paidCount++;
      } else {
        unpaidCount++;
      }
    });

    const scopeLabel = feeScope === 'female' ? 'Girls' : 'Boys';

    res.json({
      success: true,
      data: {
        report: {
          month: MONTH_NAMES[reportMonth - 1],
          year: reportYear,
          feeScope,
          scopeLabel,
        },
        summary: {
          totalStudents: fees.length,
          paidStudents: paidCount,
          unpaidStudents: unpaidCount,
        },
        fees: fees
          .filter((fee) => fee.studentId)
          .map((fee) => ({
            studentName: fee.studentId.name,
            studentId: fee.studentId.studentId,
            fatherName: fee.studentId.fatherName || '',
            className: fee.studentId.classId ? fee.studentId.classId.className : 'No Class',
            status: feeStatusForUi(fee.status),
            dueDate: fee.dueDate,
            paidDate: fee.paidDate,
          }))
          .sort((a, b) => {
            const order = { paid: 0, unpaid: 1 };
            return (order[a.status] ?? 1) - (order[b.status] ?? 1);
          }),
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
