const express = require('express');
const router = express.Router();
const {
  getComplaints,
  getUnreadCount,
  getTargetOptions,
  createComplaint,
  updateComplaint,
  deleteComplaint,
  markRead,
  markAllRead,
  markSolved,
} = require('../controllers/complaintController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize('admin', 'teacher', 'student'));

router.get('/', getComplaints);
router.get('/unread-count', getUnreadCount);
router.get('/targets', getTargetOptions);
router.post('/', createComplaint);
router.post('/read-all', markAllRead);
router.post('/:id/solve', markSolved);
router.post('/:id/read', markRead);
router.put('/:id', updateComplaint);
router.delete('/:id', deleteComplaint);

module.exports = router;
