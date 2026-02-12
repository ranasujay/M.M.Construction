const CustomExpense = require('../models/CustomExpense');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { logActivity } = require('../utils/activityLogger');

/**
 * @desc    Create custom expense
 * @route   POST /api/custom-expenses
 */
const createCustomExpense = asyncHandler(async (req, res) => {
  const { title, amount, date, category, notes } = req.body;
  if (!title || !title.trim()) throw new AppError('Title is required', 400);
  if (!amount || parseFloat(amount) <= 0) throw new AppError('Amount must be greater than 0', 400);

  const expense = await CustomExpense.create({
    title: title.trim(),
    amount: parseFloat(amount),
    date: date || new Date(),
    category: category || 'Other',
    notes: notes || '',
    createdBy: req.user._id,
  });

  logActivity({
    action: 'CUSTOM_EXPENSE_CREATED',
    entity: 'customExpense',
    entityId: expense._id,
    description: `Custom expense "${expense.title}" — ₹${expense.amount}`,
    performedBy: req.user._id,
  });

  res.status(201).json({ success: true, data: expense });
});

/**
 * @desc    Get all custom expenses (with filters)
 * @route   GET /api/custom-expenses
 */
const getCustomExpenses = asyncHandler(async (req, res) => {
  const { startDate, endDate, category } = req.query;
  const filter = {};

  if (category) filter.category = category;
  if (startDate || endDate) {
    filter.date = {};
    if (startDate) filter.date.$gte = new Date(startDate);
    if (endDate) filter.date.$lte = new Date(endDate + 'T23:59:59.999Z');
  }

  const expenses = await CustomExpense.find(filter)
    .populate('createdBy', 'name')
    .sort('-date');

  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const categories = await CustomExpense.distinct('category');

  res.json({ success: true, count: expenses.length, total, categories, data: expenses });
});

/**
 * @desc    Update custom expense
 * @route   PUT /api/custom-expenses/:id
 */
const updateCustomExpense = asyncHandler(async (req, res) => {
  const expense = await CustomExpense.findById(req.params.id);
  if (!expense) throw new AppError('Expense not found', 404);

  const { title, amount, date, category, notes } = req.body;
  if (title !== undefined) expense.title = title.trim();
  if (amount !== undefined) expense.amount = parseFloat(amount);
  if (date !== undefined) expense.date = date;
  if (category !== undefined) expense.category = category;
  if (notes !== undefined) expense.notes = notes;

  await expense.save();

  logActivity({
    action: 'CUSTOM_EXPENSE_UPDATED',
    entity: 'customExpense',
    entityId: expense._id,
    description: `Custom expense "${expense.title}" updated — ₹${expense.amount}`,
    performedBy: req.user._id,
  });

  const populated = await CustomExpense.findById(expense._id).populate('createdBy', 'name');
  res.json({ success: true, data: populated });
});

/**
 * @desc    Delete custom expense
 * @route   DELETE /api/custom-expenses/:id
 */
const deleteCustomExpense = asyncHandler(async (req, res) => {
  const expense = await CustomExpense.findById(req.params.id);
  if (!expense) throw new AppError('Expense not found', 404);

  const title = expense.title;
  const amount = expense.amount;
  await expense.deleteOne();

  logActivity({
    action: 'CUSTOM_EXPENSE_DELETED',
    entity: 'customExpense',
    entityId: req.params.id,
    description: `Custom expense "${title}" (₹${amount}) deleted`,
    performedBy: req.user._id,
  });

  res.json({ success: true, message: 'Expense deleted' });
});

module.exports = {
  createCustomExpense,
  getCustomExpenses,
  updateCustomExpense,
  deleteCustomExpense,
};
