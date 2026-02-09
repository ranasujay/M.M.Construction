const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const Bill = require('../models/Bill');
const Customer = require('../models/Customer');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { logActivity } = require('../utils/activityLogger');
const { recalcCustomerLedger } = require('./billController');

/**
 * @desc    Add payment (by customer — auto-assigns to oldest unpaid bill, or latest bill for advance)
 * @route   POST /api/payments
 */
const addPayment = asyncHandler(async (req, res) => {
  const { customer: customerId, amount, mode, referenceNumber, notes } = req.body;

  // Verify customer exists
  const customer = await Customer.findById(customerId);
  if (!customer) throw new AppError('Customer not found', 404);

  // Find oldest unpaid bill for this customer
  let bill = await Bill.findOne({
    customer: customerId,
    paymentStatus: { $in: ['DUE', 'PARTIAL'] },
  }).sort({ createdAt: 1 });

  // If no unpaid bill, use latest bill (advance/extra payment)
  if (!bill) {
    bill = await Bill.findOne({ customer: customerId }).sort({ createdAt: -1 });
  }

  // Create payment record (bill can be null for pure advance)
  const payment = await Payment.create({
    bill: bill ? bill._id : null,
    customer: customerId,
    amount,
    mode,
    referenceNumber,
    notes,
    receivedBy: req.user._id,
  });

  // Update bill payment totals (only if a bill exists)
  if (bill) {
    bill.totalPaid = Math.round((bill.totalPaid + amount) * 100) / 100;
    bill.dueAmount = Math.round((bill.grandTotal - bill.totalPaid) * 100) / 100;
    if (bill.dueAmount <= 0) {
      bill.dueAmount = 0;
      bill.paymentStatus = 'PAID';
    } else {
      bill.paymentStatus = 'PARTIAL';
    }
    await bill.save();
  }

  // Recalculate customer ledger
  await recalcCustomerLedger(customerId);

  const populatedPayment = await Payment.findById(payment._id)
    .populate('bill', 'billNumber')
    .populate('customer', 'name phone')
    .populate('receivedBy', 'name');

  const billLabel = bill ? bill.billNumber : 'advance (no bill)';
  logActivity({
    action: 'PAYMENT_ADDED',
    entity: 'payment',
    entityId: payment._id,
    description: `Payment ₹${amount} added as ${billLabel} (${customer.name}) via ${mode}`,
    metadata: { customerId, billId: bill ? bill._id : null, amount, mode, billNumber: billLabel },
    performedBy: req.user._id,
  });

  res.status(201).json({ success: true, data: populatedPayment });
});

/**
 * @desc    Get payments for a bill
 * @route   GET /api/payments/bill/:billId
 */
const getBillPayments = asyncHandler(async (req, res) => {
  const payments = await Payment.find({ bill: req.params.billId })
    .populate('receivedBy', 'name')
    .sort('-createdAt');

  res.json({ success: true, count: payments.length, data: payments });
});

/**
 * @desc    Get payments for a customer
 * @route   GET /api/payments/customer/:customerId
 */
const getCustomerPayments = asyncHandler(async (req, res) => {
  const payments = await Payment.find({ customer: req.params.customerId })
    .populate('bill', 'billNumber grandTotal')
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
    .populate('bill', 'billNumber')
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
  getBillPayments,
  getCustomerPayments,
  getPayments,
};
