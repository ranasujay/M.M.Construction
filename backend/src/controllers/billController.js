const mongoose = require('mongoose');
const Bill = require('../models/Bill');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const Payment = require('../models/Payment');
const Counter = require('../models/Counter');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { logActivity } = require('../utils/activityLogger');

/**
 * Generate bill number: MM-YYYY-XXXX
 */
const generateBillNumber = async () => {
  const year = new Date().getFullYear();
  const seq = await Counter.getNextSequence(`bill_${year}`);
  return `MM-${year}-${String(seq).padStart(4, '0')}`;
};

/**
 * Recalculate customer ledger totals from all their bills
 */
const recalcCustomerLedger = async (customerId) => {
  // Sum from bills
  const billResult = await Bill.aggregate([
    { $match: { customer: new mongoose.Types.ObjectId(customerId) } },
    {
      $group: {
        _id: null,
        totalBilled: { $sum: '$grandTotal' },
      },
    },
  ]);

  // Sum ALL payments for this customer (includes bill-less advances)
  const payResult = await Payment.aggregate([
    { $match: { customer: new mongoose.Types.ObjectId(customerId) } },
    {
      $group: {
        _id: null,
        totalPaid: { $sum: '$amount' },
      },
    },
  ]);

  const totalBilled = billResult[0]?.totalBilled || 0;
  const totalPaid = payResult[0]?.totalPaid || 0;

  // Due = billed - paid (if positive); Advance = paid - billed (if positive)
  const currentDue = Math.max(0, Math.round((totalBilled - totalPaid) * 100) / 100);
  const advance = Math.max(0, Math.round((totalPaid - totalBilled) * 100) / 100);

  await Customer.findByIdAndUpdate(customerId, {
    totalBilled,
    totalPaid,
    currentDue,
    advanceBalance: advance,
  });
};

/**
 * @desc    Create a new bill / invoice
 * @route   POST /api/bills
 */
const createBill = asyncHandler(async (req, res) => {
  const { customer, items, discount, discountType, advancePayment, advancePaymentMode, deliveryDate, notes } = req.body;

  // Verify customer exists
  const customerDoc = await Customer.findById(customer);
  if (!customerDoc) throw new AppError('Customer not found', 404);

  // Fetch product details and build line items
  const lineItems = [];
  for (const item of items) {
    const product = await Product.findById(item.product);
    if (!product) throw new AppError(`Product ${item.product} not found`, 404);
    if (!product.isActive) throw new AppError(`Product "${product.name}" is inactive`, 400);

    lineItems.push({
      product: product._id,
      productName: product.name,
      category: product.category,
      quantity: item.quantity,
      unit: item.unit || product.unit,
      rate: item.rate !== undefined ? item.rate : product.baseRate,
      fittingCharge: item.fittingCharge !== undefined ? item.fittingCharge : product.fittingCharge,
      fittingChargeType: item.fittingChargeType || product.fittingChargeType,
    });
  }

  const billNumber = await generateBillNumber();

  const bill = await Bill.create({
    billNumber,
    customer,
    items: lineItems,
    discount: discount || 0,
    discountType: discountType || 'flat',
    advancePayment: advancePayment || 0,
    deliveryDate,
    notes,
    createdBy: req.user._id,
  });

  // If advance payment was given, record it as a Payment entry so it shows in payment history
  if (bill.advancePayment > 0) {
    await Payment.create({
      bill: bill._id,
      customer: customer,
      amount: bill.advancePayment,
      mode: advancePaymentMode || 'Cash',
      notes: 'Advance payment at billing',
      receivedBy: req.user._id,
    });

    logActivity({
      action: 'PAYMENT_ADDED',
      entity: 'payment',
      entityId: bill._id,
      description: `Advance ₹${bill.advancePayment} recorded for bill ${billNumber}`,
      metadata: { billId: bill._id, amount: bill.advancePayment, mode: advancePaymentMode || 'Cash', billNumber },
      performedBy: req.user._id,
    });
  }

  // Auto-apply customer's existing advance balance against this bill
  const freshCustomer = await Customer.findById(customer);
  if (freshCustomer && freshCustomer.advanceBalance > 0 && bill.dueAmount > 0) {
    const applyAmount = Math.min(freshCustomer.advanceBalance, bill.dueAmount);
    // Update bill totals
    bill.totalPaid = Math.round((bill.totalPaid + applyAmount) * 100) / 100;
    bill.dueAmount = Math.round((bill.grandTotal - bill.totalPaid) * 100) / 100;
    if (bill.dueAmount <= 0) {
      bill.dueAmount = 0;
      bill.paymentStatus = 'PAID';
    } else {
      bill.paymentStatus = 'PARTIAL';
    }
    await bill.save();

    // Record as payment entry
    await Payment.create({
      bill: bill._id,
      customer: customer,
      amount: applyAmount,
      mode: 'Cash',
      notes: 'Auto-applied from advance balance',
      receivedBy: req.user._id,
    });

    logActivity({
      action: 'PAYMENT_ADDED',
      entity: 'payment',
      entityId: bill._id,
      description: `Advance ₹${applyAmount} auto-applied to bill ${billNumber}`,
      metadata: { billId: bill._id, amount: applyAmount, billNumber },
      performedBy: req.user._id,
    });
  }

  // Recalculate customer ledger (after all payments recorded)
  await recalcCustomerLedger(customer);

  // Populate for response
  const populated = await Bill.findById(bill._id)
    .populate('customer', 'name phone')
    .populate('createdBy', 'name');

  logActivity({
    action: 'BILL_CREATED',
    entity: 'bill',
    entityId: bill._id,
    description: `Bill ${billNumber} created for "${customerDoc.name}" — ₹${bill.grandTotal}`,
    metadata: { billNumber, grandTotal: bill.grandTotal, customerId: customer },
    performedBy: req.user._id,
  });

  res.status(201).json({ success: true, data: populated });
});

