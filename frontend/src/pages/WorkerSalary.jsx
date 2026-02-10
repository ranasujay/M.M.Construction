import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  HiOutlineRefresh,
  HiOutlineCheckCircle,
  HiOutlineCurrencyRupee,
  HiOutlineBell,
  HiOutlineExclamationCircle,
} from 'react-icons/hi';
import Loader from '../components/Loader';
import EmptyState from '../components/EmptyState';
import MonthYearPicker from '../components/MonthYearPicker';
import Modal from '../components/Modal';
import AlertBanner from '../components/AlertBanner';
import ConfirmDialog from '../components/ConfirmDialog';
import { salaryAPI } from '../services/workerApi';
import { formatCurrency } from '../utils/helpers';

export default function WorkerSalary() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [records, setRecords] = useState([]);
  const [totals, setTotals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generateConfirm, setGenerateConfirm] = useState(false);

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    fetchRecords();
  }, [month, year]);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const { data } = await salaryAPI.getRecords(month, year);
      setRecords(data.data);
      setTotals(data.totals);
    } catch (err) {
      toast.error('Failed to load salary records');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAll = async () => {
    setGenerateConfirm(false);
    setGenerating(true);
    try {
      const { data } = await salaryAPI.generateAll(month, year);
      toast.success(data.message);
      fetchRecords();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate salaries');
    } finally {
      setGenerating(false);
    }
  };

  const handleMarkPaid = async (id, workerName) => {
    // Find record for confirmation details
    const record = records.find((r) => r._id === id);
    setConfirmTarget({ id, name: workerName, record });
    setConfirmModal(true);
  };

  const confirmMarkPaid = async () => {
    if (!confirmTarget) return;
    setMarking(true);
    try {
      await salaryAPI.markPaid(confirmTarget.id);
      toast.success(`✅ ${confirmTarget.name} salary marked as PAID`);
      fetchRecords();
    } catch (err) {
      toast.error('Failed to mark as paid');
    } finally {
      setMarking(false);
      setConfirmModal(false);
      setConfirmTarget(null);
    }
  };

  // Count pending
  const pendingRecords = records.filter((r) => r.paymentStatus === 'PENDING');
  const pendingTotal = pendingRecords.reduce((sum, r) => sum + r.netPayable, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Monthly Salary Sheet</h1>
          <p className="text-sm text-gray-500 mt-1">{records.length} salary records</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <MonthYearPicker month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y); }} />
          <button
            onClick={() => setGenerateConfirm(true)}
            disabled={generating}
            className="btn-primary flex items-center gap-2"
          >
            <HiOutlineRefresh className={`w-5 h-5 ${generating ? 'animate-spin' : ''}`} />
            {generating ? 'Generating...' : 'Generate All'}
          </button>
        </div>
      </div>

      {/* Pending Payments Alert */}
      {pendingRecords.length > 0 && (
        <AlertBanner
          variant="warning"
          icon={HiOutlineBell}
          pulse
          title={`${pendingRecords.length} Pending Payment${pendingRecords.length > 1 ? 's' : ''}`}
          message={`Total unpaid salary: ${formatCurrency(pendingTotal)} for this month. Mark as paid after disbursing salary.`}
          dismissible
        />
      )}

      {/* Confirmation Modal */}
      <Modal isOpen={confirmModal} onClose={() => { setConfirmModal(false); setConfirmTarget(null); }} title="Confirm Salary Payment" size="sm">
        {confirmTarget && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <HiOutlineExclamationCircle className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-200">Are you sure you want to mark this salary as PAID?</p>
                <p className="text-xs text-amber-300/70 mt-1">This action confirms that the salary has been disbursed. It cannot be undone.</p>
              </div>
            </div>
            <div className="bg-dark-hover rounded-xl p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-400">Worker</span>
                <span className="text-sm font-semibold text-gray-100">{confirmTarget.name}</span>
              </div>
              {confirmTarget.record && (
                <>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-400">Gross Salary</span>
                    <span className="text-sm text-gray-200">{formatCurrency(confirmTarget.record.grossSalary)}</span>
                  </div>
                  {confirmTarget.record.overtimeAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-400">Overtime</span>
                      <span className="text-sm text-amber-400">+{formatCurrency(confirmTarget.record.overtimeAmount)}</span>
                    </div>
                  )}
                  {confirmTarget.record.totalAdvance > 0 && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-400">Advance Deducted</span>
                      <span className="text-sm text-red-400">-{formatCurrency(confirmTarget.record.totalAdvance)}</span>
                    </div>
                  )}
                  <div className="border-t border-dark-border pt-2 flex justify-between">
                    <span className="text-sm font-semibold text-gray-300">Net Payable</span>
                    <span className="text-base font-bold text-emerald-400">{formatCurrency(confirmTarget.record.netPayable)}</span>
                  </div>
                </>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setConfirmModal(false); setConfirmTarget(null); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-dark-hover text-gray-300 hover:bg-dark-border transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmMarkPaid}
                disabled={marking}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <HiOutlineCheckCircle className="w-5 h-5" />
                {marking ? 'Processing...' : 'Confirm Paid'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Totals Cards */}
      {totals && records.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="card !p-4 text-center">
            <p className="text-xs text-gray-500 uppercase">Gross Salary</p>
            <p className="text-lg font-bold text-gray-100 mt-1">{formatCurrency(totals.grossSalary)}</p>
          </div>
          <div className="card !p-4 text-center">
            <p className="text-xs text-gray-500 uppercase">Overtime</p>
            <p className="text-lg font-bold text-amber-400 mt-1">{formatCurrency(totals.overtimeAmount)}</p>
          </div>
          <div className="card !p-4 text-center">
            <p className="text-xs text-gray-500 uppercase">Advances</p>
            <p className="text-lg font-bold text-red-400 mt-1">{formatCurrency(totals.totalAdvance)}</p>
          </div>
          <div className="card !p-4 text-center">
            <p className="text-xs text-gray-500 uppercase">Net Payable</p>
            <p className="text-lg font-bold text-emerald-400 mt-1">{formatCurrency(totals.netPayable)}</p>
          </div>
        </div>
      )}

      {/* Salary Table */}
      {loading ? (
        <Loader text="Loading salary records..." />
      ) : records.length === 0 ? (
        <EmptyState
          icon={HiOutlineCurrencyRupee}
          title="No salary records"
          description="Click 'Generate All' to calculate salaries for this month based on attendance and advances"
          action={
            <button onClick={() => setGenerateConfirm(true)} disabled={generating} className="btn-primary">
              Generate Salaries
            </button>
          }
        />
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-2 lg:hidden">
            {records.map((r) => (
              <div key={r._id} className="card !p-3">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-200 truncate">{r.worker?.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-primary-400/10 text-primary-400">{r.worker?.role}</span>
                      <span className="text-xs text-gray-500">{r.worker?.salaryType}</span>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
                      r.paymentStatus === 'PAID'
                        ? 'bg-emerald-400/10 text-emerald-400'
                        : 'bg-amber-400/10 text-amber-400'
                    }`}
                  >
                    {r.paymentStatus}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2 mt-3 text-center">
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase">Days</p>
                    <p className="text-xs font-medium text-gray-300">
                      <span className="text-emerald-400">{r.presentDays}</span>/{r.totalDays}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase">Gross</p>
                    <p className="text-xs font-medium text-gray-200">{formatCurrency(r.grossSalary)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase">Advance</p>
                    <p className="text-xs font-medium text-red-400">{formatCurrency(r.totalAdvance)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase">Net</p>
                    <p className={`text-xs font-bold ${r.netPayable >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {formatCurrency(r.netPayable)}
                    </p>
                  </div>
                </div>
                {r.overtimeHours > 0 && (
                  <p className="text-[10px] text-amber-400 mt-1">OT: {r.overtimeHours}h = {formatCurrency(r.overtimeAmount)}</p>
                )}
                {r.paymentStatus === 'PENDING' && (
                  <button
                    onClick={() => handleMarkPaid(r._id, r.worker?.name)}
                    className="w-full mt-2 py-2 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 active:bg-emerald-500/20 flex items-center justify-center gap-1"
                  >
                    <HiOutlineCheckCircle className="w-4 h-4" /> Mark as Paid
                  </button>
                )}
              </div>
            ))}
            {/* Mobile totals */}
            <div className="card !p-3 bg-dark-bg border-t-2 border-dark-border">
              <p className="text-xs font-semibold text-gray-400 mb-2">Grand Total</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[10px] text-gray-500">Gross</p>
                  <p className="text-sm font-bold text-gray-100">{formatCurrency(totals.grossSalary)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500">Advance</p>
                  <p className="text-sm font-bold text-red-400">{formatCurrency(totals.totalAdvance)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500">Net</p>
                  <p className="text-sm font-bold text-emerald-400">{formatCurrency(totals.netPayable)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Desktop table */}
          <div className="overflow-x-auto hidden lg:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-border">
                  <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase">Worker</th>
                  <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase">Role</th>
                  <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase">Type</th>
                  <th className="text-center py-3 px-3 text-xs font-semibold text-gray-500 uppercase">Days</th>
                  <th className="text-center py-3 px-3 text-xs font-semibold text-gray-500 uppercase">OT Hrs</th>
                  <th className="text-right py-3 px-3 text-xs font-semibold text-gray-500 uppercase">Gross</th>
                  <th className="text-right py-3 px-3 text-xs font-semibold text-gray-500 uppercase">OT Amt</th>
                  <th className="text-right py-3 px-3 text-xs font-semibold text-gray-500 uppercase">Advance</th>
                  <th className="text-right py-3 px-3 text-xs font-semibold text-gray-500 uppercase">Net</th>
                  <th className="text-center py-3 px-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="text-right py-3 px-3 text-xs font-semibold text-gray-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border">
                {records.map((r) => (
                  <tr key={r._id} className="hover:bg-dark-hover transition-colors">
                    <td className="py-3 px-3">
                      <p className="text-sm font-medium text-gray-200">{r.worker?.name}</p>
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary-400/10 text-primary-400">
                        {r.worker?.role}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-xs text-gray-400">{r.worker?.salaryType}</td>
                    <td className="py-3 px-3 text-sm text-gray-300 text-center">
                      <span className="text-emerald-400">{r.presentDays}</span>
                      <span className="text-gray-600">/</span>
                      <span className="text-gray-500">{r.totalDays}</span>
                    </td>
                    <td className="py-3 px-3 text-sm text-amber-400 text-center">{r.overtimeHours}</td>
                    <td className="py-3 px-3 text-sm text-gray-200 text-right">{formatCurrency(r.grossSalary)}</td>
                    <td className="py-3 px-3 text-sm text-amber-400 text-right">{formatCurrency(r.overtimeAmount)}</td>
                    <td className="py-3 px-3 text-sm text-red-400 text-right">{formatCurrency(r.totalAdvance)}</td>
                    <td className="py-3 px-3 text-sm font-semibold text-right">
                      <span className={r.netPayable >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                        {formatCurrency(r.netPayable)}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          r.paymentStatus === 'PAID'
                            ? 'bg-emerald-400/10 text-emerald-400'
                            : 'bg-amber-400/10 text-amber-400'
                        }`}
                      >
                        {r.paymentStatus}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      {r.paymentStatus === 'PENDING' && (
                        <button
                          onClick={() => handleMarkPaid(r._id, r.worker?.name)}
                          className="p-1.5 rounded-lg hover:bg-emerald-400/10 text-gray-400 hover:text-emerald-400 transition-colors"
                          title="Mark as Paid"
                        >
                          <HiOutlineCheckCircle className="w-5 h-5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-dark-border font-semibold">
                  <td colSpan={5} className="py-3 px-3 text-sm text-gray-300">Grand Total</td>
                  <td className="py-3 px-3 text-sm text-gray-100 text-right">{formatCurrency(totals.grossSalary)}</td>
                  <td className="py-3 px-3 text-sm text-amber-400 text-right">{formatCurrency(totals.overtimeAmount)}</td>
                  <td className="py-3 px-3 text-sm text-red-400 text-right">{formatCurrency(totals.totalAdvance)}</td>
                  <td className="py-3 px-3 text-sm text-emerald-400 text-right font-bold">{formatCurrency(totals.netPayable)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}

      <ConfirmDialog
        isOpen={generateConfirm}
        onClose={() => setGenerateConfirm(false)}
        onConfirm={handleGenerateAll}
        title="Generate All Salaries?"
        message={`This will calculate/recalculate salaries for all workers for ${new Date(year, month - 1).toLocaleString('default', { month: 'long' })} ${year}. Existing unpaid records will be updated.`}
        confirmText="Generate"
        variant="warning"
      />
    </div>
  );
}
