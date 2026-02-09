const express = require('express');
const router = express.Router();
const {
  giveAdvance,
  getAdvances,
  getWorkerMonthlyAdvances,
  deleteAdvance,
} = require('../controllers/advanceController');
const { protect, authorize } = require('../middleware/auth');
const { advanceRules, mongoIdParam, validate } = require('../middleware/validators');

// All advance routes require auth + owner role
router.use(protect);
router.use(authorize('owner'));

router.route('/').get(getAdvances).post(advanceRules, validate, giveAdvance);
router.get('/:workerId/monthly', getWorkerMonthlyAdvances);
router.delete('/:id', mongoIdParam, validate, deleteAdvance);

module.exports = router;
