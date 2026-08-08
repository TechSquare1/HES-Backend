const Complaint = require('../models/Complaint');
const { COMPLAINT_CATEGORIES } = require('../models/Complaint');
const User = require('../models/User');
const Class = require('../models/Class');

const STUDENT_CATEGORIES = [
  'app_issue',
  'teacher_related',
  'fees_issue',
  'attendance_issue',
  'other',
];
const TEACHER_CATEGORIES = [
  'app_issue',
  'student_related',
  'fees_issue',
  'attendance_issue',
  'other',
];

function categoriesForRole(role) {
  if (role === 'student') return STUDENT_CATEGORIES;
  if (role === 'teacher') return TEACHER_CATEGORIES;
  return COMPLAINT_CATEGORIES;
}

function canViewComplaint(complaint, user) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  const uid = user._id.toString();
  if (complaint.fromUserId && complaint.fromUserId.toString() === uid) return true;
  const fromId = complaint.fromUserId?._id
    ? complaint.fromUserId._id.toString()
    : complaint.fromUserId?.toString?.();
  if (fromId === uid) return true;
  const targets = (complaint.toUserIds || []).map((id) =>
    (id._id ? id._id : id).toString()
  );
  return targets.includes(uid);
}

function isAuthor(complaint, user) {
  const fromId = complaint.fromUserId?._id
    ? complaint.fromUserId._id.toString()
    : complaint.fromUserId?.toString?.();
  return fromId === user._id.toString();
}

async function validateTeacherTargets(teacherId, toUserIds) {
  const classes = await Class.find({
    teacherId,
    isActive: { $ne: false },
  }).select('_id students');

  const allowed = new Set();
  const classIds = classes.map((cls) => cls._id);
  classes.forEach((cls) => {
    (cls.students || []).forEach((sid) => allowed.add(sid.toString()));
  });

  if (classIds.length > 0) {
    const byClassField = await User.find({
      role: 'student',
      classId: { $in: classIds },
      isActive: { $ne: false },
    }).select('_id');
    byClassField.forEach((s) => allowed.add(s._id.toString()));
  }

  const invalid = toUserIds.filter((id) => !allowed.has(id.toString()));
  return { ok: invalid.length === 0, invalid };
}

async function validateAdminTargets(toUserIds) {
  const users = await User.find({
    _id: { $in: toUserIds },
    role: { $in: ['student', 'teacher'] },
    isActive: { $ne: false },
  }).select('_id role');

  if (users.length !== toUserIds.length) {
    return { ok: false, users };
  }
  return { ok: true, users };
}

function populateFields() {
  return [
    { path: 'fromUserId', select: 'name role studentId teacherId' },
    { path: 'toUserIds', select: 'name role studentId teacherId' },
    { path: 'classId', select: 'className section' },
  ];
}

