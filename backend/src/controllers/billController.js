const mongoose = require('mongoose');
const Bill = require('../models/Bill');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const Payment = require('../models/Payment');
const Counter = require('../models/Counter');
const RawMaterial = require('../models/RawMaterial');
const StockLog = require('../models/StockLog');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { logActivity } = require('../utils/activityLogger');

/**
 * Generate bill number: MMC-YYYY-XXXX
 */
const generateBillNumber = async () => {
  const year = new Date().getFullYear();
  const seq = await Counter.getNextSequence(`bill_${year}`);
  return `MMC-${year}-${String(seq).padStart(4, '0')}`;
};

/**
 * Recalculate customer ledger totals from all their bills
 */
const recalcCustomerLedger = async (customerId) => {
  // Get customer for opening balance
  const customerDoc = await Customer.findById(customerId);
  const openingBalance = customerDoc?.openingBalance || 0;

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

  const totalBilled = (billResult[0]?.totalBilled || 0) + openingBalance;
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
 * Deduct raw material stock based on product materialConsumption mappings.
 * Allows negative stock — never blocks billing.
 */
const deductStockForBill = async (bill, userId) => {
  try {
    for (const item of bill.items) {
      // Get full product with materialConsumption populated
      const product = await Product.findById(item.product).populate('materialConsumption.rawMaterial');
      if (!product || !product.materialConsumption || product.materialConsumption.length === 0) {
        continue; // No consumption mapping → skip
      }

      for (const mc of product.materialConsumption) {
        if (!mc.rawMaterial) continue;

        const deductQty = Math.round(item.quantity * mc.quantityPerUnit * 100) / 100;
        if (deductQty === 0) continue;

        const material = await RawMaterial.findById(mc.rawMaterial._id || mc.rawMaterial);
        if (!material) continue;

        material.currentStock = Math.round((material.currentStock - deductQty) * 100) / 100;
        await material.save();

        await StockLog.create({
          rawMaterial: material._id,
          changeType: 'SALE',
          quantityChanged: -deductQty,
          balanceAfter: material.currentStock,
          relatedDocument: bill._id,
          relatedDocumentType: 'Bill',
          notes: `Bill ${bill.billNumber}: ${item.productName} × ${item.quantity}`,
          performedBy: userId,
        });
      }
    }
  } catch (err) {
    // Log error but NEVER block the bill
    console.error('[Stock Deduction Error]', err.message);
  }
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

  // Deduct raw material stock based on product consumption mappings
  await deductStockForBill(bill, req.user._id);

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
  // IST = UTC + 5:30
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(Date.now() + IST_OFFSET_MS);
  const istYear = istNow.getUTCFullYear();
  const istMonth = istNow.getUTCMonth();
  const istDay = istNow.getUTCDate();

  // Midnight IST today (as UTC timestamp)
  const todayStart = new Date(Date.UTC(istYear, istMonth, istDay) - IST_OFFSET_MS);
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const monthStart = new Date(Date.UTC(istYear, istMonth, 1) - IST_OFFSET_MS);

  const [
    todayBilling, todayCollection,
    monthlyBilling, monthlyCollection,
    dueStats, staffStats
  ] = await Promise.all([
    // Today's billing
    Bill.aggregate([
      { $match: { createdAt: { $gte: todayStart, $lt: tomorrowStart } } },
      { $group: { _id: null, total: { $sum: '$grandTotal' }, count: { $sum: 1 } } },
    ]),
    // Today's collection
    Payment.aggregate([
      { $match: { createdAt: { $gte: todayStart, $lt: tomorrowStart } } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    // Monthly billing
    Bill.aggregate([
      { $match: { createdAt: { $gte: monthStart } } },
      { $group: { _id: null, total: { $sum: '$grandTotal' }, count: { $sum: 1 } } },
    ]),
    // Monthly collection
    Payment.aggregate([
      { $match: { createdAt: { $gte: monthStart } } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    // Total outstanding
    Customer.aggregate([
      { $match: { currentDue: { $gt: 0 } } },
      { $group: { _id: null, totalDue: { $sum: '$currentDue' }, count: { $sum: 1 } } },
    ]),
    // Staff-wise billing (this month)
    Bill.aggregate([
      { $match: { createdAt: { $gte: monthStart } } },
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
    ]),
  ]);

  res.json({
    success: true,
    data: {
      today: todayBilling[0] || { total: 0, count: 0 },
      todayCollection: todayCollection[0] || { total: 0, count: 0 },
      monthly: monthlyBilling[0] || { total: 0, count: 0 },
      monthlyCollection: monthlyCollection[0] || { total: 0, count: 0 },
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

  const tz = 'Asia/Kolkata';

  if (period === 'daily') {
    // Last 30 days
    groupBy = {
      year: { $year: { date: '$createdAt', timezone: tz } },
      month: { $month: { date: '$createdAt', timezone: tz } },
      day: { $dayOfMonth: { date: '$createdAt', timezone: tz } },
    };
    dateFormat = 'daily';
    limit = 30;
    sortField = { '_id.year': 1, '_id.month': 1, '_id.day': 1 };
  } else if (period === 'monthly') {
    // Last 12 months
    groupBy = {
      year: { $year: { date: '$createdAt', timezone: tz } },
      month: { $month: { date: '$createdAt', timezone: tz } },
    };
    dateFormat = 'monthly';
    limit = 12;
    sortField = { '_id.year': 1, '_id.month': 1 };
  } else {
    // Yearly
    groupBy = {
      year: { $year: { date: '$createdAt', timezone: tz } },
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
        billCount: { $sum: 1 },
      },
    },
    { $sort: sortField },
    { $limit: limit },
  ]);

  // Payments aggregation (collections)
  let payGroupByObj;
  if (period === 'daily') {
    payGroupByObj = {
      year: { $year: { date: '$createdAt', timezone: tz } },
      month: { $month: { date: '$createdAt', timezone: tz } },
      day: { $dayOfMonth: { date: '$createdAt', timezone: tz } },
    };
  } else if (period === 'monthly') {
    payGroupByObj = {
      year: { $year: { date: '$createdAt', timezone: tz } },
      month: { $month: { date: '$createdAt', timezone: tz } },
    };
  } else {
    payGroupByObj = {
      year: { $year: { date: '$createdAt', timezone: tz } },
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

  // Pre-fill all dates/months/years so there are no gaps in the chart
  // Use IST via UTC offset to match timezone-aware MongoDB aggregation
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(Date.now() + IST_OFFSET_MS);
  if (period === 'daily') {
    for (let i = 29; i >= 0; i--) {
      const d = new Date(istNow);
      d.setUTCDate(d.getUTCDate() - i);
      const label = `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
      chartMap.set(label, {
        label,
        billing: 0,
        paid: 0,
        due: 0,
        bills: 0,
        collected: 0,
        payments: 0,
      });
    }
  } else if (period === 'monthly') {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth() - i, 1));
      const label = `${monthNames[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
      chartMap.set(label, {
        label,
        billing: 0,
        paid: 0,
        due: 0,
        bills: 0,
        collected: 0,
        payments: 0,
      });
    }
  } else {
    for (let i = 4; i >= 0; i--) {
      const label = `${istNow.getUTCFullYear() - i}`;
      chartMap.set(label, {
        label,
        billing: 0,
        paid: 0,
        due: 0,
        bills: 0,
        collected: 0,
        payments: 0,
      });
    }
  }

  billingData.forEach((item) => {
    let label;
    if (period === 'daily') {
      label = `${item._id.day}/${item._id.month}`;
    } else if (period === 'monthly') {
      label = `${monthNames[item._id.month - 1]} ${item._id.year}`;
    } else {
      label = `${item._id.year}`;
    }
    const existing = chartMap.get(label) || {
      label,
      billing: 0,
      paid: 0,
      due: 0,
      bills: 0,
      collected: 0,
      payments: 0,
    };
    existing.billing = Math.round(item.totalBilling);
    existing.bills = item.billCount;
    chartMap.set(label, existing);
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
    const existing = chartMap.get(label) || {
      label,
      billing: 0,
      paid: 0,
      due: 0,
      bills: 0,
      collected: 0,
      payments: 0,
    };
    existing.collected = Math.round(item.totalCollected);
    existing.payments = item.paymentCount;
    chartMap.set(label, existing);
  });

  // Convert to array — Map preserves insertion order (pre-filled chronologically)
  const chartData = Array.from(chartMap.values());

  // Calculate due as billing - collected per period (accurate cash-flow view)
  chartData.forEach((entry) => {
    entry.due = Math.max(0, entry.billing - entry.collected);
  });

  res.json({
    success: true,
    period,
    data: chartData,
  });
});

/**
 * @desc    Get profit analysis for a bill (owner only)
 * @route   GET /api/bills/:id/profit
 */
const getBillProfit = asyncHandler(async (req, res) => {
  const bill = await Bill.findById(req.params.id);
  if (!bill) throw new AppError('Bill not found', 404);

  const PurchaseBill = require('../models/PurchaseBill');

  // Get average purchase rates for all materials
  const avgRates = await PurchaseBill.aggregate([
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.rawMaterial',
        totalQty: { $sum: '$items.quantity' },
        totalCost: { $sum: '$items.totalCost' },
      },
    },
  ]);
  const materialRateMap = {};
  avgRates.forEach((r) => {
    materialRateMap[r._id.toString()] = r.totalQty > 0 ? r.totalCost / r.totalQty : 0;
  });

  // Get products with consumption data
  const productIds = bill.items.map((i) => i.product).filter(Boolean);
  const products = await Product.find({ _id: { $in: productIds } })
    .select('materialConsumption')
    .populate('materialConsumption.rawMaterial', 'name unit')
    .lean();

  const productMap = {};
  products.forEach((p) => {
    productMap[p._id.toString()] = p.materialConsumption || [];
  });

  let totalCost = 0;
  const itemProfits = bill.items.map((item) => {
    const consumption = productMap[item.product?.toString()] || [];
    let costPerUnit = 0;
    const materials = [];

    consumption.forEach((mc) => {
      const matId = mc.rawMaterial?._id?.toString() || mc.rawMaterial?.toString();
      const purchaseRate = materialRateMap[matId] || 0;
      const matCost = mc.quantityPerUnit * purchaseRate;
      costPerUnit += matCost;
      materials.push({
        name: mc.rawMaterial?.name || 'Unknown',
        unit: mc.rawMaterial?.unit || '',
        qtyPerUnit: mc.quantityPerUnit,
        rate: Math.round(purchaseRate * 100) / 100,
        cost: Math.round(matCost * 100) / 100,
      });
    });

    const itemCost = Math.round(item.quantity * costPerUnit * 100) / 100;
    const itemProfit = Math.round((item.lineTotal - itemCost) * 100) / 100;
    totalCost += itemCost;

    return {
      productName: item.productName,
      category: item.category,
      quantity: item.quantity,
      rate: item.rate,
      lineTotal: item.lineTotal,
      costPerUnit: Math.round(costPerUnit * 100) / 100,
      totalCost: itemCost,
      profit: itemProfit,
      profitMargin: item.lineTotal > 0 ? Math.round((itemProfit / item.lineTotal) * 10000) / 100 : 0,
      hasCostData: consumption.length > 0,
      materials,
    };
  });

  totalCost = Math.round(totalCost * 100) / 100;
  const totalProfit = Math.round((bill.grandTotal - totalCost) * 100) / 100;

  res.json({
    success: true,
    data: {
      billTotal: bill.grandTotal,
      totalCost,
      totalProfit,
      profitMargin: bill.grandTotal > 0 ? Math.round((totalProfit / bill.grandTotal) * 10000) / 100 : 0,
      items: itemProfits,
    },
  });
});

module.exports = {
  createBill,
  getBills,
  getBill,
  getBillProfit,
  updateBill,
  getBillStats,
  getChartData,
  recalcCustomerLedger,
};
