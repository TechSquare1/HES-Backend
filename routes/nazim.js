const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getAllFees,
  createFee,
  updateFee,
  deleteFee,
  bulkDeleteFees,
  getAllStudents,
  getMonthlyFeeReport,
  bulkCreateFees,
} = require('../controllers/nazimController');
const { protect, authorize } = require('../middleware/auth');

// All routes require authentication and nazim role
router.use(protect);
router.use(authorize('nazim'));

// Dashboard
router.get('/dashboard', getDashboardStats);

// Fees Management (full CRUD)
router.get('/fees', getAllFees);
router.post('/fees', createFee);
router.post('/fees/bulk', bulkCreateFees);
router.post('/fees/bulk-delete', bulkDeleteFees);
router.put('/fees/:id', updateFee);
router.delete('/fees/:id', deleteFee);

// Students (for fee creation dropdown)
router.get('/students', getAllStudents);

// Monthly Fee Report
router.get('/monthly-report', getMonthlyFeeReport);

module.exports = router;
