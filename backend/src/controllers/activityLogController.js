const ActivityLog = require('../models/ActivityLog');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * @desc    Get activity logs (with pagination & filters)
 * @route   GET /api/activity-logs
 */
const getLogs = asyncHandler(async (req, res) => {
  const { page = 1, limit = 50, entity, action, performedBy } = req.query;

  const filter = {};
  if (entity) filter.entity = entity;
  if (action) filter.action = action;
  if (performedBy) filter.performedBy = performedBy;

  const total = await ActivityLog.countDocuments(filter);
  const logs = await ActivityLog.find(filter)
    .populate('performedBy', 'name role')
    .sort('-createdAt')
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  res.json({
    success: true,
    count: logs.length,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: parseInt(page),
    data: logs,
  });
});

module.exports = { getLogs };
