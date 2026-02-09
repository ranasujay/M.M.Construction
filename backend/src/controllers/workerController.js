const Worker = require('../models/Worker');
const Attendance = require('../models/Attendance');
const Advance = require('../models/Advance');
const SalaryRecord = require('../models/SalaryRecord');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { logActivity } = require('../utils/activityLogger');

/**
 * @desc    Create a new worker
 * @route   POST /api/workers
 */
const createWorker = asyncHandler(async (req, res) => {
  const worker = await Worker.create({
    ...req.body,
    createdBy: req.user._id,
  });

  logActivity({
    action: 'WORKER_CREATED',
    entity: 'worker',
    entityId: worker._id,
    description: `Worker "${worker.name}" (${worker.role}) added`,
    performedBy: req.user._id,
  });

  res.status(201).json({ success: true, data: worker });
});

/**
 * @desc    Get all workers (with search, filter, pagination)
 * @route   GET /api/workers
 */
const getWorkers = asyncHandler(async (req, res) => {
  const { search, role, status, page = 1, limit = 50, sortBy = '-createdAt' } = req.query;

  const filter = {};
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
    ];
  }
  if (role) filter.role = role;
  if (status === 'active') filter.isActive = true;
  if (status === 'inactive') filter.isActive = false;

  const total = await Worker.countDocuments(filter);
  const workers = await Worker.find(filter)
    .populate('createdBy', 'name')
    .sort(sortBy)
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  res.json({
    success: true,
    count: workers.length,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: parseInt(page),
    data: workers,
  });
});

/**
 * @desc    Get single worker with summary
 * @route   GET /api/workers/:id
 */
const getWorker = asyncHandler(async (req, res) => {
  const worker = await Worker.findById(req.params.id).populate('createdBy', 'name');
  if (!worker) throw new AppError('Worker not found', 404);

  // Get recent attendance (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentAttendance = await Attendance.find({
    worker: worker._id,
    date: { $gte: thirtyDaysAgo },
  }).sort('-date');

  // Get total advances not yet settled
  const advances = await Advance.find({ worker: worker._id }).sort('-date').limit(10);

  const totalAdvance = await Advance.aggregate([
    { $match: { worker: worker._id } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);

  // Get recent salary records
  const salaryRecords = await SalaryRecord.find({ worker: worker._id })
    .sort({ year: -1, month: -1 })
    .limit(6);

  res.json({
    success: true,
    data: {
      worker,
      recentAttendance,
      recentAdvances: advances,
      totalAdvanceGiven: totalAdvance[0]?.total || 0,
      salaryRecords,
    },
  });
});

/**
 * @desc    Update worker
 * @route   PUT /api/workers/:id
 */
const updateWorker = asyncHandler(async (req, res) => {
  const worker = await Worker.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!worker) throw new AppError('Worker not found', 404);

  logActivity({
    action: 'WORKER_UPDATED',
    entity: 'worker',
    entityId: worker._id,
    description: `Worker "${worker.name}" updated`,
    performedBy: req.user._id,
  });

  res.json({ success: true, data: worker });
});

/**
 * @desc    Toggle worker active status
 * @route   PATCH /api/workers/:id/toggle-status
 */
const toggleWorkerStatus = asyncHandler(async (req, res) => {
  const worker = await Worker.findById(req.params.id);
  if (!worker) throw new AppError('Worker not found', 404);

  worker.isActive = !worker.isActive;
  await worker.save();

  logActivity({
    action: worker.isActive ? 'WORKER_ACTIVATED' : 'WORKER_DEACTIVATED',
    entity: 'worker',
    entityId: worker._id,
    description: `Worker "${worker.name}" ${worker.isActive ? 'activated' : 'deactivated'}`,
    performedBy: req.user._id,
  });

  res.json({ success: true, data: worker });
});

module.exports = {
  createWorker,
  getWorkers,
  getWorker,
  updateWorker,
  toggleWorkerStatus,
};
