const Advance = require('../models/Advance');
const Worker = require('../models/Worker');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { logActivity } = require('../utils/activityLogger');

/**
 * @desc    Give advance to a worker
 * @route   POST /api/advances/worker
 */
const giveAdvance = asyncHandler(async (req, res) => {
  const { worker, amount, date, note } = req.body;

  const workerDoc = await Worker.findById(worker);
  if (!workerDoc) throw new AppError('Worker not found', 404);

  const advance = await Advance.create({
    worker,
    amount,
    date: date || new Date(),
    note: note || '',
    givenBy: req.user._id,
  });

  logActivity({
    action: 'ADVANCE_GIVEN',
    entity: 'advance',
    entityId: advance._id,
    description: `Advance ₹${amount} given to "${workerDoc.name}"`,
    performedBy: req.user._id,
  });

  res.status(201).json({ success: true, data: advance });
});

/**
 * @desc    Get all advances (with filter)
 * @route   GET /api/advances/worker
 */
const getAdvances = asyncHandler(async (req, res) => {
  const { workerId, month, year, page = 1, limit = 50 } = req.query;

  const filter = {};
  if (workerId) filter.worker = workerId;

  if (month && year) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);
    filter.date = { $gte: startDate, $lte: endDate };
  }

  const total = await Advance.countDocuments(filter);
  const advances = await Advance.find(filter)
    .populate('worker', 'name role')
    .populate('givenBy', 'name')
    .sort('-date')
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  res.json({
    success: true,
    count: advances.length,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: parseInt(page),
    data: advances,
  });
});

/**
 * @desc    Get worker's advances for a month
 * @route   GET /api/advances/worker/:workerId/monthly?month=1&year=2026
 */
const getWorkerMonthlyAdvances = asyncHandler(async (req, res) => {
  const { workerId } = req.params;
  const { month, year } = req.query;

  if (!month || !year) throw new AppError('Month and year are required', 400);

  const worker = await Worker.findById(workerId);
  if (!worker) throw new AppError('Worker not found', 404);

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  const advances = await Advance.find({
    worker: workerId,
    date: { $gte: startDate, $lte: endDate },
  })
    .populate('givenBy', 'name')
    .sort('-date');

  const total = advances.reduce((sum, a) => sum + a.amount, 0);

  res.json({
    success: true,
    data: {
      worker: { _id: worker._id, name: worker.name },
      month: parseInt(month),
      year: parseInt(year),
      advances,
      totalAdvance: total,
    },
  });
});

/**
 * @desc    Delete an advance
 * @route   DELETE /api/advances/worker/:id
 */
const deleteAdvance = asyncHandler(async (req, res) => {
  const advance = await Advance.findById(req.params.id).populate('worker', 'name');
  if (!advance) throw new AppError('Advance record not found', 404);

  const workerName = advance.worker?.name || 'Unknown';
  const amount = advance.amount;

  await advance.deleteOne();

  logActivity({
    action: 'ADVANCE_DELETED',
    entity: 'advance',
    entityId: req.params.id,
    description: `Advance ₹${amount} for "${workerName}" deleted`,
    performedBy: req.user._id,
  });

  res.json({ success: true, message: 'Advance deleted' });
});

module.exports = {
  giveAdvance,
  getAdvances,
  getWorkerMonthlyAdvances,
  deleteAdvance,
};
