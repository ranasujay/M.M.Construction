import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  HiOutlineShieldCheck,
  HiOutlineDownload,
  HiOutlineTrash,
  HiOutlineCheckCircle,
  HiOutlineExclamationCircle,
  HiOutlineRefresh,
  HiOutlineEye,
  HiOutlineLockClosed,
  HiOutlineDocumentDownload,
  HiOutlineDatabase,
  HiOutlineArchive,
} from 'react-icons/hi';
import {
  getFinancialYearPreview,
  getFinancialYearStatus,
  createFinancialYearBackup,
  downloadFinancialYearBackup,
  verifyFinancialYearBackup,
  deleteFinancialYearData,
  getBackupRecords,
} from '../services/financialYearApi';
import Loader from '../components/Loader';
import StatCard from '../components/StatCard';

// ─── Generate FY options (last 10 years, excludes current) ───────────
function generateFYOptions() {
  const now = new Date();
  const currentFYStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const options = [];
  for (let i = 1; i <= 10; i++) {
    const start = currentFYStart - i;
    options.push(`${start}-${start + 1}`);
  }
  return options;
}

function formatCurrency(val) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(val || 0);
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// ─── Progress Steps ──────────────────────────────────────────────────
const STEPS = [
  { key: 'preview', label: 'Preview Summary', icon: HiOutlineEye },
  { key: 'backup', label: 'Create Backup', icon: HiOutlineArchive },
  { key: 'download', label: 'Download & Verify', icon: HiOutlineDownload },
  { key: 'delete', label: 'Delete Data', icon: HiOutlineTrash },
];

