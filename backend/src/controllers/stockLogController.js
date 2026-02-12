const StockLog = require('../models/StockLog');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * @desc    Get stock logs (with filters & pagination)
 * @route   GET /api/stock-logs
 */
const getStockLogs = asyncHandler(async (req, res) => {
  const { page = 1, limit = 30, rawMaterial, changeType, startDate, endDate } = req.query;
  const filter = {};

  if (rawMaterial) filter.rawMaterial = rawMaterial;
  if (changeType) filter.changeType = changeType;
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
  }

  const total = await StockLog.countDocuments(filter);
  const logs = await StockLog.find(filter)
    .populate('rawMaterial', 'name unit')
    .populate('performedBy', 'name')
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

module.exports = {
  getStockLogs,
};
