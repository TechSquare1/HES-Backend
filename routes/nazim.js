const express = require('express');
const router = express.Router();
const {
  getDashboardStats, getAllFees, createFee, updateFee, deleteFee, bulkDeleteFees,
  getAllStudents, getMonthlyFeeReport, bulkCreateFees,
  getFeeClasses, getFeeSheet, bulkUpdateFeeStatus,
} = require('../controllers/nazimController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize('nazim'));

router.get('/dashboard', getDashboardStats);
router.get('/classes', getFeeClasses);
router.get('/fee-sheet', getFeeSheet);
router.get('/fees', getAllFees);
router.post('/fees', createFee);
router.post('/fees/bulk', bulkCreateFees);
router.post('/fees/bulk-status', bulkUpdateFeeStatus);
router.post('/fees/bulk-delete', bulkDeleteFees);
router.put('/fees/:id', updateFee);
router.delete('/fees/:id', deleteFee);
router.get('/students', getAllStudents);
router.get('/monthly-report', getMonthlyFeeReport);

module.exports = router;
