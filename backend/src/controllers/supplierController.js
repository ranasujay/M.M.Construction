const mongoose = require('mongoose');
const Supplier = require('../models/Supplier');
const SupplierPayment = require('../models/SupplierPayment');
const PurchaseBill = require('../models/PurchaseBill');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { logActivity } = require('../utils/activityLogger');

/**
 * Recalculate supplier ledger totals from all their purchase bills & payments
 */
const recalcSupplierLedger = async (supplierId) => {
  const supplierDoc = await Supplier.findById(supplierId);
  const openingBalance = supplierDoc?.openingBalance || 0;

  const purchaseResult = await PurchaseBill.aggregate([
    { $match: { supplier: new mongoose.Types.ObjectId(supplierId) } },
    { $group: { _id: null, totalPurchased: { $sum: '$grandTotal' } } },
  ]);

  const payResult = await SupplierPayment.aggregate([
    { $match: { supplier: new mongoose.Types.ObjectId(supplierId) } },
    { $group: { _id: null, totalPaid: { $sum: '$amount' } } },
  ]);

  const totalPurchased = (purchaseResult[0]?.totalPurchased || 0) + openingBalance;
  const totalPaid = payResult[0]?.totalPaid || 0;

  const currentDue = Math.max(0, Math.round((totalPurchased - totalPaid) * 100) / 100);
  const advance = Math.max(0, Math.round((totalPaid - totalPurchased) * 100) / 100);

  await Supplier.findByIdAndUpdate(supplierId, {
    totalPurchased,
    totalPaid,
    currentDue,
    advanceBalance: advance,
  });
};

/**
 * @desc    Create supplier
 * @route   POST /api/suppliers
 */
const createSupplier = asyncHandler(async (req, res) => {
  const { name, phone, address, openingBalance, notes } = req.body;

  if (!name || !name.trim()) throw new AppError('Supplier name is required', 400);

  const supplier = await Supplier.create({
    name: name.trim(),
    phone: phone || '',
    address: address || '',
    openingBalance: openingBalance || 0,
    totalPurchased: openingBalance || 0,
    currentDue: openingBalance || 0,
    notes: notes || '',
    createdBy: req.user._id,
  });

  logActivity({
    action: 'SUPPLIER_CREATED',
    entity: 'supplier',
    entityId: supplier._id,
    description: `Supplier "${supplier.name}" created`,
    performedBy: req.user._id,
  });

  res.status(201).json({ success: true, data: supplier });
});

/**
 * @desc    Get all suppliers
 * @route   GET /api/suppliers
 */
const getSuppliers = asyncHandler(async (req, res) => {
  const { active, search } = req.query;
  const filter = {};
  if (active !== undefined) filter.isActive = active === 'true';
  if (search) filter.name = { $regex: search, $options: 'i' };

  const suppliers = await Supplier.find(filter)
    .populate('createdBy', 'name')
    .sort('name');

  res.json({ success: true, count: suppliers.length, data: suppliers });
});

/**
 * @desc    Get single supplier with ledger details
 * @route   GET /api/suppliers/:id
 */
const getSupplier = asyncHandler(async (req, res) => {
  const supplier = await Supplier.findById(req.params.id).populate('createdBy', 'name');
  if (!supplier) throw new AppError('Supplier not found', 404);
  res.json({ success: true, data: supplier });
});

/**
 * @desc    Update supplier
 * @route   PUT /api/suppliers/:id
 */
const updateSupplier = asyncHandler(async (req, res) => {
  const supplier = await Supplier.findById(req.params.id);
  if (!supplier) throw new AppError('Supplier not found', 404);

  const allowed = ['name', 'phone', 'address', 'notes', 'isActive'];
  allowed.forEach((field) => {
    if (req.body[field] !== undefined) supplier[field] = req.body[field];
  });

  // Handle opening balance update
  if (req.body.openingBalance !== undefined) {
    supplier.openingBalance = parseFloat(req.body.openingBalance) || 0;
  }

  await supplier.save();
  await recalcSupplierLedger(supplier._id);

  const updated = await Supplier.findById(supplier._id).populate('createdBy', 'name');

  logActivity({
    action: 'SUPPLIER_UPDATED',
    entity: 'supplier',
    entityId: supplier._id,
    description: `Supplier "${supplier.name}" updated`,
    performedBy: req.user._id,
  });

  res.json({ success: true, data: updated });
});

/**
 * @desc    Record payment to supplier
 * @route   POST /api/suppliers/:id/pay
 */
const paySupplier = asyncHandler(async (req, res) => {
  const { amount, mode, referenceNumber, notes, purchaseBill } = req.body;

  if (!amount || parseFloat(amount) <= 0) {
    throw new AppError('Payment amount must be greater than 0', 400);
  }

  const supplier = await Supplier.findById(req.params.id);
  if (!supplier) throw new AppError('Supplier not found', 404);

  const payment = await SupplierPayment.create({
    supplier: supplier._id,
    purchaseBill: purchaseBill || null,
    amount: parseFloat(amount),
    mode: mode || 'Cash',
    referenceNumber: referenceNumber || '',
    notes: notes || '',
    paidBy: req.user._id,
  });

  await recalcSupplierLedger(supplier._id);

  logActivity({
    action: 'SUPPLIER_PAYMENT',
    entity: 'supplierPayment',
    entityId: payment._id,
    description: `₹${payment.amount} paid to supplier "${supplier.name}" via ${payment.mode}`,
    metadata: { supplierId: supplier._id, amount: payment.amount, mode: payment.mode },
    performedBy: req.user._id,
  });

  const updated = await Supplier.findById(supplier._id);
  res.status(201).json({ success: true, data: { payment, supplier: updated } });
});

