const Attendance = require('../models/Attendance');
const Worker = require('../models/Worker');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

/**
 * @desc    Mark bulk attendance for a date
 * @route   POST /api/attendance/bulk
 */
const markBulkAttendance = asyncHandler(async (req, res) => {
  const { date, records } = req.body;
  const attendanceDate = new Date(date);
  attendanceDate.setHours(0, 0, 0, 0);

  const results = [];

  for (const record of records) {
    const existing = await Attendance.findOne({
      worker: record.worker,
      date: attendanceDate,
    });

    if (existing) {
      // Update existing
      existing.status = record.status;
      existing.overtimeHours = record.overtimeHours || 0;
      existing.note = record.note || '';
      existing.markedBy = req.user._id;
      await existing.save();
      results.push(existing);
    } else {
      // Create new
      const attendance = await Attendance.create({
        worker: record.worker,
        date: attendanceDate,
        status: record.status,
        overtimeHours: record.overtimeHours || 0,
        note: record.note || '',
        markedBy: req.user._id,
      });
      results.push(attendance);
    }
  }

  res.status(201).json({
    success: true,
    message: `Attendance marked for ${results.length} workers`,
    data: results,
  });
});

/**
 * @desc    Mark / update single attendance
 * @route   POST /api/attendance
 */
const markAttendance = asyncHandler(async (req, res) => {
  const { worker, date, status, overtimeHours, note } = req.body;
  const attendanceDate = new Date(date);
  attendanceDate.setHours(0, 0, 0, 0);

  // Verify worker exists
  const workerDoc = await Worker.findById(worker);
  if (!workerDoc) throw new AppError('Worker not found', 404);

  let attendance = await Attendance.findOne({ worker, date: attendanceDate });

  if (attendance) {
    attendance.status = status;
    attendance.overtimeHours = overtimeHours || 0;
    attendance.note = note || '';
    attendance.markedBy = req.user._id;
    await attendance.save();
  } else {
    attendance = await Attendance.create({
      worker,
      date: attendanceDate,
      status,
      overtimeHours: overtimeHours || 0,
      note: note || '',
      markedBy: req.user._id,
    });
  }

  res.status(201).json({ success: true, data: attendance });
});

/**
 * @desc    Get attendance for a specific date (all workers)
 * @route   GET /api/attendance/daily?date=YYYY-MM-DD
 */
const getDailyAttendance = asyncHandler(async (req, res) => {
  const { date } = req.query;
  if (!date) throw new AppError('Date is required', 400);

  const attendanceDate = new Date(date);
  attendanceDate.setHours(0, 0, 0, 0);

  // Get all active workers
  const workers = await Worker.find({ isActive: true }).sort('name');

  // Get existing attendance for the date
  const attendance = await Attendance.find({ date: attendanceDate }).populate('worker', 'name role');

  const attendanceMap = {};
  attendance.forEach((a) => {
    attendanceMap[a.worker._id.toString()] = a;
  });

  // Merge workers with attendance
  const data = workers.map((w) => ({
    worker: { _id: w._id, name: w.name, role: w.role },
    attendance: attendanceMap[w._id.toString()] || null,
  }));

  res.json({ success: true, date: attendanceDate, data });
});

/**
 * @desc    Get monthly attendance for a worker
 * @route   GET /api/attendance/monthly/:workerId?month=1&year=2026
 */
const getMonthlyAttendance = asyncHandler(async (req, res) => {
  const { workerId } = req.params;
  const { month, year } = req.query;

  if (!month || !year) throw new AppError('Month and year are required', 400);

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  const worker = await Worker.findById(workerId);
  if (!worker) throw new AppError('Worker not found', 404);

  const attendance = await Attendance.find({
    worker: workerId,
    date: { $gte: startDate, $lte: endDate },
  }).sort('date');

  const presentDays = attendance.filter((a) => a.status === 'Present').length;
  const absentDays = attendance.filter((a) => a.status === 'Absent').length;
  const totalOvertimeHours = attendance.reduce((sum, a) => sum + (a.overtimeHours || 0), 0);

  res.json({
    success: true,
    data: {
      worker: { _id: worker._id, name: worker.name, role: worker.role },
      month: parseInt(month),
      year: parseInt(year),
      attendance,
      summary: {
        totalDays: new Date(year, month, 0).getDate(),
        presentDays,
        absentDays,
        unmarked: new Date(year, month, 0).getDate() - presentDays - absentDays,
        totalOvertimeHours,
      },
    },
  });
});

