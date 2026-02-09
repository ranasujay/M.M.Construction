const express = require('express');
const router = express.Router();
const {
  billsReport,
  dueReport,
  paymentReport,
  customerLedgerReport,
} = require('../controllers/reportController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/bills', billsReport);
router.get('/dues', dueReport);
router.get('/payments', paymentReport);
router.get('/ledger/:customerId', customerLedgerReport);

module.exports = router;
