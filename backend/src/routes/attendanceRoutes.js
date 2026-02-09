const express = require('express');
const router = express.Router();
const {
  markBulkAttendance,
  markAttendance,
  getDailyAttendance,
  getMonthlyAttendance,
  getAttendanceSummary,
  getCalendarData,
  getWorkerStats,
} = require('../controllers/attendanceController');
const { protect, authorize } = require('../middleware/auth');
const { attendanceRules, singleAttendanceRules, validate } = require('../middleware/validators');

// All attendance routes require auth + owner role
router.use(protect);
router.use(authorize('owner'));

router.get('/daily', getDailyAttendance);
router.get('/summary', getAttendanceSummary);
router.get('/calendar', getCalendarData);
router.get('/worker-stats/:workerId', getWorkerStats);
router.get('/monthly/:workerId', getMonthlyAttendance);
router.post('/', singleAttendanceRules, validate, markAttendance);
router.post('/bulk', attendanceRules, validate, markBulkAttendance);

module.exports = router;