/**
 * @desc    Get attendance summary for all workers for a month
 * @route   GET /api/attendance/summary?month=1&year=2026
 */
const getAttendanceSummary = asyncHandler(async (req, res) => {
  const { month, year } = req.query;
  if (!month || !year) throw new AppError('Month and year are required', 400);

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  const summary = await Attendance.aggregate([
    {
      $match: {
        date: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: '$worker',
        presentDays: {
          $sum: { $cond: [{ $eq: ['$status', 'Present'] }, 1, 0] },
        },
        absentDays: {
          $sum: { $cond: [{ $eq: ['$status', 'Absent'] }, 1, 0] },
        },
        totalOvertimeHours: { $sum: '$overtimeHours' },
      },
    },
    {
      $lookup: {
        from: 'workers',
        localField: '_id',
        foreignField: '_id',
        as: 'worker',
      },
    },
    { $unwind: '$worker' },
    {
      $project: {
        worker: {
          _id: '$worker._id',
          name: '$worker.name',
          role: '$worker.role',
          salaryType: '$worker.salaryType',
          dailyWage: '$worker.dailyWage',
          monthlySalary: '$worker.monthlySalary',
          overtimeRate: '$worker.overtimeRate',
          isActive: '$worker.isActive',
        },
        presentDays: 1,
        absentDays: 1,
        totalOvertimeHours: 1,
      },
    },
    { $sort: { 'worker.name': 1 } },
  ]);

  res.json({ success: true, month: parseInt(month), year: parseInt(year), data: summary });
});

/**
 * @desc    Get calendar data — all workers × all days for a month
 * @route   GET /api/attendance/calendar?month=1&year=2026
 */
const getCalendarData = asyncHandler(async (req, res) => {
  const { month, year } = req.query;
  if (!month || !year) throw new AppError('Month and year are required', 400);

  const m = parseInt(month);
  const y = parseInt(year);
  const startDate = new Date(y, m - 1, 1);
  const endDate = new Date(y, m, 0, 23, 59, 59);
  const totalDays = new Date(y, m, 0).getDate();

  // Get all active workers
  const workers = await Worker.find({ isActive: true }).sort('name').select('name role');

  // Get all attendance records for the month
  const allAttendance = await Attendance.find({
    date: { $gte: startDate, $lte: endDate },
  }).lean();

  // Build a lookup: workerId -> { dayNumber -> record }
  const attendanceMap = {};
  allAttendance.forEach((a) => {
    const wId = a.worker.toString();
    const day = new Date(a.date).getDate();
    if (!attendanceMap[wId]) attendanceMap[wId] = {};
    attendanceMap[wId][day] = {
      status: a.status,
      overtimeHours: a.overtimeHours || 0,
      note: a.note || '',
    };
  });

  // Build per-worker data
  const data = workers.map((w) => {
    const wId = w._id.toString();
    const days = {};
    let presentDays = 0;
    let absentDays = 0;
    let otHours = 0;

    for (let d = 1; d <= totalDays; d++) {
      if (attendanceMap[wId] && attendanceMap[wId][d]) {
        days[d] = attendanceMap[wId][d];
        if (attendanceMap[wId][d].status === 'Present') presentDays++;
        if (attendanceMap[wId][d].status === 'Absent') absentDays++;
        otHours += attendanceMap[wId][d].overtimeHours || 0;
      }
    }

    return {
      worker: { _id: w._id, name: w.name, role: w.role },
      days,
      summary: {
        presentDays,
        absentDays,
        unmarked: totalDays - presentDays - absentDays,
        otHours,
      },
    };
  });

  res.json({
    success: true,
    month: m,
    year: y,
    totalDays,
    // first day of month (0=Sun, 1=Mon, ...) for calendar alignment
    firstDayOfWeek: startDate.getDay(),
    data,
  });
});

