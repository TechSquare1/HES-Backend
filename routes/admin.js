const express = require('express');
const router = express.Router();
const {
  getAllTeachers,
  getAllStudents,
  getAllClasses,
  createTeacher,
  createStudent,
  getAllNazims,
  createNazim,
  updateStudent,
  updateUser,
  changeUserPassword,
  deleteUser,
  getAllExams,
  getAllAttendance,
  getAllFees,
  createAnnouncement,
  getAllAnnouncements,
  updateAnnouncement,
  deleteAnnouncement,
  getDashboardStats,
  getMonthlyReport,
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');
const { uploadPDF } = require('../middleware/upload');

// All routes require authentication and admin role
router.use(protect);
router.use(authorize('admin'));

// Dashboard
router.get('/dashboard', getDashboardStats);

// Teacher Management
router.get('/teachers', getAllTeachers);
router.post('/teachers', createTeacher);

// Nazim Management
router.get('/nazims', getAllNazims);
router.post('/nazims', createNazim);

// Student Management
router.get('/students', getAllStudents);
router.post('/students', createStudent);
router.put('/students/:id', updateStudent);

// Class Management
router.get('/classes', getAllClasses);

// User Management
router.put('/users/:id', updateUser);
router.put('/users/:id/password', changeUserPassword);
router.delete('/users/:id', deleteUser);

// Exam Management
router.get('/exams', getAllExams);

// Attendance Management
router.get('/attendance', getAllAttendance);

// Fees Management
router.get('/fees', getAllFees);

// Announcement Management
router.get('/announcements', getAllAnnouncements);
router.post('/announcements', uploadPDF, createAnnouncement);
router.put('/announcements/:id', updateAnnouncement);
router.delete('/announcements/:id', deleteAnnouncement);

// Reports
router.get('/reports/monthly', getMonthlyReport);

module.exports = router;

