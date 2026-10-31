const crypto = require('crypto');
const QRCode = require('qrcode');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const Class = require('../models/Class');
const Notification = require('../models/Notification');
const { buildQrPayload, parseQrPayload, getQrSecret } = require('../utils/qrToken');

// Pakistan time is UTC+5 all year (no daylight saving).
const PK_OFFSET_MS = 5 * 60 * 60 * 1000;

// Today's date in Pakistan as YYYY-MM-DD.
const getPkDateString = (now = new Date()) => {
  const pk = new Date(now.getTime() + PK_OFFSET_MS);
  const y = pk.getUTCFullYear();
  const m = String(pk.getUTCMonth() + 1).padStart(2, '0');
  const d = String(pk.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Same date handling as teacher attendance: stored at noon UTC of that day,
// matched with the UTC start/end of that day.
const getDayRange = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return {
    noon: new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0)),
    start: new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0)),
    end: new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999)),
  };
};

// Sunday is the off day (same rule as the teacher attendance screen).
const isSunday = (dateStr) => getDayRange(dateStr).noon.getUTCDay() === 0;

// The class a student belongs to: the class roster first (what teachers use),
// then the student's own classId.
const findStudentClass = async (student) => {
  let cls = await Class.findOne({ students: student._id, isActive: { $ne: false } })
    .select('className section');
  if (!cls && student.classId) {
    cls = await Class.findById(student.classId).select('className section');
  }
  return cls;
};

const studentInfo = (student, cls) => ({
  _id: student._id,
  name: student.name,
  fatherName: student.fatherName,
  studentId: student.studentId,
  gender: student.gender,
  profileImage: student.profileImage,
  className: cls ? `${cls.className}${cls.section ? ` - ${cls.section}` : ''}` : null,
});

// @desc    Mark a student present by scanning their QR code
// @route   POST /api/qr/scan
// @access  Private/Admin
exports.scanQr = async (req, res) => {
  try {
    const studentCode = parseQrPayload(req.body.code);
    if (!studentCode) {
      return res.status(400).json({
        success: false,
        result: 'invalid',
        message: 'Not a valid student QR code',
      });
    }

    const student = await User.findOne({ role: 'student', studentId: studentCode });
    if (!student) {
      return res.status(404).json({ success: false, result: 'not_found', message: 'Student not found' });
    }
    if (!student.isActive) {
      return res.status(400).json({ success: false, result: 'inactive', message: `${student.name} is deactivated` });
    }

    const cls = await findStudentClass(student);
    if (!cls) {
      return res.status(400).json({
        success: false,
        result: 'no_class',
        message: `${student.name} is not assigned to any class`,
        student: studentInfo(student, null),
      });
    }

    const dateStr = getPkDateString();
    if (isSunday(dateStr)) {
      return res.status(400).json({ success: false, result: 'off_day', message: 'Sunday is an off day' });
    }

    const { noon, start, end } = getDayRange(dateStr);
    const filter = { studentId: student._id, classId: cls._id, date: { $gte: start, $lte: end } };

    const existing = await Attendance.findOne(filter);
    if (existing && existing.status === 'present') {
      return res.json({
        success: true,
        result: 'already',
        message: 'Already marked present today',
        student: studentInfo(student, cls),
        date: dateStr,
      });
    }

    // Upsert keeps one record per student per day, even if two scans arrive together.
    const previous = await Attendance.findOneAndUpdate(
      filter,
      {
        $set: { status: 'present', markedBy: req.user._id },
        $setOnInsert: { date: noon, remarks: 'QR scan' },
      },
      { upsert: true, new: false }
    );

    res.json({
      success: true,
      result: previous ? 'updated' : 'marked',
      previousStatus: previous ? previous.status : null,
      message: previous ? `Changed from ${previous.status} to present` : 'Marked present',
      student: studentInfo(student, cls),
      date: dateStr,
    });
  } catch (error) {
    console.error('QR scan error:', error.message);
    res.status(500).json({ success: false, result: 'error', message: 'Failed to mark attendance. Please try again.' });
  }
};

