const express = require('express');
const router = express.Router();
const {
  scanQr,
  getTodaySummary,
  getStudentQr,
  autoAbsentCron,
} = require('../controllers/qrAttendanceController');
const { protect, authorize } = require('../middleware/auth');

// End-of-day auto-absent job (protected by CRON_SECRET header, not a user login)
router.post('/auto-absent', autoAbsentCron);

// Everything else: admin only
router.use(protect);
router.use(authorize('admin'));

router.post('/scan', scanQr);
router.get('/today', getTodaySummary);
router.get('/student/:id', getStudentQr);

module.exports = router;
