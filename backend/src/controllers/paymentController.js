const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const Customer = require('../models/Customer');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { logActivity } = require('../utils/activityLogger');
const { recalcCustomerLedger } = require('./billController');

/* ───────────────────────────────────────────────────────────────────
 * POST /api/payments — Add Payment (simple)
 * Body: { customer, amount, mode, referenceNumber, notes }
 * ─────────────────────────────────────────────────────────────────── */
const addPayment = asyncHandler(async (req, res) => {
  const { customer: customerId, amount, mode, referenceNumber, notes, lessAmount } = req.body;

  const totalAmount = Math.round(parseFloat(amount || 0) * 100) / 100;
  const totalLess = Math.round(parseFloat(lessAmount || 0) * 100) / 100;

  if (totalAmount <= 0 && totalLess <= 0) throw new AppError('Payment or less amount must be > 0', 400);

  const customer = await Customer.findById(customerId);
  if (!customer) throw new AppError('Customer not found', 404);

  const payment = await Payment.create({
    customer: customerId,
    amount: totalAmount,
    mode,
    referenceNumber,
    notes: notes || '',
    lessAmount: totalLess,
    receivedBy: req.user._id,
  });

  // Recalculate customer ledger
  await recalcCustomerLedger(customerId);

  const populated = await Payment.findById(payment._id)
    .populate('customer', 'name phone')
    .populate('receivedBy', 'name');

  const descParts = [];
  if (totalAmount > 0) descParts.push(`₹${totalAmount}`);
  if (totalLess > 0) descParts.push(`Less ₹${totalLess}`);

  logActivity({
    action: 'PAYMENT_ADDED',
    entity: 'payment',
    entityId: payment._id,
    description: `Payment ${descParts.join(' + ')} from "${customer.name}" via ${mode}`,
    metadata: { customerId, amount: totalAmount, lessAmount: totalLess, mode },
    performedBy: req.user._id,
  });

  res.status(201).json({ success: true, data: populated });
});

/* ───────────────────────────────────────────────────────────────────
 * PUT /api/payments/:id — Update Payment
 * ─────────────────────────────────────────────────────────────────── */
const updatePayment = asyncHandler(async (req, res) => {
  const { customer: newCustomerId, amount, mode, referenceNumber, notes, lessAmount } = req.body;

  const payment = await Payment.findById(req.params.id);
  if (!payment) throw new AppError('Payment not found', 404);

  const oldCustomerId = payment.customer;

  // If customer is being changed, verify new customer exists
  if (newCustomerId && newCustomerId.toString() !== oldCustomerId.toString()) {
    const newCust = await Customer.findById(newCustomerId);
    if (!newCust) throw new AppError('Customer not found', 404);
    payment.customer = newCustomerId;
  }

  if (amount !== undefined) payment.amount = Math.round(parseFloat(amount) * 100) / 100;
  if (mode) payment.mode = mode;
  if (referenceNumber !== undefined) payment.referenceNumber = referenceNumber;
  if (notes !== undefined) payment.notes = notes;
  if (lessAmount !== undefined) payment.lessAmount = Math.round(parseFloat(lessAmount || 0) * 100) / 100;

  await payment.save();

  // Recalculate ledger for old customer
  await recalcCustomerLedger(oldCustomerId);
  // If customer changed, also recalculate new customer's ledger
  if (newCustomerId && newCustomerId.toString() !== oldCustomerId.toString()) {
    await recalcCustomerLedger(newCustomerId);
  }

  const populated = await Payment.findById(payment._id)
    .populate('customer', 'name phone')
    .populate('receivedBy', 'name');

  logActivity({
    action: 'PAYMENT_UPDATED',
    entity: 'payment',
    entityId: payment._id,
    description: `Payment updated — ₹${payment.amount}`,
    metadata: { customerId: payment.customer, amount: payment.amount },
    performedBy: req.user._id,
  });

  res.json({ success: true, data: populated });
});

/* ───────────────────────────────────────────────────────────────────
 * DELETE /api/payments/:id — Delete Payment
 * ─────────────────────────────────────────────────────────────────── */
const deletePayment = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id);
  if (!payment) throw new AppError('Payment not found', 404);

  const customerId = payment.customer;
  const amount = payment.amount;
  const customer = await Customer.findById(customerId);

  await payment.deleteOne();

  // Recalculate customer ledger
  await recalcCustomerLedger(customerId);

  logActivity({
    action: 'PAYMENT_DELETED',
    entity: 'payment',
    entityId: req.params.id,
    description: `Payment ₹${amount} deleted for "${customer?.name}"`,
    metadata: { customerId, amount },
    performedBy: req.user._id,
  });

  res.json({ success: true, message: 'Payment deleted' });
});

/**
 * @desc    Get payments for a customer
 * @route   GET /api/payments/customer/:customerId
 */
const getCustomerPayments = asyncHandler(async (req, res) => {
  const payments = await Payment.find({ customer: req.params.customerId })
    .populate('receivedBy', 'name')
    .sort('-createdAt');

  res.json({ success: true, count: payments.length, data: payments });
});

/**
 * @desc    Get all payments with filters
 * @route   GET /api/payments
 */
const getPayments = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, startDate, endDate, mode } = req.query;

  const filter = {};
  if (mode) filter.mode = mode;
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
  }

  const total = await Payment.countDocuments(filter);
  const payments = await Payment.find(filter)
    .populate('customer', 'name phone')
    .populate('receivedBy', 'name')
    .sort('-createdAt')
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  // Total amount collected
  const totalAmount = await Payment.aggregate([
    { $match: filter },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);

  res.json({
    success: true,
    count: payments.length,
    total,
    totalAmount: totalAmount[0]?.total || 0,
    totalPages: Math.ceil(total / limit),
    currentPage: parseInt(page),
    data: payments,
  });
});

module.exports = {
  addPayment,
  updatePayment,
  deletePayment,
  getCustomerPayments,
  getPayments,
};
