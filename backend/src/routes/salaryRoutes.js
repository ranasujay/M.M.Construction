const express = require('express');
const router = express.Router();
const {
  generateSalary,
  generateAllSalaries,
  getSalaryRecords,
  markSalaryPaid,
  getDashboardStats,
} = require('../controllers/salaryController');
const { protect, authorize } = require('../middleware/auth');
const { mongoIdParam, validate } = require('../middleware/validators');

// All salary routes require auth + owner role
router.use(protect);
router.use(authorize('owner'));

router.get('/dashboard', getDashboardStats);
router.get('/', getSalaryRecords);
router.post('/generate', generateSalary);
router.post('/generate-all', generateAllSalaries);
router.patch('/:id/pay', mongoIdParam, validate, markSalaryPaid);

module.exports = router;
