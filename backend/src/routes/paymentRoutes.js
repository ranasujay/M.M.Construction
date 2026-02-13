const express = require('express');
const router = express.Router();
const {
  addPayment,
  updatePayment,
  deletePayment,
  getCustomerPayments,
  getPayments,
} = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');
const { paymentRules, validate } = require('../middleware/validators');

router.use(protect);

router.route('/').get(getPayments).post(paymentRules, validate, addPayment);
router.get('/customer/:customerId', getCustomerPayments);
router.route('/:id').put(updatePayment).delete(deletePayment);

module.exports = router;
