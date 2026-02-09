import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  HiOutlineUserGroup,
  HiOutlineClipboardCheck,
  HiOutlineCurrencyRupee,
  HiOutlineClock,
  HiOutlineTrendingUp,
  HiOutlineExclamation,
  HiOutlineBell,
} from 'react-icons/hi';
import StatCard from '../components/StatCard';
import Loader from '../components/Loader';
import AlertBanner from '../components/AlertBanner';
import { salaryAPI } from '../services/workerApi';
import { formatCurrency } from '../utils/helpers';

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export default function WorkerDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const { data } = await salaryAPI.getDashboard();
      setStats(data.data);
    } catch (err) {
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Loader text="Loading dashboard..." />;
  if (!stats) return null;

  const currentMonth = MONTH_NAMES[new Date().getMonth()];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Worker & Payroll Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Overview for {currentMonth} {new Date().getFullYear()}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => navigate('/workers')} className="btn-primary text-sm">
            Manage Workers
          </button>
          <button onClick={() => navigate('/worker-attendance')} className="btn-secondary text-sm">
            Mark Attendance
          </button>
        </div>
      </div>

      {/* ─── Important Alerts ─────────────────────────────────────── */}
      {stats.monthlySalary.pendingCount > 0 && (
        <AlertBanner
          variant="warning"
          icon={HiOutlineBell}
          pulse
          title={`${stats.monthlySalary.pendingCount} Salary Payment${stats.monthlySalary.pendingCount > 1 ? 's' : ''} Pending`}
          message={`Total unpaid: ${formatCurrency(stats.monthlySalary.totalNet - (stats.monthlySalary.totalNet * stats.monthlySalary.paidCount / (stats.monthlySalary.paidCount + stats.monthlySalary.pendingCount)))} for ${currentMonth} ${new Date().getFullYear()}. Go to Salary Sheet to mark as paid.`}
          action={() => navigate('/worker-salary')}
          actionLabel="Go to Salary Sheet →"
        />
      )}
      {stats.todayAttendance.unmarked > 0 && (
        <AlertBanner
          variant="info"
          icon={HiOutlineClipboardCheck}
          title={`${stats.todayAttendance.unmarked} Worker${stats.todayAttendance.unmarked > 1 ? 's' : ''} Unmarked Today`}
          message="Attendance has not been marked for some workers. Mark attendance to keep records up to date."
          action={() => navigate('/worker-attendance')}
          actionLabel="Mark Attendance →"
        />
      )}
      {stats.advanceOutstanding > 5000 && (
        <AlertBanner
          variant="danger"
          title="High Advance Outstanding"
          message={`Total outstanding advances: ${formatCurrency(stats.advanceOutstanding)}. Review and settle advances during salary processing.`}
          action={() => navigate('/worker-advances')}
          actionLabel="View Advances →"
        />
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          icon={HiOutlineUserGroup}
          label="Active Workers"
          value={stats.totalWorkers}
          color="primary"
          subtext={stats.totalInactive > 0 ? `${stats.totalInactive} inactive` : undefined}
        />
        <StatCard
          icon={HiOutlineClipboardCheck}
          label="Present Today"
          value={stats.todayAttendance.present}
          color="green"
          subtext={`${stats.todayAttendance.absent} absent`}
        />
        <StatCard
          icon={HiOutlineExclamation}
          label="Unmarked Today"
          value={stats.todayAttendance.unmarked}
          color="yellow"
        />
        <StatCard
          icon={HiOutlineCurrencyRupee}
          label="Monthly Gross"
          value={formatCurrency(stats.monthlySalary.totalGross)}
          color="purple"
        />
        <StatCard
          icon={HiOutlineTrendingUp}
          label="Net Payable"
          value={formatCurrency(stats.monthlySalary.totalNet)}
          color="green"
          subtext={`${stats.monthlySalary.paidCount} paid / ${stats.monthlySalary.pendingCount} pending`}
        />
        <StatCard
          icon={HiOutlineClock}
          label="Advance Outstanding"
          value={formatCurrency(stats.advanceOutstanding)}
          color="red"
        />
      </div>

      {/* Quick Actions + Top Overtime */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-100 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => navigate('/worker-attendance')}
              className="p-4 rounded-xl bg-dark-hover border border-dark-border hover:border-primary-500/50 transition-colors text-left"
            >
              <HiOutlineClipboardCheck className="w-8 h-8 text-emerald-400 mb-2" />
              <p className="text-sm font-medium text-gray-200">Daily Attendance</p>
              <p className="text-xs text-gray-500">Mark today's attendance</p>
            </button>
            <button
              onClick={() => navigate('/worker-advances')}
              className="p-4 rounded-xl bg-dark-hover border border-dark-border hover:border-primary-500/50 transition-colors text-left"
            >
              <HiOutlineCurrencyRupee className="w-8 h-8 text-amber-400 mb-2" />
              <p className="text-sm font-medium text-gray-200">Give Advance</p>
              <p className="text-xs text-gray-500">Record advance payment</p>
            </button>
            <button
              onClick={() => navigate('/worker-salary')}
              className="p-4 rounded-xl bg-dark-hover border border-dark-border hover:border-primary-500/50 transition-colors text-left"
            >
              <HiOutlineTrendingUp className="w-8 h-8 text-purple-400 mb-2" />
              <p className="text-sm font-medium text-gray-200">Salary Sheet</p>
              <p className="text-xs text-gray-500">Generate & view salaries</p>
            </button>
            <button
              onClick={() => navigate('/workers')}
              className="p-4 rounded-xl bg-dark-hover border border-dark-border hover:border-primary-500/50 transition-colors text-left"
            >
              <HiOutlineUserGroup className="w-8 h-8 text-blue-400 mb-2" />
              <p className="text-sm font-medium text-gray-200">Workers</p>
              <p className="text-xs text-gray-500">Manage worker profiles</p>
            </button>
          </div>
        </div>

        {/* Top Overtime Workers */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-100 mb-4">Top Overtime Workers</h2>
          {stats.topOvertime.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No overtime this month</p>
          ) : (
            <div className="space-y-3">
              {stats.topOvertime.map((w, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 rounded-lg bg-dark-hover"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-sm font-bold text-white">
                      {i + 1}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-200">{w.name}</p>
                      <p className="text-xs text-gray-500">{w.role}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-amber-400">{w.totalOT} hrs</p>
                    <p className="text-xs text-gray-500">overtime</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
