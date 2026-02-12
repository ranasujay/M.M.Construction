const express = require('express');
const router = express.Router();
const {
  createCustomExpense,
  getCustomExpenses,
  updateCustomExpense,
  deleteCustomExpense,
} = require('../controllers/customExpenseController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize('owner'));

router.route('/')
  .get(getCustomExpenses)
  .post(createCustomExpense);

router.route('/:id')
  .put(updateCustomExpense)
  .delete(deleteCustomExpense);

module.exports = router;