// @desc    Today's QR attendance counts
// @route   GET /api/qr/today
// @access  Private/Admin
exports.getTodaySummary = async (req, res) => {
  try {
    const dateStr = getPkDateString();
    const { start, end } = getDayRange(dateStr);

    const presentIds = await Attendance.distinct('studentId', {
      date: { $gte: start, $lte: end },
      status: 'present',
    });

    const classes = await Class.find({ isActive: { $ne: false } }).select('students');
    const rosterIds = new Set();
    classes.forEach((c) => (c.students || []).forEach((id) => id && rosterIds.add(String(id))));
    const totalStudents = await User.countDocuments({
      _id: { $in: Array.from(rosterIds) },
      role: 'student',
      isActive: true,
    });

    res.json({
      success: true,
      data: { date: dateStr, isOffDay: isSunday(dateStr), present: presentIds.length, total: totalStudents },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Get (or regenerate) a student's QR code. Always the same QR for the same student.
// @route   GET /api/qr/student/:id
// @access  Private/Admin
exports.getStudentQr = async (req, res) => {
  try {
    const student = await User.findOne({ _id: req.params.id, role: 'student' });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    if (!student.studentId) {
      return res.status(400).json({ success: false, message: 'Student has no Student ID' });
    }

    const payload = buildQrPayload(student.studentId);
    const qrDataUrl = await QRCode.toDataURL(payload, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 600,
    });
    const cls = await findStudentClass(student);

    res.json({ success: true, data: { student: studentInfo(student, cls), qrDataUrl } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to generate QR code', error: error.message });
  }
};

// Core of the end-of-day job. Only classes that took attendance that day are
// processed, so holidays (no scans, no teacher marking) never mark anyone absent.
// Students who already have any record (present / absent / leave) are left alone.
const runAutoAbsent = async (dateStr) => {
  if (isSunday(dateStr)) {
    return { date: dateStr, skipped: 'sunday', classes: 0, markedAbsent: 0 };
  }

  const { noon, start, end } = getDayRange(dateStr);
  const activeClassIds = await Attendance.distinct('classId', { date: { $gte: start, $lte: end } });
  if (activeClassIds.length === 0) {
    return { date: dateStr, skipped: 'no_attendance_taken', classes: 0, markedAbsent: 0 };
  }

  const admin = await User.findOne({ role: 'admin', isActive: true }).select('_id');
  if (!admin) throw new Error('No active admin user found for markedBy');

  const message = `You were marked absent on ${noon.toLocaleDateString()}`;
  let markedAbsent = 0;

  for (const classId of activeClassIds) {
    const cls = await Class.findById(classId).select('students isActive');
    if (!cls || cls.isActive === false || !cls.students?.length) continue;

    const activeStudents = await User.find({
      _id: { $in: cls.students },
      role: 'student',
      isActive: true,
    }).select('_id');

    const alreadyMarked = await Attendance.distinct('studentId', {
      classId,
      date: { $gte: start, $lte: end },
    });
    const markedSet = new Set(alreadyMarked.map(String));
    const missing = activeStudents.filter((s) => !markedSet.has(String(s._id)));
    if (missing.length === 0) continue;

    for (const s of missing) {
      // Upsert so a re-run (or a teacher saving at the same moment) never creates duplicates.
      const prev = await Attendance.findOneAndUpdate(
        { studentId: s._id, classId, date: { $gte: start, $lte: end } },
        { $setOnInsert: { date: noon, status: 'absent', markedBy: admin._id, remarks: 'Auto-absent' } },
        { upsert: true, new: false }
      );
      if (!prev) {
        markedAbsent += 1;
        try {
          await Notification.create({
            userId: s._id,
            title: 'Absence Alert',
            message,
            type: 'attendance',
          });
        } catch (notifErr) {
          console.error('Non-fatal: failed to create absence notification:', notifErr.message);
        }
      }
    }
  }

  return { date: dateStr, classes: activeClassIds.length, markedAbsent };
};

const resolveDate = (body) => {
  if (body && /^\d{4}-\d{2}-\d{2}$/.test(body.date || '')) return body.date;
  // Default: the Pakistan date 30 minutes ago, so a run at 11:59 PM (or a few
  // minutes after midnight) always processes the day that is ending.
  return getPkDateString(new Date(Date.now() - 30 * 60 * 1000));
};

// @desc    End-of-day job: mark students with no record as absent
// @route   POST /api/qr/auto-absent   (called by the scheduled Cloudflare Worker)
// @access  Cron secret (x-cron-secret header)
exports.autoAbsentCron = async (req, res) => {
  try {
    const expected = process.env.CRON_SECRET || '';
    const given = String(req.headers['x-cron-secret'] || '');
    const ok =
      expected.length >= 16 &&
      given.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
    if (!ok) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    const result = await runAutoAbsent(resolveDate(req.body));
    console.log('Auto-absent result:', JSON.stringify(result));
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Auto-absent error:', error.message);
    res.status(500).json({ success: false, message: 'Auto-absent failed', error: error.message });
  }
};

// Fail fast at startup if QR_SECRET is missing (logged, not fatal).
try {
  getQrSecret();
} catch (e) {
  console.error(`⚠️ ${e.message}. QR attendance will not work until it is set.`);
}

exports._internal = { getPkDateString, getDayRange, runAutoAbsent };
