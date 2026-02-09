const PromiseModel = require('../models/Promise');
const Customer = require('../models/Customer');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { logActivity } = require('../utils/activityLogger');

/**
 * @desc    Create a payment promise
 * @route   POST /api/promises
 */
const createPromise = asyncHandler(async (req, res) => {
  const { customer, bill, promiseDate, promisedAmount, notes } = req.body;

  const customerDoc = await Customer.findById(customer);
  if (!customerDoc) throw new AppError('Customer not found', 404);

  const promise = await PromiseModel.create({
    customer,
    bill,
    promiseDate,
    promisedAmount,
    notes,
    createdBy: req.user._id,
  });

  // Update customer's next promise
  customerDoc.nextPromiseDate = promiseDate;
  customerDoc.nextPromiseAmount = promisedAmount;
  await customerDoc.save();

  logActivity({
    action: 'PROMISE_CREATED',
    entity: 'promise',
    entityId: promise._id,
    description: `Promise of ₹${promisedAmount} by ${new Date(promiseDate).toLocaleDateString()} for "${customerDoc.name}"`,
    performedBy: req.user._id,
  });

  res.status(201).json({ success: true, data: promise });
});

/**
 * @desc    Get all promises (with filters)
 * @route   GET /api/promises
 */
const getPromises = asyncHandler(async (req, res) => {
  const { status, customer } = req.query;

  const filter = {};
  if (status) filter.status = status;
  if (customer) filter.customer = customer;

  const promises = await PromiseModel.find(filter)
    .populate('customer', 'name phone currentDue')
    .populate('bill', 'billNumber')
    .populate('createdBy', 'name')
    .sort('promiseDate');

  res.json({ success: true, count: promises.length, data: promises });
});

/**
 * @desc    Get overdue promises
 * @route   GET /api/promises/overdue
 */
const getOverduePromises = asyncHandler(async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Auto-mark overdue
  await PromiseModel.updateMany(
    { status: 'pending', promiseDate: { $lt: today } },
    { $set: { status: 'overdue' } }
  );

  const overduePromises = await PromiseModel.find({ status: 'overdue' })
    .populate('customer', 'name phone currentDue')
    .populate('bill', 'billNumber')
    .sort('promiseDate');

  res.json({ success: true, count: overduePromises.length, data: overduePromises });
});

/**
 * @desc    Update promise status
 * @route   PUT /api/promises/:id
 */
const updatePromise = asyncHandler(async (req, res) => {
  const promise = await PromiseModel.findById(req.params.id);
  if (!promise) throw new AppError('Promise not found', 404);

  const { status, notes, promiseDate, promisedAmount } = req.body;

  if (status) {
    promise.status = status;
    if (status === 'fulfilled') {
      promise.fulfilledDate = new Date();
    }
  }
  if (notes !== undefined) promise.notes = notes;
  if (promiseDate) promise.promiseDate = promiseDate;
  if (promisedAmount) promise.promisedAmount = promisedAmount;

  await promise.save();

  logActivity({
    action: 'PROMISE_UPDATED',
    entity: 'promise',
    entityId: promise._id,
    description: `Promise updated to status "${promise.status}"`,
    performedBy: req.user._id,
  });

  res.json({ success: true, data: promise });
});

/**
 * @desc    Get customer promise history
 * @route   GET /api/promises/customer/:customerId
 */
const getCustomerPromises = asyncHandler(async (req, res) => {
  const promises = await PromiseModel.find({ customer: req.params.customerId })
    .populate('bill', 'billNumber')
    .populate('createdBy', 'name')
    .sort('-createdAt');

  res.json({ success: true, count: promises.length, data: promises });
});

module.exports = {
  createPromise,
  getPromises,
  getOverduePromises,
  updatePromise,
  getCustomerPromises,
};
