const express = require('express');
const router = express.Router();
const {
  getAllTeachers,
  getAllStudents,
  getAllClasses,
  createClass,
  updateClass,
  deleteClass,
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
  getMonthlyAttendanceReport,
  getYearlyAttendanceReport,
  getMonthlyFeesReport,
  getYearlyFeesReport,
  getClassProgressReportAdmin,
  getExamReports,
  getExamReport,
  getExamsByClass,
  saveResultCard,
  getStudentResultCards,
  getClassResultCards,
  deleteResultCard,
  saveClassExamResult,
  getClassExamResults,
  deleteClassExamResult,
  getAllSchedules,
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');
const { uploadPDF, uploadImage } = require('../middleware/upload');

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
router.post('/classes', createClass);
router.put('/classes/:id', updateClass);
router.delete('/classes/:id', deleteClass);

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
router.get('/reports/attendance', getMonthlyAttendanceReport);
router.get('/reports/attendance/yearly', getYearlyAttendanceReport);
router.get('/reports/fees', getMonthlyFeesReport);
router.get('/reports/fees/yearly', getYearlyFeesReport);
router.get('/reports/class', getClassProgressReportAdmin);
router.get('/reports/exams', getExamReports);
router.get('/exam-report/:examId', getExamReport);
router.get('/exams/class/:classId', getExamsByClass);

// Result Cards
router.post('/result-cards', uploadImage, saveResultCard);
router.get('/result-cards/student/:studentId', getStudentResultCards);
router.get('/result-cards/class/:classId', getClassResultCards);
router.delete('/result-cards/:id', deleteResultCard);

// Class Exam Results
router.post('/class-exam-results', saveClassExamResult);
router.get('/class-exam-results', getClassExamResults);
router.delete('/class-exam-results/:id', deleteClassExamResult);

// Class Schedules
router.get('/schedules', getAllSchedules);

module.exports = router;

