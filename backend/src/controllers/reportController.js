const Bill = require('../models/Bill');
const Payment = require('../models/Payment');
const Customer = require('../models/Customer');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * @desc    Date-wise bills report
 * @route   GET /api/reports/bills
 */
const billsReport = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  const filter = {};
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
  }

  const bills = await Bill.find(filter)
    .populate('customer', 'name phone')
    .populate('createdBy', 'name')
    .sort('-createdAt');

  const summary = bills.reduce(
    (acc, bill) => {
      acc.totalBilled += bill.grandTotal;
      acc.totalPaid += bill.totalPaid;
      acc.totalDue += bill.dueAmount;
      return acc;
    },
    { totalBilled: 0, totalPaid: 0, totalDue: 0 }
  );

  res.json({
    success: true,
    count: bills.length,
    summary,
    data: bills,
  });
});

/**
 * @desc    Due report - all customers with dues
 * @route   GET /api/reports/dues
 */
const dueReport = asyncHandler(async (req, res) => {
  const customers = await Customer.find({ currentDue: { $gt: 0 } })
    .sort('-currentDue')
    .select('name phone totalBilled totalPaid currentDue nextPromiseDate nextPromiseAmount');

  const totalOutstanding = customers.reduce((sum, c) => sum + c.currentDue, 0);

  res.json({
    success: true,
    count: customers.length,
    totalOutstanding,
    data: customers,
  });
});

/**
 * @desc    Payment report
 * @route   GET /api/reports/payments
 */
const paymentReport = asyncHandler(async (req, res) => {
  const { startDate, endDate, mode } = req.query;

  const filter = {};
  if (mode) filter.mode = mode;
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
  }

  const payments = await Payment.find(filter)
    .populate('bill', 'billNumber')
    .populate('customer', 'name phone')
    .populate('receivedBy', 'name')
    .sort('-createdAt');

  // Group by mode
  const byMode = await Payment.aggregate([
    { $match: filter },
    { $group: { _id: '$mode', total: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);

  const totalCollected = payments.reduce((sum, p) => sum + p.amount, 0);

  res.json({
    success: true,
    count: payments.length,
    totalCollected,
    byMode,
    data: payments,
  });
});

/**
 * @desc    Customer ledger report (single customer)
 * @route   GET /api/reports/ledger/:customerId
 */
const customerLedgerReport = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.customerId);
  if (!customer) {
    return res.status(404).json({ success: false, message: 'Customer not found' });
  }

  const bills = await Bill.find({ customer: req.params.customerId })
    .select('billNumber grandTotal totalPaid dueAmount paymentStatus createdAt')
    .sort('-createdAt');

  const payments = await Payment.find({ customer: req.params.customerId })
    .populate('bill', 'billNumber')
    .select('amount mode referenceNumber createdAt bill')
    .sort('-createdAt');

  res.json({
    success: true,
    data: {
      customer: {
        name: customer.name,
        phone: customer.phone,
        address: customer.address,
        totalBilled: customer.totalBilled,
        totalPaid: customer.totalPaid,
        currentDue: customer.currentDue,
      },
      bills,
      payments,
    },
  });
});

module.exports = { billsReport, dueReport, paymentReport, customerLedgerReport };
