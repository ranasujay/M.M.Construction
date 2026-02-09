import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  HiOutlineArrowLeft,
  HiOutlinePhone,
  HiOutlineBriefcase,
  HiOutlineCalendar,
  HiOutlineCurrencyRupee,
  HiOutlineClock,
  HiOutlineFilter,
  HiOutlineChartBar,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
} from 'react-icons/hi';
import Loader from '../components/Loader';
import { workerAPI, attendanceAPI } from '../services/workerApi';
import { formatDate, formatCurrency } from '../utils/helpers';

export default function WorkerProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Attendance stats state
  const [statsFilter, setStatsFilter] = useState('this-year');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    fetchWorker();
  }, [id]);

  // Fetch attendance stats when filter changes
  useEffect(() => {
    if (id && statsFilter !== 'custom') {
      fetchStats({ preset: statsFilter });
    }
  }, [id, statsFilter]);

  const fetchStats = async (params) => {
    try {
      setStatsLoading(true);
      const res = await attendanceAPI.getWorkerStats(id, params);
      setStats(res.data.data);
    } catch (err) {
      toast.error('Failed to load attendance stats');
    } finally {
      setStatsLoading(false);
    }
  };

  const handleCustomRange = () => {
    if (!customFrom || !customTo) {
      toast.error('Please select both start and end dates');
      return;
    }
    if (new Date(customFrom) > new Date(customTo)) {
      toast.error('Start date must be before end date');
      return;
    }
    fetchStats({ from: customFrom, to: customTo });
  };

  const fetchWorker = async () => {
    try {
      const res = await workerAPI.getById(id);
      setData(res.data.data);
    } catch (err) {
      toast.error('Failed to load worker');
      navigate('/workers');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Loader text="Loading worker profile..." />;
  if (!data) return null;

  const { worker, recentAttendance, recentAdvances, totalAdvanceGiven, salaryRecords } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/workers')} className="p-2 rounded-lg hover:bg-dark-hover text-gray-400 hover:text-gray-200 transition-colors">
          <HiOutlineArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-100">{worker.name}</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary-400/10 text-primary-400">
              {worker.role}
            </span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                worker.isActive
                  ? 'bg-emerald-400/10 text-emerald-400'
                  : 'bg-red-400/10 text-red-400'
              }`}
            >
              {worker.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card !p-4 flex items-center gap-3">
          <HiOutlinePhone className="w-8 h-8 text-primary-400 flex-shrink-0" />
          <div>
            <p className="text-xs text-gray-500">Phone</p>
            <p className="text-sm font-medium text-gray-200">{worker.phone || 'Not set'}</p>
          </div>
        </div>
        <div className="card !p-4 flex items-center gap-3">
          <HiOutlineBriefcase className="w-8 h-8 text-amber-400 flex-shrink-0" />
          <div>
            <p className="text-xs text-gray-500">Salary</p>
            <p className="text-sm font-medium text-gray-200">
              {worker.salaryType === 'Daily'
                ? `${formatCurrency(worker.dailyWage)}/day`
                : `${formatCurrency(worker.monthlySalary)}/mo`}
            </p>
          </div>
        </div>
        <div className="card !p-4 flex items-center gap-3">
          <HiOutlineClock className="w-8 h-8 text-purple-400 flex-shrink-0" />
          <div>
            <p className="text-xs text-gray-500">OT Rate</p>
            <p className="text-sm font-medium text-gray-200">{formatCurrency(worker.overtimeRate)}/hr</p>
          </div>
        </div>
        <div className="card !p-4 flex items-center gap-3">
          <HiOutlineCalendar className="w-8 h-8 text-emerald-400 flex-shrink-0" />
          <div>
            <p className="text-xs text-gray-500">Joined</p>
            <p className="text-sm font-medium text-gray-200">{formatDate(worker.joiningDate)}</p>
          </div>
        </div>
      </div>

      {/* ─── Attendance Stats with Filtering ───────────────────────── */}
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <HiOutlineChartBar className="w-5 h-5 text-primary-400" />
            <h2 className="text-lg font-semibold text-gray-100">Attendance Stats</h2>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <HiOutlineFilter className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <select
              value={statsFilter}
              onChange={(e) => setStatsFilter(e.target.value)}
              className="input !py-1.5 !px-3 !text-sm !w-auto min-w-[140px]"
            >
              <option value="this-month">This Month</option>
              <option value="last-month">Last Month</option>
              <option value="last-3-months">Last 3 Months</option>
              <option value="last-6-months">Last 6 Months</option>
              <option value="this-year">This Year</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>
        </div>

        {/* Custom date range picker */}
        {statsFilter === 'custom' && (
          <div className="flex flex-wrap items-end gap-3 mb-4 p-3 rounded-xl bg-dark-hover">
            <div>
              <label className="block text-xs text-gray-500 mb-1">From</label>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="input !py-1.5 !px-3 !text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">To</label>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="input !py-1.5 !px-3 !text-sm"
              />
            </div>
            <button
              onClick={handleCustomRange}
              className="btn-primary !py-1.5 !px-4 !text-sm"
            >
              Apply
            </button>
          </div>
        )}

        {statsLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin w-6 h-6 border-2 border-primary-400 border-t-transparent rounded-full" />
          </div>
        ) : stats ? (
          <>
            {/* Range label */}
            <p className="text-xs text-gray-500 mb-3">
              Showing stats for: <span className="text-gray-300 font-medium">{stats.range.label}</span>
            </p>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                <HiOutlineCheckCircle className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                <p className="text-lg font-bold text-emerald-400">{stats.summary.presentDays}</p>
                <p className="text-[10px] text-emerald-300/70 uppercase">Present Days</p>
              </div>
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-center">
                <HiOutlineXCircle className="w-5 h-5 text-red-400 mx-auto mb-1" />
                <p className="text-lg font-bold text-red-400">{stats.summary.absentDays}</p>
                <p className="text-[10px] text-red-300/70 uppercase">Absent Days</p>
              </div>
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
                <HiOutlineClock className="w-5 h-5 text-amber-400 mx-auto mb-1" />
                <p className="text-lg font-bold text-amber-400">{stats.summary.totalOvertimeHours}h</p>
                <p className="text-[10px] text-amber-300/70 uppercase">Total OT Hours</p>
              </div>
              <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-center">
                <HiOutlineChartBar className="w-5 h-5 text-purple-400 mx-auto mb-1" />
                <p className="text-lg font-bold text-purple-400">{stats.summary.overtimeDays}</p>
                <p className="text-[10px] text-purple-300/70 uppercase">OT Days</p>
              </div>
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-center">
                <HiOutlineCalendar className="w-5 h-5 text-blue-400 mx-auto mb-1" />
                <p className="text-lg font-bold text-blue-400">{stats.summary.attendancePercent}%</p>
                <p className="text-[10px] text-blue-300/70 uppercase">Attendance %</p>
              </div>
              <div className="p-3 rounded-xl bg-gray-500/10 border border-gray-500/20 text-center">
                <HiOutlineCalendar className="w-5 h-5 text-gray-400 mx-auto mb-1" />
                <p className="text-lg font-bold text-gray-400">{stats.summary.unmarked}</p>
                <p className="text-[10px] text-gray-400/70 uppercase">Unmarked</p>
              </div>
            </div>

            {/* Monthly Breakdown Table */}
            {stats.monthlyBreakdown.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-300 mb-2">Monthly Breakdown</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-dark-border">
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Month</th>
                        <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500">Present</th>
                        <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500">Absent</th>
                        <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500">OT Hours</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dark-border">
                      {stats.monthlyBreakdown.map((mb) => (
                        <tr key={mb.month} className="hover:bg-dark-hover">
                          <td className="py-2 px-3 text-sm text-gray-200">{mb.month}</td>
                          <td className="py-2 px-3 text-sm text-emerald-400 text-center font-medium">{mb.present}</td>
                          <td className="py-2 px-3 text-sm text-red-400 text-center">{mb.absent}</td>
                          <td className="py-2 px-3 text-sm text-amber-400 text-center">{mb.overtimeHours}h</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-dark-border font-semibold">
                        <td className="py-2 px-3 text-sm text-gray-300">Total</td>
                        <td className="py-2 px-3 text-sm text-emerald-400 text-center">{stats.summary.presentDays}</td>
                        <td className="py-2 px-3 text-sm text-red-400 text-center">{stats.summary.absentDays}</td>
                        <td className="py-2 px-3 text-sm text-amber-400 text-center">{stats.summary.totalOvertimeHours}h</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-500 text-center py-6">Select a filter to view attendance stats</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Attendance */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-100 mb-4">Recent Attendance (30 days)</h2>
          {recentAttendance.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">No attendance records yet</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {recentAttendance.map((a) => (
                <div key={a._id} className="flex items-center justify-between p-2 rounded-lg bg-dark-hover">
                  <span className="text-sm text-gray-300">{formatDate(a.date)}</span>
                  <div className="flex items-center gap-2">
                    {a.overtimeHours > 0 && (
                      <span className="text-xs text-amber-400">+{a.overtimeHours}h OT</span>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        a.status === 'Present'
                          ? 'bg-emerald-400/10 text-emerald-400'
                          : 'bg-red-400/10 text-red-400'
                      }`}
                    >
                      {a.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Advances */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-100">Recent Advances</h2>
            <span className="text-sm font-medium text-amber-400">
              Total: {formatCurrency(totalAdvanceGiven)}
            </span>
          </div>
          {recentAdvances.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">No advances yet</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {recentAdvances.map((adv) => (
                <div key={adv._id} className="flex items-center justify-between p-2 rounded-lg bg-dark-hover">
                  <span className="text-sm text-gray-300">{formatDate(adv.date)}</span>
                  <div className="text-right">
                    <span className="text-sm font-medium text-red-400">{formatCurrency(adv.amount)}</span>
                    {adv.note && <p className="text-xs text-gray-500">{adv.note}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Salary History */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-100 mb-4">Salary History</h2>
        {salaryRecords.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-6">No salary records yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-border">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Month</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500">Days</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500">OT Hrs</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Gross</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Advance</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Net</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border">
                {salaryRecords.map((s) => (
                  <tr key={s._id} className="hover:bg-dark-hover">
                    <td className="py-2 px-3 text-sm text-gray-200">{s.month}/{s.year}</td>
                    <td className="py-2 px-3 text-sm text-gray-400 text-center">{s.presentDays}/{s.totalDays}</td>
                    <td className="py-2 px-3 text-sm text-gray-400 text-center">{s.overtimeHours}</td>
                    <td className="py-2 px-3 text-sm text-gray-200 text-right">{formatCurrency(s.grossSalary)}</td>
                    <td className="py-2 px-3 text-sm text-red-400 text-right">{formatCurrency(s.totalAdvance)}</td>
                    <td className="py-2 px-3 text-sm font-medium text-emerald-400 text-right">{formatCurrency(s.netPayable)}</td>
                    <td className="py-2 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          s.paymentStatus === 'PAID'
                            ? 'bg-emerald-400/10 text-emerald-400'
                            : 'bg-amber-400/10 text-amber-400'
                        }`}
                      >
                        {s.paymentStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
