const express = require('express');
const router = express.Router();
const {
  createSupplier,
  getSuppliers,
  getSupplier,
  updateSupplier,
  paySupplier,
  getSupplierPayments,
  getSupplierLedger,
  updateSupplierPayment,
  deleteSupplierPayment,
} = require('../controllers/supplierController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize('owner'));

router.route('/')
  .get(getSuppliers)
  .post(createSupplier);

router.route('/:id')
  .get(getSupplier)
  .put(updateSupplier);

router.post('/:id/pay', paySupplier);
router.get('/:id/payments', getSupplierPayments);
router.get('/:id/ledger', getSupplierLedger);
router.route('/:id/payments/:paymentId')
  .put(updateSupplierPayment)
  .delete(deleteSupplierPayment);

module.exports = router;
