const SalaryRecord = require('../models/SalaryRecord');
const Attendance = require('../models/Attendance');
const Advance = require('../models/Advance');
const Worker = require('../models/Worker');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { logActivity } = require('../utils/activityLogger');

/**
 * @desc    Generate / recalculate salary for a worker for a given month
 * @route   POST /api/salary/generate
 */
const generateSalary = asyncHandler(async (req, res) => {
  const { workerId, month, year } = req.body;

  if (!workerId || !month || !year) {
    throw new AppError('workerId, month, and year are required', 400);
  }

  const worker = await Worker.findById(workerId);
  if (!worker) throw new AppError('Worker not found', 404);

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);
  const totalDaysInMonth = new Date(year, month, 0).getDate();

  // Get attendance
  const attendance = await Attendance.find({
    worker: workerId,
    date: { $gte: startDate, $lte: endDate },
  });

  const presentDays = attendance.filter((a) => a.status === 'Present').length;
  const absentDays = attendance.filter((a) => a.status === 'Absent').length;
  const totalOvertimeHours = attendance.reduce((sum, a) => sum + (a.overtimeHours || 0), 0);

  // Calculate gross salary
  let grossSalary = 0;
  if (worker.salaryType === 'Daily') {
    grossSalary = presentDays * (worker.dailyWage || 0);
  } else {
    // Monthly salary — pro-rata based on present days
    grossSalary = worker.monthlySalary || 0;
  }

  // Overtime amount
  const overtimeAmount = totalOvertimeHours * (worker.overtimeRate || 0);

  // Advances for the month
  const advances = await Advance.find({
    worker: workerId,
    date: { $gte: startDate, $lte: endDate },
  });
  const totalAdvance = advances.reduce((sum, a) => sum + a.amount, 0);

  // Net payable
  const netPayable = grossSalary + overtimeAmount - totalAdvance;

  // Upsert salary record
  const salaryRecord = await SalaryRecord.findOneAndUpdate(
    { worker: workerId, month: parseInt(month), year: parseInt(year) },
    {
      worker: workerId,
      month: parseInt(month),
      year: parseInt(year),
      totalDays: totalDaysInMonth,
      presentDays,
      absentDays,
      overtimeHours: totalOvertimeHours,
      grossSalary,
      overtimeAmount,
      totalAdvance,
      netPayable,
      generatedBy: req.user._id,
    },
    { upsert: true, new: true, runValidators: true }
  );

  res.json({ success: true, data: salaryRecord });
});

/**
 * @desc    Generate salary for ALL active workers for a month
 * @route   POST /api/salary/generate-all
 */
const generateAllSalaries = asyncHandler(async (req, res) => {
  const { month, year } = req.body;

  if (!month || !year) throw new AppError('Month and year are required', 400);

  const workers = await Worker.find({ isActive: true });
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);
  const totalDaysInMonth = new Date(year, month, 0).getDate();

  const records = [];

  for (const worker of workers) {
    const attendance = await Attendance.find({
      worker: worker._id,
      date: { $gte: startDate, $lte: endDate },
    });

    const presentDays = attendance.filter((a) => a.status === 'Present').length;
    const absentDays = attendance.filter((a) => a.status === 'Absent').length;
    const totalOvertimeHours = attendance.reduce((sum, a) => sum + (a.overtimeHours || 0), 0);

    let grossSalary = 0;
    if (worker.salaryType === 'Daily') {
      grossSalary = presentDays * (worker.dailyWage || 0);
    } else {
      grossSalary = worker.monthlySalary || 0;
    }

    const overtimeAmount = totalOvertimeHours * (worker.overtimeRate || 0);

    const advances = await Advance.find({
      worker: worker._id,
      date: { $gte: startDate, $lte: endDate },
    });
    const totalAdvance = advances.reduce((sum, a) => sum + a.amount, 0);
    const netPayable = grossSalary + overtimeAmount - totalAdvance;

    const record = await SalaryRecord.findOneAndUpdate(
      { worker: worker._id, month: parseInt(month), year: parseInt(year) },
      {
        worker: worker._id,
        month: parseInt(month),
        year: parseInt(year),
        totalDays: totalDaysInMonth,
        presentDays,
        absentDays,
        overtimeHours: totalOvertimeHours,
        grossSalary,
        overtimeAmount,
        totalAdvance,
        netPayable,
        generatedBy: req.user._id,
      },
      { upsert: true, new: true, runValidators: true }
    );

    records.push(record);
  }

  logActivity({
    action: 'SALARY_GENERATED',
    entity: 'salary',
    entityId: null,
    description: `Salary generated for ${records.length} workers — ${month}/${year}`,
    performedBy: req.user._id,
  });

  res.json({
    success: true,
    message: `Salary generated for ${records.length} workers`,
    data: records,
  });
});

/**
 * @desc    Get salary records for a month
 * @route   GET /api/salary?month=1&year=2026
 */
