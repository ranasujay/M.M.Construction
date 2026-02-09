const express = require('express');
const router = express.Router();
const {
  addPayment,
  getBillPayments,
  getCustomerPayments,
  getPayments,
} = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');
const { paymentRules, validate } = require('../middleware/validators');

router.use(protect);

router.route('/').get(getPayments).post(paymentRules, validate, addPayment);
router.get('/bill/:billId', getBillPayments);
router.get('/customer/:customerId', getCustomerPayments);

module.exports = router;