/**
 * @desc    Get all bills (with filters & pagination)
 * @route   GET /api/bills
 */
const getBills = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    status,
    customer,
    startDate,
    endDate,
    search,
    createdBy,
  } = req.query;

  const filter = {};
  if (status) filter.paymentStatus = status;
  if (customer) filter.customer = customer;
  if (createdBy) filter.createdBy = createdBy;
  if (search) filter.billNumber = { $regex: search, $options: 'i' };
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
  }

  const total = await Bill.countDocuments(filter);
  const bills = await Bill.find(filter)
    .populate('customer', 'name phone')
    .populate('createdBy', 'name')
    .sort('-createdAt')
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  res.json({
    success: true,
    count: bills.length,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: parseInt(page),
    data: bills,
  });
});

/**
 * @desc    Get single bill with full details
 * @route   GET /api/bills/:id
 */
const getBill = asyncHandler(async (req, res) => {
  const bill = await Bill.findById(req.params.id)
    .populate('customer', 'name phone address')
    .populate('createdBy', 'name')
    .populate('items.product', 'name category');

  if (!bill) throw new AppError('Bill not found', 404);

  res.json({ success: true, data: bill });
});

/**
 * @desc    Update bill (only before any payments beyond advance)
 * @route   PUT /api/bills/:id
 */
const updateBill = asyncHandler(async (req, res) => {
  const bill = await Bill.findById(req.params.id);
  if (!bill) throw new AppError('Bill not found', 404);

  const { items, discount, discountType, deliveryDate, notes } = req.body;

  if (items) {
    const lineItems = [];
    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product) throw new AppError(`Product ${item.product} not found`, 404);

      lineItems.push({
        product: product._id,
        productName: product.name,
        category: product.category,
        quantity: item.quantity,
        unit: item.unit || product.unit,
        rate: item.rate !== undefined ? item.rate : product.baseRate,
        fittingCharge: item.fittingCharge !== undefined ? item.fittingCharge : product.fittingCharge,
        fittingChargeType: item.fittingChargeType || product.fittingChargeType,
      });
    }
    bill.items = lineItems;
  }

  if (discount !== undefined) bill.discount = discount;
  if (discountType) bill.discountType = discountType;
  if (deliveryDate !== undefined) bill.deliveryDate = deliveryDate;
  if (notes !== undefined) bill.notes = notes;

  await bill.save(); // triggers pre-validate recalculation
  await recalcCustomerLedger(bill.customer);

  const populated = await Bill.findById(bill._id)
    .populate('customer', 'name phone')
    .populate('createdBy', 'name');

  logActivity({
    action: 'BILL_UPDATED',
    entity: 'bill',
    entityId: bill._id,
    description: `Bill ${bill.billNumber} updated — new total ₹${bill.grandTotal}`,
    performedBy: req.user._id,
  });

  res.json({ success: true, data: populated });
});

/**
 * @desc    Get bill stats for dashboard
 * @route   GET /api/bills/stats
 */
const getBillStats = asyncHandler(async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  // Today's billing
  const todayStats = await Bill.aggregate([
    { $match: { createdAt: { $gte: today, $lt: tomorrow } } },
    { $group: { _id: null, total: { $sum: '$grandTotal' }, count: { $sum: 1 } } },
  ]);

  // Monthly revenue
  const monthlyStats = await Bill.aggregate([
    { $match: { createdAt: { $gte: startOfMonth } } },
    { $group: { _id: null, total: { $sum: '$grandTotal' }, count: { $sum: 1 } } },
  ]);

  // Total outstanding
  const dueStats = await Customer.aggregate([
    { $match: { currentDue: { $gt: 0 } } },
    { $group: { _id: null, totalDue: { $sum: '$currentDue' }, count: { $sum: 1 } } },
  ]);

  // Staff-wise billing (this month)
  const staffStats = await Bill.aggregate([
    { $match: { createdAt: { $gte: startOfMonth } } },
    {
      $group: {
        _id: '$createdBy',
        totalBilling: { $sum: '$grandTotal' },
        billCount: { $sum: 1 },
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'staff',
      },
    },
    { $unwind: '$staff' },
    {
      $project: {
        staffName: '$staff.name',
        totalBilling: 1,
        billCount: 1,
      },
    },
    { $sort: { totalBilling: -1 } },
  ]);

  res.json({
    success: true,
    data: {
      today: todayStats[0] || { total: 0, count: 0 },
      monthly: monthlyStats[0] || { total: 0, count: 0 },
      outstanding: dueStats[0] || { totalDue: 0, count: 0 },
      staffWise: staffStats,
    },
  });
});

