const express = require('express');
const router = express.Router();
const {
  createPurchase,
  getPurchases,
  getPurchase,
  updatePurchase,
  getPurchaseStats,
  getPurchaseExpenses,
  getSupplierNames,
} = require('../controllers/purchaseController');
const { protect, authorize } = require('../middleware/auth');

// All routes require auth
router.use(protect);

// Stats & Reports (must be before /:id)
router.get('/stats', authorize('owner'), getPurchaseStats);
router.get('/expenses', authorize('owner'), getPurchaseExpenses);
router.get('/supplier-names', getSupplierNames);

router.route('/')
  .get(getPurchases)
  .post(createPurchase);

router.route('/:id')
  .get(getPurchase)
  .put(updatePurchase);

module.exports = router;
