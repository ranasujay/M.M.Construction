const express = require('express');
const router = express.Router();
const {
  createBill,
  getBills,
  getBill,
  updateBill,
  getBillStats,
  getChartData,
} = require('../controllers/billController');
const { protect } = require('../middleware/auth');
const { billRules, mongoIdParam, validate } = require('../middleware/validators');

router.use(protect);

router.get('/stats', getBillStats);
router.get('/chart-data', getChartData);
router.route('/').get(getBills).post(billRules, validate, createBill);
router.route('/:id').get(mongoIdParam, validate, getBill).put(mongoIdParam, validate, updateBill);

module.exports = router;
