const express = require('express');
const router = express.Router();
const {
  createCustomer,
  getCustomers,
  getCustomer,
  getCustomerLedger,
  updateCustomer,
  getDueCustomers,
  getAdvanceCustomers,
} = require('../controllers/customerController');
const { protect } = require('../middleware/auth');
const { customerRules, mongoIdParam, validate } = require('../middleware/validators');

router.use(protect); // All customer routes require auth

router.get('/dues', getDueCustomers);
router.get('/advances', getAdvanceCustomers);
router.route('/').get(getCustomers).post(customerRules, validate, createCustomer);
router.route('/:id').get(mongoIdParam, validate, getCustomer).put(mongoIdParam, customerRules, validate, updateCustomer);
router.get('/:id/ledger', mongoIdParam, validate, getCustomerLedger);

module.exports = router;