/**
 * @desc    Get worker attendance stats with date range / year filtering
 * @route   GET /api/attendance/worker-stats/:workerId?from=YYYY-MM-DD&to=YYYY-MM-DD  OR  ?year=2026
 */
const getWorkerStats = asyncHandler(async (req, res) => {
  const { workerId } = req.params;
  const { from, to, year, preset } = req.query;

  const worker = await Worker.findById(workerId);
  if (!worker) throw new AppError('Worker not found', 404);

  let startDate, endDate, label;

  if (preset) {
    const now = new Date();
    switch (preset) {
      case 'this-month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        label = 'This Month';
        break;
      case 'last-month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        label = 'Last Month';
        break;
      case 'last-3-months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        label = 'Last 3 Months';
        break;
      case 'last-6-months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        label = 'Last 6 Months';
        break;
      case 'this-year':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
        label = `Year ${now.getFullYear()}`;
        break;
      default:
        throw new AppError('Invalid preset. Use: this-month, last-month, last-3-months, last-6-months, this-year', 400);
    }
  } else if (year) {
    const y = parseInt(year);
    startDate = new Date(y, 0, 1);
    endDate = new Date(y, 11, 31, 23, 59, 59);
    label = `Year ${y}`;
  } else if (from && to) {
    startDate = new Date(from);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(to);
    endDate.setHours(23, 59, 59, 999);
    label = `${from} to ${to}`;
  } else {
    // Default: current year
    const now = new Date();
    startDate = new Date(now.getFullYear(), 0, 1);
    endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
    label = `Year ${now.getFullYear()}`;
  }

  const attendance = await Attendance.find({
    worker: workerId,
    date: { $gte: startDate, $lte: endDate },
  }).sort('date');

  const presentDays = attendance.filter((a) => a.status === 'Present').length;
  const absentDays = attendance.filter((a) => a.status === 'Absent').length;
  const totalOvertimeHours = attendance.reduce((sum, a) => sum + (a.overtimeHours || 0), 0);
  const overtimeDays = attendance.filter((a) => (a.overtimeHours || 0) > 0).length;

  // Monthly breakdown
  const monthlyBreakdown = {};
  attendance.forEach((a) => {
    const key = `${a.date.getFullYear()}-${String(a.date.getMonth() + 1).padStart(2, '0')}`;
    if (!monthlyBreakdown[key]) {
      monthlyBreakdown[key] = { month: key, present: 0, absent: 0, overtimeHours: 0 };
    }
    if (a.status === 'Present') monthlyBreakdown[key].present++;
    if (a.status === 'Absent') monthlyBreakdown[key].absent++;
    monthlyBreakdown[key].overtimeHours += a.overtimeHours || 0;
  });

  // Calculate total calendar days in range
  const diffTime = Math.abs(endDate - startDate);
  const totalCalendarDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

  res.json({
    success: true,
    data: {
      worker: { _id: worker._id, name: worker.name, role: worker.role },
      range: { from: startDate, to: endDate, label },
      summary: {
        totalCalendarDays,
        presentDays,
        absentDays,
        unmarked: totalCalendarDays - presentDays - absentDays,
        totalOvertimeHours,
        overtimeDays,
        attendancePercent: totalCalendarDays > 0
          ? Math.round((presentDays / totalCalendarDays) * 100)
          : 0,
      },
      monthlyBreakdown: Object.values(monthlyBreakdown).sort((a, b) => a.month.localeCompare(b.month)),
    },
  });
});

module.exports = {
  markBulkAttendance,
  markAttendance,
  getDailyAttendance,
  getMonthlyAttendance,
  getAttendanceSummary,
  getCalendarData,
  getWorkerStats,
};
