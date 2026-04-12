const express = require('express');
const router = express.Router();
const {
  getMyAttendance,
  getMyResults,
  getResultByStudentId,
  getMyFees,
  getAnnouncements,
  getDashboardStats,
  getMyNotifications,
  markNotificationAsRead,
  getMyMonthlyReport,
  getMyResultCards,
  getMyClassExamResults,
  getMySchedule,
} = require('../controllers/studentController');
const { protect, authorize } = require('../middleware/auth');

// Dashboard (requires authentication)
router.get('/dashboard', protect, authorize('student'), getDashboardStats);

// Attendance (requires authentication)
router.get('/attendance', protect, authorize('student'), getMyAttendance);

// Results
router.get('/results', protect, authorize('student'), getMyResults);
router.get('/results/:studentId', getResultByStudentId); // Public route for result lookup

// Fees (requires authentication)
router.get('/fees', protect, authorize('student'), getMyFees);

// Announcements (requires authentication)
router.get('/announcements', protect, authorize('student'), getAnnouncements);

// Notifications
router.get('/notifications', protect, authorize('student'), getMyNotifications);
router.put('/notifications/:id/read', protect, authorize('student'), markNotificationAsRead);

// Monthly Report
router.get('/monthly-report', protect, authorize('student'), getMyMonthlyReport);

// Result Cards
router.get('/result-cards', protect, authorize('student'), getMyResultCards);
router.get('/class-exam-results', protect, authorize('student'), getMyClassExamResults);

// Schedule
router.get('/schedule', protect, authorize('student'), getMySchedule);

module.exports = router;

