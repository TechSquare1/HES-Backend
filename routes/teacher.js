const express = require('express');
const router = express.Router();
const {
  getMyClasses,
  getMyStudents,
  getAllAvailableStudents,
  addStudentToClass,
  updateStudent,
  removeStudent,
  getMyExams,
  createExam,
  addExamResults,
  getExamResults,
  markAttendance,
  getClassAttendance,
  getStudentFees,
  getDashboardStats,
  getAnnouncements,
  getClassProgressReport,
  getMyClassResultCards,
  getMyClassExamResults,
} = require('../controllers/teacherController');
const { protect, authorize } = require('../middleware/auth');

// All routes require authentication and teacher role
router.use(protect);
router.use(authorize('teacher'));

// Dashboard
router.get('/dashboard', getDashboardStats);

// Classes
router.get('/classes', getMyClasses);

// Students
router.get('/students', getMyStudents);
router.get('/students/available', getAllAvailableStudents);
router.post('/students/:studentId/add-to-class', addStudentToClass);
router.put('/students/:id', updateStudent);
router.delete('/students/:id', removeStudent);

// Exams
router.get('/exams', getMyExams);
router.post('/exams', createExam);
router.put('/exams/:id/results', addExamResults);
router.get('/exams/:id/results', getExamResults);

// Attendance
router.get('/attendance/:classId', getClassAttendance);
router.post('/attendance', markAttendance);

// Reports
router.get('/reports/class', getClassProgressReport);

// Fees (view only)
router.get('/fees', getStudentFees);

// Announcements
router.get('/announcements', getAnnouncements);

// Result Cards
router.get('/result-cards', getMyClassResultCards);
router.get('/class-exam-results', getMyClassExamResults);

module.exports = router;