/**
 * @desc    Get supplier payment history
 * @route   GET /api/suppliers/:id/payments
 */
const getSupplierPayments = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const filter = { supplier: req.params.id };

  const total = await SupplierPayment.countDocuments(filter);
  const payments = await SupplierPayment.find(filter)
    .populate('paidBy', 'name')
    .populate('purchaseBill', 'billNumber')
    .sort('-createdAt')
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  res.json({
    success: true,
    count: payments.length,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: parseInt(page),
    data: payments,
  });
});

/**
 * @desc    Get supplier ledger (combined purchases + payments timeline)
 * @route   GET /api/suppliers/:id/ledger
 */
const getSupplierLedger = asyncHandler(async (req, res) => {
  const supplier = await Supplier.findById(req.params.id);
  if (!supplier) throw new AppError('Supplier not found', 404);

  const [purchases, payments] = await Promise.all([
    PurchaseBill.find({ supplier: req.params.id })
      .select('billNumber grandTotal purchaseDate createdBy')
      .populate('createdBy', 'name')
      .sort('-purchaseDate'),
    SupplierPayment.find({ supplier: req.params.id })
      .populate('paidBy', 'name')
      .sort('-createdAt'),
  ]);

  // Merge into timeline
  const ledger = [];
  purchases.forEach((p) => {
    ledger.push({
      type: 'PURCHASE',
      date: p.purchaseDate,
      description: `Purchase ${p.billNumber}`,
      amount: p.grandTotal,
      ref: p._id,
      billNumber: p.billNumber,
      by: p.createdBy?.name,
    });
  });
  payments.forEach((p) => {
    ledger.push({
      type: 'PAYMENT',
      date: p.createdAt,
      description: `Payment via ${p.mode}${p.referenceNumber ? ` (${p.referenceNumber})` : ''}`,
      amount: p.amount,
      ref: p._id,
      paymentId: p._id,
      mode: p.mode,
      referenceNumber: p.referenceNumber || '',
      by: p.paidBy?.name,
      notes: p.notes,
    });
  });

  ledger.sort((a, b) => new Date(b.date) - new Date(a.date));

  res.json({ success: true, data: { supplier, ledger } });
});

/**
 * @desc    Update supplier payment
 * @route   PUT /api/suppliers/:id/payments/:paymentId
 */
const updateSupplierPayment = asyncHandler(async (req, res) => {
  const payment = await SupplierPayment.findOne({ _id: req.params.paymentId, supplier: req.params.id });
  if (!payment) throw new AppError('Payment not found', 404);

  const { amount, mode, referenceNumber, notes } = req.body;
  const oldAmount = payment.amount;

  if (amount !== undefined) payment.amount = parseFloat(amount);
  if (mode !== undefined) payment.mode = mode;
  if (referenceNumber !== undefined) payment.referenceNumber = referenceNumber;
  if (notes !== undefined) payment.notes = notes;

  await payment.save();
  await recalcSupplierLedger(req.params.id);

  const supplier = await Supplier.findById(req.params.id);

  logActivity({
    action: 'SUPPLIER_PAYMENT_UPDATED',
    entity: 'supplierPayment',
    entityId: payment._id,
    description: `Supplier payment updated for "${supplier?.name}" — ₹${oldAmount} → ₹${payment.amount}`,
    metadata: { supplierId: req.params.id, oldAmount, newAmount: payment.amount },
    performedBy: req.user._id,
  });

  res.json({ success: true, data: payment });
});

/**
 * @desc    Delete supplier payment
 * @route   DELETE /api/suppliers/:id/payments/:paymentId
 */
const deleteSupplierPayment = asyncHandler(async (req, res) => {
  const payment = await SupplierPayment.findOne({ _id: req.params.paymentId, supplier: req.params.id });
  if (!payment) throw new AppError('Payment not found', 404);

  const amount = payment.amount;
  const supplier = await Supplier.findById(req.params.id);
  await payment.deleteOne();
  await recalcSupplierLedger(req.params.id);

  logActivity({
    action: 'SUPPLIER_PAYMENT_DELETED',
    entity: 'supplierPayment',
    entityId: req.params.paymentId,
    description: `Supplier payment ₹${amount} deleted for "${supplier?.name}"`,
    metadata: { supplierId: req.params.id, amount },
    performedBy: req.user._id,
  });

  res.json({ success: true, message: 'Payment deleted' });
});

module.exports = {
  createSupplier,
  getSuppliers,
  getSupplier,
  updateSupplier,
  paySupplier,
  getSupplierPayments,
  getSupplierLedger,
  recalcSupplierLedger,
  updateSupplierPayment,
  deleteSupplierPayment,
};