/**
 * @desc    Get chart data for dashboard (day/month/year wise)
 * @route   GET /api/bills/chart-data
 */
const getChartData = asyncHandler(async (req, res) => {
  const { period = 'daily' } = req.query; // daily, monthly, yearly

  let groupBy, dateFormat, limit, sortField;

  if (period === 'daily') {
    // Last 30 days
    groupBy = {
      year: { $year: '$createdAt' },
      month: { $month: '$createdAt' },
      day: { $dayOfMonth: '$createdAt' },
    };
    dateFormat = 'daily';
    limit = 30;
    sortField = { '_id.year': 1, '_id.month': 1, '_id.day': 1 };
  } else if (period === 'monthly') {
    // Last 12 months
    groupBy = {
      year: { $year: '$createdAt' },
      month: { $month: '$createdAt' },
    };
    dateFormat = 'monthly';
    limit = 12;
    sortField = { '_id.year': 1, '_id.month': 1 };
  } else {
    // Yearly
    groupBy = {
      year: { $year: '$createdAt' },
    };
    dateFormat = 'yearly';
    limit = 5;
    sortField = { '_id.year': 1 };
  }

  // Calculate cutoff date
  const cutoff = new Date();
  if (period === 'daily') {
    cutoff.setDate(cutoff.getDate() - 30);
  } else if (period === 'monthly') {
    cutoff.setMonth(cutoff.getMonth() - 12);
  } else {
    cutoff.setFullYear(cutoff.getFullYear() - 5);
  }

  // Bills aggregation (earnings / selling)
  const billingData = await Bill.aggregate([
    { $match: { createdAt: { $gte: cutoff } } },
    {
      $group: {
        _id: groupBy,
        totalBilling: { $sum: '$grandTotal' },
        totalPaid: { $sum: '$totalPaid' },
        totalDue: { $sum: '$dueAmount' },
        billCount: { $sum: 1 },
      },
    },
    { $sort: sortField },
    { $limit: limit },
  ]);

  // Payments aggregation (collections)
  const payGroupBy = { ...groupBy };
  // Re-build for payments collection
  let payGroupByObj;
  if (period === 'daily') {
    payGroupByObj = {
      year: { $year: '$createdAt' },
      month: { $month: '$createdAt' },
      day: { $dayOfMonth: '$createdAt' },
    };
  } else if (period === 'monthly') {
    payGroupByObj = {
      year: { $year: '$createdAt' },
      month: { $month: '$createdAt' },
    };
  } else {
    payGroupByObj = {
      year: { $year: '$createdAt' },
    };
  }

  const paymentData = await Payment.aggregate([
    { $match: { createdAt: { $gte: cutoff } } },
    {
      $group: {
        _id: payGroupByObj,
        totalCollected: { $sum: '$amount' },
        paymentCount: { $sum: 1 },
      },
    },
    { $sort: sortField },
    { $limit: limit },
  ]);

  // Merge data into a unified timeline
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const chartMap = new Map();

  billingData.forEach((item) => {
    let label;
    if (period === 'daily') {
      label = `${item._id.day}/${item._id.month}`;
    } else if (period === 'monthly') {
      label = `${monthNames[item._id.month - 1]} ${item._id.year}`;
    } else {
      label = `${item._id.year}`;
    }
    chartMap.set(label, {
      label,
      billing: Math.round(item.totalBilling),
      paid: Math.round(item.totalPaid),
      due: Math.round(item.totalDue),
      bills: item.billCount,
      collected: 0,
      payments: 0,
    });
  });

  paymentData.forEach((item) => {
    let label;
    if (period === 'daily') {
      label = `${item._id.day}/${item._id.month}`;
    } else if (period === 'monthly') {
      label = `${monthNames[item._id.month - 1]} ${item._id.year}`;
    } else {
      label = `${item._id.year}`;
    }
    if (chartMap.has(label)) {
      chartMap.get(label).collected = Math.round(item.totalCollected);
      chartMap.get(label).payments = item.paymentCount;
    } else {
      chartMap.set(label, {
        label,
        billing: 0,
        paid: 0,
        due: 0,
        bills: 0,
        collected: Math.round(item.totalCollected),
        payments: item.paymentCount,
      });
    }
  });

  // Convert to array, sort by original order
  const chartData = Array.from(chartMap.values());

  res.json({
    success: true,
    period,
    data: chartData,
  });
});

module.exports = {
  createBill,
  getBills,
  getBill,
  updateBill,
  getBillStats,
  getChartData,
  recalcCustomerLedger,
};
