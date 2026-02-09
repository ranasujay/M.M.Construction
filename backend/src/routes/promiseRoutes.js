const express = require('express');
const router = express.Router();
const {
  createPromise,
  getPromises,
  getOverduePromises,
  updatePromise,
  getCustomerPromises,
} = require('../controllers/promiseController');
const { protect } = require('../middleware/auth');
const { promiseRules, mongoIdParam, validate } = require('../middleware/validators');

router.use(protect);

router.get('/overdue', getOverduePromises);
router.route('/').get(getPromises).post(promiseRules, validate, createPromise);
router.put('/:id', mongoIdParam, validate, updatePromise);
router.get('/customer/:customerId', getCustomerPromises);

module.exports = router;