export default function FinancialYearClose() {
  const fyOptions = generateFYOptions();
  const [selectedFY, setSelectedFY] = useState('');
  const [loading, setLoading] = useState(false);
  const [stepLoading, setStepLoading] = useState('');
  const [status, setStatus] = useState(null);
  const [summary, setSummary] = useState(null);
  const [openBillCount, setOpenBillCount] = useState(0);
  const [backup, setBackup] = useState(null);
  const [backupHistory, setBackupHistory] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [downloaded, setDownloaded] = useState(false);

  // Deletion modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmCheck, setConfirmCheck] = useState(false);
  const [deletionResult, setDeletionResult] = useState(null);

  // ─── Fetch Status ──────────────────────────────────────────────────
  const fetchStatus = useCallback(async (fy) => {
    if (!fy) return;
    setLoading(true);
    setSummary(null);
    setStatus(null);
    setBackup(null);
    setDeletionResult(null);
    setCurrentStep(0);
    setDownloaded(false);

    try {
      const { data } = await getFinancialYearStatus(fy);
      const s = data.data;
      setStatus(s);

      if (s.isDeleted) {
        setCurrentStep(4);
      } else if (s.hasVerifiedBackup) {
        setCurrentStep(3);
        setDownloaded(true);
      } else if (s.hasBackup) {
        setCurrentStep(2);
      } else if (s.hasSummary) {
        setCurrentStep(1);
      }

      if (s.summary) setSummary(s.summary);
      if (s.latestBackup) setBackup(s.latestBackup);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to fetch FY status');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchBackupHistory = useCallback(async () => {
    try {
      const { data } = await getBackupRecords();
      setBackupHistory(data.data || []);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    fetchBackupHistory();
  }, [fetchBackupHistory]);

  useEffect(() => {
    if (selectedFY) fetchStatus(selectedFY);
  }, [selectedFY, fetchStatus]);

  // ─── Step 1: Preview ──────────────────────────────────────────────
  const handlePreview = async () => {
    setStepLoading('preview');
    try {
      const { data } = await getFinancialYearPreview(selectedFY);
      const d = data.data;
      setSummary(d.summary);
      setOpenBillCount(d.openBillCount || 0);
      if (d.alreadyDeleted) {
        setCurrentStep(4);
        toast.success('This FY data has already been deleted.');
      } else {
        setCurrentStep(1);
        toast.success('Preview generated successfully.');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Preview failed');
    } finally {
      setStepLoading('');
    }
  };

  // ─── Step 2: Create Backup ────────────────────────────────────────
  const handleBackup = async () => {
    setStepLoading('backup');
    try {
      const { data } = await createFinancialYearBackup(selectedFY);
      setBackup(data.data.backupRecord);
      setCurrentStep(2);
      setDownloaded(false);
      toast.success('Backup ZIP created! Please download it now.');
      fetchBackupHistory();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Backup creation failed');
    } finally {
      setStepLoading('');
    }
  };

  // ─── Step 3a: Download ZIP ────────────────────────────────────────
  const handleDownload = async () => {
    setStepLoading('download');
    try {
      const response = await downloadFinancialYearBackup(selectedFY);
      // Create download link
      const blob = new Blob([response.data], { type: 'application/zip' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = backup?.fileName || `factory_backup_FY_${selectedFY}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setDownloaded(true);
      toast.success('Backup downloaded! Please save it safely (Google Drive, external drive, etc.)');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Download failed');
    } finally {
      setStepLoading('');
    }
  };

  // ─── Step 3b: Confirm Downloaded ──────────────────────────────────
  const handleVerify = async () => {
    setStepLoading('verify');
    try {
      const { data } = await verifyFinancialYearBackup(selectedFY);
      setBackup(data.data.backupRecord);
      setCurrentStep(3);
      toast.success('Backup confirmed! You can now delete the FY data.');
      fetchBackupHistory();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Verification failed');
    } finally {
      setStepLoading('');
    }
  };

  // ─── Step 4: Delete ───────────────────────────────────────────────
  const handleDelete = async () => {
    if (!confirmCheck) {
      toast.error('Please confirm by checking the checkbox.');
      return;
    }
    if (!password) {
      toast.error('Please enter your password.');
      return;
    }

    setStepLoading('delete');
    try {
      const { data } = await deleteFinancialYearData(selectedFY, password);
      setDeletionResult(data.data);
      setCurrentStep(4);
      setShowDeleteModal(false);
      setPassword('');
      setConfirmCheck(false);
      toast.success(`FY ${selectedFY} data has been permanently deleted.`);
      fetchStatus(selectedFY);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Deletion failed');
    } finally {
      setStepLoading('');
    }
  };

  const isCurrent = status?.isCurrent;
  const isDeleted = status?.isDeleted || summary?.isDeleted;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <HiOutlineDatabase className="w-7 h-7 text-primary-400" />
            Financial Year Closing
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Export, backup, download, and safely delete old financial year data.
          </p>
        </div>
      </div>

      {/* ═══════════ FINANCIAL YEAR CLOSING SECTION ═══════════ */}

      {/* FY Selector */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-6">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Select Financial Year
        </label>
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={selectedFY}
            onChange={(e) => setSelectedFY(e.target.value)}
            className="flex-1 bg-dark-bg border border-dark-border rounded-lg px-4 py-2.5 text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">-- Select Financial Year --</option>
            {fyOptions.map((fy) => (
              <option key={fy} value={fy}>
                FY {fy} (Apr {fy.split('-')[0]} — Mar {fy.split('-')[1]})
              </option>
            ))}
          </select>
          {selectedFY && (
            <button
              onClick={() => fetchStatus(selectedFY)}
              className="flex items-center gap-2 px-4 py-2.5 bg-dark-hover text-gray-300 hover:text-white rounded-lg transition-colors"
            >
              <HiOutlineRefresh className="w-4 h-4" />
              Refresh
            </button>
          )}
        </div>

        {isCurrent && (
          <div className="mt-3 flex items-center gap-2 text-amber-400 text-sm">
            <HiOutlineExclamationCircle className="w-5 h-5" />
            This is the current financial year and cannot be closed.
          </div>
        )}
      </div>

      {loading && <Loader />}

      {selectedFY && !loading && !isCurrent && (
        <>
          {/* Progress Steps */}
          <div className="bg-dark-card border border-dark-border rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Closing Progress</h2>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-0">
              {STEPS.map((step, idx) => {
                const done = currentStep > idx;
                const active = currentStep === idx;
                const Icon = step.icon;

                return (
                  <div key={step.key} className="flex-1 flex items-center gap-2">
                    <div
                      className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all ${
                        done
                          ? 'bg-green-600 border-green-600 text-white'
                          : active
                          ? 'border-primary-500 text-primary-400 bg-primary-500/10'
                          : 'border-dark-border text-gray-500'
                      }`}
                    >
                      {done ? (
                        <HiOutlineCheckCircle className="w-5 h-5" />
                      ) : (
                        <Icon className="w-5 h-5" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p
                        className={`text-sm font-medium ${
                          done ? 'text-green-400' : active ? 'text-primary-400' : 'text-gray-500'
                        }`}
                      >
                        {step.label}
                      </p>
                    </div>
                    {idx < STEPS.length - 1 && (
                      <div
                        className={`hidden sm:block w-8 h-0.5 ${
                          done ? 'bg-green-600' : 'bg-dark-border'
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {isDeleted && (
              <div className="mt-4 flex items-center gap-2 text-green-400 bg-green-900/20 border border-green-800 px-4 py-3 rounded-lg">
                <HiOutlineCheckCircle className="w-5 h-5 flex-shrink-0" />
                <span>
                  This financial year has been closed and data deleted. The backup was downloaded before deletion.
                </span>
              </div>
            )}
          </div>

          {/* Summary Preview */}
          {summary && (
            <div className="bg-dark-card border border-dark-border rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">
                  FY {selectedFY} Summary
                </h2>
                <span className="text-xs text-gray-500">
                  {formatDate(summary.startDate)} — {formatDate(summary.endDate)}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                <StatCard title="Total Sales" value={formatCurrency(summary.totalSales)} icon={HiOutlineDocumentDownload} color="blue" />
                <StatCard title="Total Purchases" value={formatCurrency(summary.totalPurchases)} icon={HiOutlineDocumentDownload} color="purple" />
                <StatCard title="Payments Received" value={formatCurrency(summary.totalPaymentsReceived)} icon={HiOutlineDocumentDownload} color="green" />
                <StatCard title="Supplier Payments" value={formatCurrency(summary.totalSupplierPayments)} icon={HiOutlineDocumentDownload} color="orange" />
                <StatCard title="Salary Expense" value={formatCurrency(summary.totalSalaryExpense)} icon={HiOutlineDocumentDownload} color="red" />
                <StatCard title="Advances Given" value={formatCurrency(summary.totalAdvances)} icon={HiOutlineDocumentDownload} color="yellow" />
                <StatCard title="Custom Expenses" value={formatCurrency(summary.totalCustomExpenses)} icon={HiOutlineDocumentDownload} color="gray" />
                <StatCard title="Outstanding Due" value={formatCurrency(summary.outstandingDue)} icon={HiOutlineExclamationCircle} color="red" />
              </div>

              {/* Record counts */}
              <div className="bg-dark-bg rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-400 mb-3">Records in this FY</h3>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
                  {[
                    { label: 'Bills', count: summary.billCount },
                    { label: 'Payments', count: summary.paymentCount },
                    { label: 'Purchases', count: summary.purchaseCount },
                    { label: 'Attendance', count: summary.attendanceCount },
                    { label: 'Advances', count: summary.advanceCount },
                    { label: 'Salary Records', count: summary.salaryRecordCount },
                    { label: 'Stock Logs', count: summary.stockLogCount },
                    { label: 'Activity Logs', count: summary.activityLogCount },
                    { label: 'Supplier Payments', count: summary.supplierPaymentCount },
                    { label: 'Custom Expenses', count: summary.customExpenseCount },
                  ].map((r) => (
                    <div key={r.label} className="flex justify-between text-gray-300">
                      <span>{r.label}</span>
                      <span className="font-semibold text-white">{r.count ?? 0}</span>
                    </div>
                  ))}
                </div>
              </div>

              {openBillCount > 0 && (
                <div className="flex items-center gap-2 text-amber-400 bg-amber-900/20 border border-amber-800 px-4 py-3 rounded-lg text-sm">
                  <HiOutlineExclamationCircle className="w-5 h-5 flex-shrink-0" />
                  <span>
                    <strong>{openBillCount} open bill(s)</strong> with unsettled dues exist in this FY.
                    All dues must be settled before deletion.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          {!isDeleted && (
            <div className="bg-dark-card border border-dark-border rounded-xl p-6 space-y-4">
              <h2 className="text-lg font-semibold text-white">Actions</h2>

              <div className="flex flex-wrap gap-3">
                {/* Step 1: Preview */}
                <button
                  onClick={handlePreview}
                  disabled={stepLoading === 'preview'}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {stepLoading === 'preview' ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <HiOutlineEye className="w-5 h-5" />
                  )}
                  {stepLoading === 'preview' ? 'Generating...' : 'Generate Preview'}
                </button>

                {/* Step 2: Create Backup */}
                {currentStep >= 1 && (
                  <button
                    onClick={handleBackup}
                    disabled={stepLoading === 'backup'}
                    className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    {stepLoading === 'backup' ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <HiOutlineArchive className="w-5 h-5" />
                    )}
                    {stepLoading === 'backup' ? 'Creating...' : 'Create Backup ZIP'}
                  </button>
                )}

                {/* Step 3a: Download */}
                {currentStep >= 2 && (
                  <button
                    onClick={handleDownload}
                    disabled={stepLoading === 'download'}
                    className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    {stepLoading === 'download' ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <HiOutlineDownload className="w-5 h-5" />
                    )}
                    {stepLoading === 'download' ? 'Downloading...' : 'Download Backup'}
                  </button>
                )}

                {/* Step 3b: Confirm Downloaded */}
                {currentStep >= 2 && downloaded && !backup?.verified && (
                  <button
                    onClick={handleVerify}
                    disabled={stepLoading === 'verify'}
                    className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    {stepLoading === 'verify' ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <HiOutlineShieldCheck className="w-5 h-5" />
                    )}
                    {stepLoading === 'verify' ? 'Confirming...' : 'Confirm Backup Saved'}
                  </button>
                )}

                {/* Step 4: Delete */}
                {currentStep >= 3 && (
                  <button
                    onClick={() => setShowDeleteModal(true)}
                    disabled={openBillCount > 0}
                    className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <HiOutlineTrash className="w-5 h-5" />
                    Delete FY Data
                  </button>
                )}
              </div>

              {/* Backup Info */}
              {backup && (
                <div className="bg-dark-bg border border-dark-border rounded-lg p-4 space-y-2">
                  <h3 className="text-sm font-medium text-gray-300">Latest Backup</h3>
                  <div className="text-sm text-gray-400 space-y-1">
                    <p>
                      <span className="text-gray-500">File:</span>{' '}
                      <span className="text-gray-200">{backup.fileName}</span>
                    </p>
                    <p>
                      <span className="text-gray-500">Size:</span>{' '}
                      <span className="text-gray-200">{formatBytes(backup.fileSizeBytes)}</span>
                    </p>
                    <p>
                      <span className="text-gray-500">Date:</span>{' '}
                      <span className="text-gray-200">{formatDate(backup.backupDate)}</span>
                    </p>
                    <p>
                      <span className="text-gray-500">Status:</span>{' '}
                      {backup.verified ? (
                        <span className="text-green-400 font-medium">Downloaded & Confirmed ✓</span>
                      ) : (
                        <span className="text-amber-400 font-medium">Awaiting download confirmation</span>
                      )}
                    </p>
                  </div>
                </div>
              )}

              {/* Info banner */}
              {currentStep >= 2 && !backup?.verified && (
                <div className="flex items-start gap-2 text-blue-300 bg-blue-900/20 border border-blue-800 px-4 py-3 rounded-lg text-sm">
                  <HiOutlineDownload className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Download & save this backup safely</p>
                    <p className="text-blue-400 mt-1">
                      After downloading, save the ZIP file to Google Drive, an external hard drive,
                      or any safe location. Then click &quot;Confirm Backup Saved&quot; to proceed.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Deletion Result */}
          {deletionResult && (
            <div className="bg-dark-card border border-green-800 rounded-xl p-6 space-y-3">
              <h2 className="text-lg font-semibold text-green-400 flex items-center gap-2">
                <HiOutlineCheckCircle className="w-6 h-6" />
                Deletion Complete
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
                {Object.entries(deletionResult.deletionCounts || {}).map(([key, count]) => (
                  <div key={key} className="flex justify-between text-gray-300">
                    <span className="capitalize">{key}</span>
                    <span className="font-semibold text-red-400">{count} removed</span>
                  </div>
                ))}
              </div>
              {deletionResult.backupFileName && (
                <p className="text-sm text-gray-400">
                  Backup file: <span className="text-gray-200">{deletionResult.backupFileName}</span>
                </p>
              )}
            </div>
          )}
        </>
      )}

      {/* Backup History */}
      {backupHistory.length > 0 && (
        <div className="bg-dark-card border border-dark-border rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Backup History</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-400 uppercase border-b border-dark-border">
                <tr>
                  <th className="px-4 py-3">FY</th>
                  <th className="px-4 py-3">File</th>
                  <th className="px-4 py-3">Size</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border">
                {backupHistory.map((rec) => (
                  <tr key={rec._id} className="hover:bg-dark-hover">
                    <td className="px-4 py-3 text-gray-200 font-medium">{rec.financialYear}</td>
                    <td className="px-4 py-3 text-gray-400">{rec.fileName}</td>
                    <td className="px-4 py-3 text-gray-400">{formatBytes(rec.fileSizeBytes)}</td>
                    <td className="px-4 py-3 text-gray-400">{formatDate(rec.backupDate)}</td>
                    <td className="px-4 py-3">
                      {rec.verified ? (
                        <span className="text-green-400">✓ Confirmed</span>
                      ) : (
                        <span className="text-amber-400">Pending</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-dark-card border border-dark-border rounded-xl p-6 max-w-md w-full space-y-4">
            <h2 className="text-lg font-bold text-red-400 flex items-center gap-2">
              <HiOutlineTrash className="w-6 h-6" />
              Delete FY {selectedFY} Data
            </h2>

            <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-sm text-red-300 space-y-2">
              <p className="font-semibold">⚠ This action is IRREVERSIBLE.</p>
              <p>
                All bills, payments, attendance, advances, salary records, stock logs,
                activity logs, supplier payments, and custom expenses for FY {selectedFY} will
                be permanently deleted.
              </p>
              <p>
                Make sure you have safely stored the downloaded backup ZIP file before proceeding.
              </p>
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmCheck}
                onChange={(e) => setConfirmCheck(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-gray-600 text-red-500 focus:ring-red-500 bg-dark-bg"
              />
              <span className="text-sm text-gray-300">
                I confirm that I have downloaded and saved the backup safely, and I understand
                this deletion is permanent.
              </span>
            </label>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                <HiOutlineLockClosed className="w-4 h-4 inline mr-1" />
                Enter your password to confirm
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your account password"
                className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2.5 text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setPassword('');
                  setConfirmCheck(false);
                }}
                className="px-4 py-2 text-gray-400 hover:text-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={!confirmCheck || !password || stepLoading === 'delete'}
                className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {stepLoading === 'delete' ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <HiOutlineTrash className="w-4 h-4" />
                )}
                {stepLoading === 'delete' ? 'Deleting...' : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
