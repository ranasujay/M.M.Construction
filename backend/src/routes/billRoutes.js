const express = require('express');
const router = express.Router();
const {
  createBill,
  getBills,
  getBill,
  getBillProfit,
  updateBill,
  getBillStats,
  getChartData,
} = require('../controllers/billController');
const { protect, authorize } = require('../middleware/auth');
const { billRules, mongoIdParam, validate } = require('../middleware/validators');

router.use(protect);

router.get('/stats', getBillStats);
router.get('/chart-data', getChartData);
router.route('/').get(getBills).post(billRules, validate, createBill);
router.get('/:id/profit', authorize('owner'), mongoIdParam, validate, getBillProfit);
router.route('/:id').get(mongoIdParam, validate, getBill).put(mongoIdParam, validate, updateBill);

module.exports = router;
