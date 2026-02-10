const Customer = require('../models/Customer');
const Bill = require('../models/Bill');
const Payment = require('../models/Payment');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { logActivity } = require('../utils/activityLogger');

/**
 * @desc    Create a new customer
 * @route   POST /api/customers
 */
const createCustomer = asyncHandler(async (req, res) => {
  // Check for duplicate phone
  const existing = await Customer.findOne({ phone: req.body.phone });
  if (existing) {
    throw new AppError(`Customer with phone ${req.body.phone} already exists (${existing.name})`, 400);
  }

  const openingBalance = Number(req.body.openingBalance) || 0;

  const customer = await Customer.create({
    ...req.body,
    openingBalance,
    totalBilled: openingBalance,
    currentDue: openingBalance,
    createdBy: req.user._id,
  });

  logActivity({
    action: 'CUSTOMER_CREATED',
    entity: 'customer',
    entityId: customer._id,
    description: `Customer "${customer.name}" created${openingBalance > 0 ? ` with opening balance ₹${openingBalance}` : ''}`,
    performedBy: req.user._id,
  });

  res.status(201).json({ success: true, data: customer });
});

/**
 * @desc    Get all customers (with search & pagination)
 * @route   GET /api/customers
 */
const getCustomers = asyncHandler(async (req, res) => {
  const { search, page = 1, limit = 20, sortBy = '-createdAt' } = req.query;

  const filter = {};
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
    ];
  }

  const total = await Customer.countDocuments(filter);
  const customers = await Customer.find(filter)
    .populate('createdBy', 'name')
    .sort(sortBy)
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  res.json({
    success: true,
    count: customers.length,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: parseInt(page),
    data: customers,
  });
});

/**
 * @desc    Get single customer with full ledger
 * @route   GET /api/customers/:id
 */
const getCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id).populate('createdBy', 'name');
  if (!customer) throw new AppError('Customer not found', 404);

  res.json({ success: true, data: customer });
});

/**
 * @desc    Get customer ledger (bills + payments)
 * @route   GET /api/customers/:id/ledger
 */
const getCustomerLedger = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) throw new AppError('Customer not found', 404);

  const bills = await Bill.find({ customer: req.params.id })
    .populate('createdBy', 'name')
    .sort('-createdAt');

  const payments = await Payment.find({ customer: req.params.id })
    .populate('bill', 'billNumber')
    .populate('receivedBy', 'name')
    .sort('-createdAt');

  res.json({
    success: true,
    data: {
      customer,
      bills,
      payments,
      summary: {
        totalBilled: customer.totalBilled,
        totalPaid: customer.totalPaid,
        currentDue: customer.currentDue,
        advanceBalance: customer.advanceBalance || 0,
        openingBalance: customer.openingBalance || 0,
        totalBills: bills.length,
        totalPayments: payments.length,
      },
    },
  });
});

/**
 * @desc    Update customer
 * @route   PUT /api/customers/:id
 */
const updateCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) throw new AppError('Customer not found', 404);

  // Only allow updating specific fields
  const allowed = ['name', 'phone', 'altPhone', 'address', 'notes', 'isActive', 'openingBalance'];
  allowed.forEach((field) => {
    if (req.body[field] !== undefined) {
      customer[field] = req.body[field];
    }
  });

  // Check phone uniqueness if phone changed
  if (req.body.phone && req.body.phone !== customer.phone) {
    const dup = await Customer.findOne({ phone: req.body.phone, _id: { $ne: customer._id } });
    if (dup) throw new AppError(`Phone ${req.body.phone} already used by ${dup.name}`, 400);
  }

  await customer.save();

  // Recalculate ledger if opening balance changed (imports recalcCustomerLedger from billController)
  if (req.body.openingBalance !== undefined) {
    const { recalcCustomerLedger } = require('./billController');
    await recalcCustomerLedger(customer._id);
  }

  logActivity({
    action: 'CUSTOMER_UPDATED',
    entity: 'customer',
    entityId: customer._id,
    description: `Customer "${customer.name}" updated`,
    performedBy: req.user._id,
  });

  res.json({ success: true, data: customer });
});

/**
 * @desc    Get customers with outstanding dues
 * @route   GET /api/customers/dues
 */
const getDueCustomers = asyncHandler(async (req, res) => {
  const customers = await Customer.find({ currentDue: { $gt: 0 } })
    .sort('-currentDue')
    .select('name phone address currentDue totalBilled totalPaid advanceBalance nextPromiseDate nextPromiseAmount');

  res.json({ success: true, count: customers.length, data: customers });
});

/**
 * @desc    Get customers with advance balance
 * @route   GET /api/customers/advances
 */
const getAdvanceCustomers = asyncHandler(async (req, res) => {
  const customers = await Customer.find({ advanceBalance: { $gt: 0 } })
    .sort('-advanceBalance')
    .select('name phone address advanceBalance totalBilled totalPaid currentDue');

  const totalAdvance = customers.reduce((sum, c) => sum + c.advanceBalance, 0);

  res.json({ success: true, count: customers.length, totalAdvance, data: customers });
});

module.exports = {
  createCustomer,
  getCustomers,
  getCustomer,
  getCustomerLedger,
  updateCustomer,
  getDueCustomers,
  getAdvanceCustomers,
};