// @desc    List complaints visible to current user
// @route   GET /api/complaints
exports.getComplaints = async (req, res) => {
  try {
    const user = req.user;
    const complaints = await Complaint.find(visibleQuery(user))
      .populate(populateFields())
      .sort({ createdAt: -1 })
      .limit(200);

    res.json({
      success: true,
      count: complaints.length,
      data: complaints,
    });
  } catch (error) {
    console.error('Get complaints error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

function visibleQuery(user) {
  if (user.role === 'admin') return {};
  return {
    $or: [{ fromUserId: user._id }, { toUserIds: user._id }],
  };
}

// @desc    Optional recipient lists for complaint form
// @route   GET /api/complaints/targets
exports.getTargetOptions = async (req, res) => {
  try {
    const user = req.user;

    if (user.role === 'teacher') {
      const classes = await Class.find({
        teacherId: user._id,
        isActive: { $ne: false },
      })
        .populate('students', 'name studentId')
        .select('className section students')
        .sort({ className: 1 });
      return res.json({ success: true, type: 'students', data: classes });
    }

    if (user.role === 'admin') {
      const type = req.query.type === 'teacher' ? 'teacher' : 'student';
      if (type === 'teacher') {
        const teachers = await User.find({
          role: 'teacher',
          isActive: { $ne: false },
        })
          .select('name teacherId email')
          .sort({ name: 1 });
        return res.json({ success: true, type: 'teachers', data: teachers });
      }
      const classes = await Class.find({ isActive: { $ne: false } })
        .populate('students', 'name studentId')
        .select('className section students')
        .sort({ className: 1 });
      return res.json({ success: true, type: 'students', data: classes });
    }

    if (user.role === 'student') {
      const me = await User.findById(user._id).select('classId');
      let teachers = [];
      if (me?.classId) {
        const cls = await Class.findById(me.classId)
          .populate('teacherId', 'name teacherId email')
          .select('teacherId');
        if (cls?.teacherId) teachers = [cls.teacherId];
      }
      // Also include any other teachers assigned (fallback: active teachers limited)
      if (teachers.length === 0) {
        teachers = await User.find({
          role: 'teacher',
          isActive: { $ne: false },
        })
          .select('name teacherId email')
          .sort({ name: 1 })
          .limit(50);
      }
      return res.json({ success: true, type: 'teachers', data: teachers });
    }

    return res.status(403).json({ success: false, message: 'Not authorized' });
  } catch (error) {
    console.error('Get target options error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Counts for dashboard (total visible + unread)
// @route   GET /api/complaints/unread-count
exports.getUnreadCount = async (req, res) => {
  try {
    const user = req.user;
    const total = await Complaint.countDocuments(visibleQuery(user));

    let unreadQuery;
    if (user.role === 'admin') {
      unreadQuery = {
        status: { $ne: 'solved' },
        readBy: { $ne: user._id },
      };
    } else {
      unreadQuery = {
        toUserIds: user._id,
        fromUserId: { $ne: user._id },
        readBy: { $ne: user._id },
        status: { $ne: 'solved' },
      };
    }

    const unread = await Complaint.countDocuments(unreadQuery);
    res.json({
      success: true,
      count: total,
      total,
      unread,
    });
  } catch (error) {
    console.error('Unread count error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Create complaint
// @route   POST /api/complaints
exports.createComplaint = async (req, res) => {
  try {
    const user = req.user;
    const role = user.role;

    if (!['student', 'teacher', 'admin'].includes(role)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to create complaints',
      });
    }

    const { category, message, toUserIds, classId } = req.body;
    const allowedCats = categoriesForRole(role);

    if (!category || !allowedCats.includes(category)) {
      return res.status(400).json({
        success: false,
        message: 'Please select a valid category',
      });
    }

    const text = (message || '').trim();
    if (!text) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a message',
      });
    }
    if (text.length > 2000) {
      return res.status(400).json({
        success: false,
        message: 'Message cannot exceed 2000 characters',
      });
    }

    let targets = Array.isArray(toUserIds)
      ? [...new Set(toUserIds.map((id) => id.toString()))]
      : [];
    let resolvedClassId = classId || null;

    // Recipients optional for all roles — only validate when user selected some
    if (targets.length === 0) {
      resolvedClassId = null;
    } else if (role === 'teacher') {
      const check = await validateTeacherTargets(user._id, targets);
      if (!check.ok) {
        return res.status(403).json({
          success: false,
          message: 'You can only send complaints to students in your classes',
        });
      }
      const students = await User.find({
        _id: { $in: targets },
        role: 'student',
      }).select('_id');
      if (students.length !== targets.length) {
        return res.status(400).json({
          success: false,
          message: 'Invalid student selection',
        });
      }
    } else if (role === 'admin') {
      const check = await validateAdminTargets(targets);
      if (!check.ok) {
        return res.status(400).json({
          success: false,
          message: 'Invalid recipient selection',
        });
      }
    } else if (role === 'student') {
      // Students may optionally notify teachers
      const teachers = await User.find({
        _id: { $in: targets },
        role: 'teacher',
        isActive: { $ne: false },
      }).select('_id');
      if (teachers.length !== targets.length) {
        return res.status(400).json({
          success: false,
          message: 'Invalid teacher selection',
        });
      }
      resolvedClassId = null;
    }

    const complaint = await Complaint.create({
      fromUserId: user._id,
      fromRole: role,
      category,
      message: text,
      toUserIds: targets,
      classId: resolvedClassId,
      readBy: [user._id],
      status: 'open',
    });

    const populated = await Complaint.findById(complaint._id).populate(
      populateFields()
    );

    res.status(201).json({
      success: true,
      message: 'Complaint submitted',
      data: populated,
    });
  } catch (error) {
    console.error('Create complaint error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Update own complaint
// @route   PUT /api/complaints/:id
exports.updateComplaint = async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found',
      });
    }

    if (!isAuthor(complaint, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'You can only edit your own complaints',
      });
    }

    const { category, message, toUserIds, classId } = req.body;
    const role = req.user.role;
    const allowedCats = categoriesForRole(role);

    if (category !== undefined) {
      if (!allowedCats.includes(category)) {
        return res.status(400).json({
          success: false,
          message: 'Please select a valid category',
        });
      }
      complaint.category = category;
    }

    if (message !== undefined) {
      const text = String(message).trim();
      if (!text) {
        return res.status(400).json({
          success: false,
          message: 'Please enter a message',
        });
      }
      if (text.length > 2000) {
        return res.status(400).json({
          success: false,
          message: 'Message cannot exceed 2000 characters',
        });
      }
      complaint.message = text;
    }

    if (Array.isArray(toUserIds)) {
      const targets = [...new Set(toUserIds.map((id) => id.toString()))];
      if (targets.length === 0) {
        complaint.toUserIds = [];
        complaint.classId = null;
      } else if (role === 'teacher') {
        const check = await validateTeacherTargets(req.user._id, targets);
        if (!check.ok) {
          return res.status(403).json({
            success: false,
            message: 'You can only send complaints to students in your classes',
          });
        }
        complaint.toUserIds = targets;
        if (classId !== undefined) complaint.classId = classId || null;
      } else if (role === 'admin') {
        const check = await validateAdminTargets(targets);
        if (!check.ok) {
          return res.status(400).json({
            success: false,
            message: 'Invalid recipient selection',
          });
        }
        complaint.toUserIds = targets;
      } else if (role === 'student') {
        const teachers = await User.find({
          _id: { $in: targets },
          role: 'teacher',
          isActive: { $ne: false },
        }).select('_id');
        if (teachers.length !== targets.length) {
          return res.status(400).json({
            success: false,
            message: 'Invalid teacher selection',
          });
        }
        complaint.toUserIds = targets;
        complaint.classId = null;
      }
    }

    await complaint.save();
    const populated = await Complaint.findById(complaint._id).populate(
      populateFields()
    );

    res.json({
      success: true,
      message: 'Complaint updated',
      data: populated,
    });
  } catch (error) {
    console.error('Update complaint error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Mark complaint as solved (author or admin)
// @route   POST /api/complaints/:id/solve
exports.markSolved = async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found',
      });
    }

    if (!canViewComplaint(complaint, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
    }

    if (!isAuthor(complaint, req.user) && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only the author or admin can mark as solved',
      });
    }

    complaint.status = 'solved';
    complaint.solvedAt = new Date();
    complaint.solvedBy = req.user._id;
    await complaint.save();

    const populated = await Complaint.findById(complaint._id).populate(
      populateFields()
    );

    res.json({
      success: true,
      message: 'Complaint marked as solved',
      data: populated,
    });
  } catch (error) {
    console.error('Mark solved error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Delete complaint (author or admin)
// @route   DELETE /api/complaints/:id
exports.deleteComplaint = async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found',
      });
    }

    if (!isAuthor(complaint, req.user) && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this complaint',
      });
    }

    await complaint.deleteOne();
    res.json({ success: true, message: 'Complaint deleted' });
  } catch (error) {
    console.error('Delete complaint error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Mark complaint as read for current user
// @route   POST /api/complaints/:id/read
exports.markRead = async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found',
      });
    }

    if (!canViewComplaint(complaint, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
    }

    const uid = req.user._id;
    if (!complaint.readBy.some((id) => id.toString() === uid.toString())) {
      complaint.readBy.push(uid);
      await complaint.save();
    }

    res.json({ success: true, message: 'Marked as read' });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Mark all visible unread as read
// @route   POST /api/complaints/read-all
exports.markAllRead = async (req, res) => {
  try {
    const user = req.user;
    let query;

    if (user.role === 'admin') {
      query = { fromRole: 'student', readBy: { $ne: user._id } };
    } else {
      query = {
        toUserIds: user._id,
        fromUserId: { $ne: user._id },
        readBy: { $ne: user._id },
      };
    }

    await Complaint.updateMany(query, { $addToSet: { readBy: user._id } });
    res.json({ success: true, message: 'All marked as read' });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};