const getSalaryRecords = asyncHandler(async (req, res) => {
  const { month, year, workerId } = req.query;

  if (!month || !year) throw new AppError('Month and year are required', 400);

  const filter = { month: parseInt(month), year: parseInt(year) };
  if (workerId) filter.worker = workerId;

  const records = await SalaryRecord.find(filter)
    .populate('worker', 'name role salaryType dailyWage monthlySalary overtimeRate')
    .populate('generatedBy', 'name')
    .sort({ 'worker.name': 1 });

  // Totals
  const totals = records.reduce(
    (acc, r) => ({
      grossSalary: acc.grossSalary + r.grossSalary,
      overtimeAmount: acc.overtimeAmount + r.overtimeAmount,
      totalAdvance: acc.totalAdvance + r.totalAdvance,
      netPayable: acc.netPayable + r.netPayable,
    }),
    { grossSalary: 0, overtimeAmount: 0, totalAdvance: 0, netPayable: 0 }
  );

  res.json({
    success: true,
    month: parseInt(month),
    year: parseInt(year),
    count: records.length,
    totals,
    data: records,
  });
});

/**
 * @desc    Mark salary as PAID
 * @route   PATCH /api/salary/:id/pay
 */
const markSalaryPaid = asyncHandler(async (req, res) => {
  const record = await SalaryRecord.findById(req.params.id).populate('worker', 'name');
  if (!record) throw new AppError('Salary record not found', 404);

  record.paymentStatus = 'PAID';
  record.paidAt = new Date();
  await record.save();

  logActivity({
    action: 'SALARY_PAID',
    entity: 'salary',
    entityId: record._id,
    description: `Salary paid to "${record.worker.name}" — ${record.month}/${record.year}`,
    performedBy: req.user._id,
  });

  res.json({ success: true, data: record });
});

/**
 * @desc    Worker payroll dashboard stats
 * @route   GET /api/salary/dashboard
 */
const getDashboardStats = asyncHandler(async (req, res) => {
  // Total workers
  const totalWorkers = await Worker.countDocuments({ isActive: true });
  const totalInactive = await Worker.countDocuments({ isActive: false });

  // Today's attendance
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayAttendance = await Attendance.find({ date: today });
  const presentToday = todayAttendance.filter((a) => a.status === 'Present').length;
  const absentToday = todayAttendance.filter((a) => a.status === 'Absent').length;

  // Current month salary expense
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const monthlySalary = await SalaryRecord.aggregate([
    { $match: { month: currentMonth, year: currentYear } },
    {
      $group: {
        _id: null,
        totalGross: { $sum: '$grossSalary' },
        totalOvertime: { $sum: '$overtimeAmount' },
        totalAdvance: { $sum: '$totalAdvance' },
        totalNet: { $sum: '$netPayable' },
        paidCount: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'PAID'] }, 1, 0] } },
        pendingCount: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'PENDING'] }, 1, 0] } },
      },
    },
  ]);

  // Workers with highest overtime this month
  const startDate = new Date(currentYear, currentMonth - 1, 1);
  const endDate = new Date(currentYear, currentMonth, 0, 23, 59, 59);

  const topOvertime = await Attendance.aggregate([
    { $match: { date: { $gte: startDate, $lte: endDate }, overtimeHours: { $gt: 0 } } },
    { $group: { _id: '$worker', totalOT: { $sum: '$overtimeHours' } } },
    { $sort: { totalOT: -1 } },
    { $limit: 5 },
    { $lookup: { from: 'workers', localField: '_id', foreignField: '_id', as: 'worker' } },
    { $unwind: '$worker' },
    { $project: { name: '$worker.name', role: '$worker.role', totalOT: 1 } },
  ]);

  // Outstanding advances (total advances - total deducted via salary)
  const totalAdvancesGiven = await Advance.aggregate([
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  const totalAdvancesDeducted = await SalaryRecord.aggregate([
    { $group: { _id: null, total: { $sum: '$totalAdvance' } } },
  ]);

  const advanceOutstanding =
    (totalAdvancesGiven[0]?.total || 0) - (totalAdvancesDeducted[0]?.total || 0);

  res.json({
    success: true,
    data: {
      totalWorkers,
      totalInactive,
      todayAttendance: {
        present: presentToday,
        absent: absentToday,
        unmarked: totalWorkers - presentToday - absentToday,
      },
      monthlySalary: monthlySalary[0] || {
        totalGross: 0,
        totalOvertime: 0,
        totalAdvance: 0,
        totalNet: 0,
        paidCount: 0,
        pendingCount: 0,
      },
      topOvertime,
      advanceOutstanding: Math.max(0, advanceOutstanding),
    },
  });
});

module.exports = {
  generateSalary,
  generateAllSalaries,
  getSalaryRecords,
  markSalaryPaid,
  getDashboardStats,
};
